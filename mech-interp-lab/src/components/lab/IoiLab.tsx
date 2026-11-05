import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import { logitDifference, runModel } from '../../core/attention'
import {
  IOI_MEASURE,
  IOI_MIRROR_MEASURE,
  IOI_MIRROR_SEQUENCE,
  IOI_ROLES,
  IOI_SEQUENCE,
  IOI_TOKENS,
  PAPER_FIGURES,
  ioiAttention,
  ioiModel,
  ioiWorkflow,
  publishedIoICircuit,
  type Intervention,
} from '../../core/ioi'
import { Callout, DataTable, Figure, Panel, SegmentedControl, Stat } from '@llm-materials/course-ui'
import { useViewParam } from '@llm-materials/course-ui'
import { IOI_DEFAULTS, type IoiPrompt } from '../../content/labDefaults'

type View = 'steps' | 'criteria' | 'published'
type Prompt = IoiPrompt

/** The tabs of this screen, in order. The registry and the curriculum read this list. */
export const IOI_VIEWS: { value: View; label: string }[] = [
  { value: 'steps', label: 'The steps' },
  { value: 'criteria', label: 'The criteria' },
  { value: 'published', label: 'The published circuit' },
]

const letter = (token: number) => IOI_TOKENS[token] ?? '?'

const PROMPTS: Record<Prompt, { tokens: number[]; measure: typeof IOI_MEASURE; note: string }> = {
  paper: {
    tokens: IOI_SEQUENCE,
    measure: IOI_MEASURE,
    note: 'the paper’s prompt, where the doubled name is the subject and the answer is the name that occurs once',
  },
  mirror: {
    tokens: IOI_MIRROR_SEQUENCE,
    measure: IOI_MIRROR_MEASURE,
    note: 'the two names exchanged, so the answer is the other one — still the name that occurs once',
  },
}

const STEP_KEYS = ['direct', 'attention', 'upstream'] as const

/** Which position in the prompt plays which of the paper's roles. */
function roleAt(position: number): string {
  if (position === IOI_ROLES.io) return 'the indirect object'
  if (position === IOI_ROLES.s2) return 'the subject, doubled'
  if (position === IOI_ROLES.s1) return 'the subject'
  if (position === IOI_ROLES.end) return 'END, where the answer is read'
  return '—'
}

function viaName(result: Intervention): string {
  return result.via?.name ?? 'its own write'
}

export function IoiLab() {
  const [view, setView] = useViewParam(IOI_VIEWS)
  const [prompt, setPrompt] = useState<Prompt>(IOI_DEFAULTS.prompt)
  const [stepIndex, setStepIndex] = useState('direct')

  const { tokens, measure } = PROMPTS[prompt]

  const clean = useMemo(() => runModel(ioiModel, tokens), [tokens])
  const workflow = useMemo(() => ioiWorkflow(ioiModel, tokens, measure), [tokens, measure])
  const metric = useMemo(() => logitDifference(clean, measure), [clean, measure])
  const attention = useMemo(() => ioiAttention(ioiModel, tokens), [tokens])

  const step = workflow.steps.find((entry) => entry.id === stepIndex) ?? workflow.steps[0]!
  const ranked = [...step.results].sort((a, b) => Math.abs(b.share) - Math.abs(a.share))
  const movers = workflow.steps[0]!.found
  const blind = movers.length === 0 ? [] : workflow.steps[1]!.found.filter((name) => !movers.includes(name))

  const published = useMemo(() => publishedIoICircuit(), [])
  const toyClasses = useMemo(
    () =>
      ioiModel.layers.flatMap((layer, l) =>
        layer.map((head, h) => ({ name: head.name, at: `${l}.${h}`, layer: l })),
      ),
    [],
  )

  return (
    <div className="lab">
      <Panel
        title="Laboratory G · The four-step workflow"
        subtitle="Wang et al.'s procedure for finding a circuit, run on a model small enough to check"
        accent="rose"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={IOI_VIEWS}
          />
          <SegmentedControl
            label="The prompt"
            value={prompt}
            onChange={setPrompt}
            options={[
              { value: 'paper', label: 'The paper’s prompt' },
              { value: 'mirror', label: 'The names exchanged' },
            ]}
          />
          {view === 'steps' ? (
            <SegmentedControl
              label="The step"
              value={stepIndex}
              onChange={setStepIndex}
              options={STEP_KEYS.map((key, index) => ({
                value: key,
                label: `§${workflow.steps[index]!.sections}: ${workflow.steps[index]!.title.replace('?', '')}`,
              }))}
            />
          ) : null}
        </div>

        <div className="stat-row">
          <Stat
            label="The logit difference"
            value={fmt(metric, 4)}
            hint={`${letter(measure.winner)} against ${letter(measure.loser)} at END`}
            tone={metric > 0 ? 'good' : 'warn'}
          />
          <Stat label="The prediction" value={letter(clean.logits[measure.position]!.indexOf(Math.max(...clean.logits[measure.position]!)))} hint="the argmax token" />
          <Stat label="The circuit found" value={workflow.discovered.join(', ') || 'nothing'} />
          <Stat
            label="Completeness"
            value={fmt(workflow.criteria.completeness * 100, 1) + '%'}
            hint="of the behaviour the found circuit accounts for"
            tone={workflow.criteria.completeness > 0.9 ? 'good' : 'warn'}
          />
        </div>

        <Figure
          title="The prompt"
          description={`${PROMPTS[prompt].note}. The metric is read at END, the last position.`}
          caption="Two names, one of them repeated. The paper's question is which of the two the model will write after “gave a drink to”, and the answer is the one that occurs once: the model has to notice that the doubled name is the subject and suppress it."
        >
          <DataTable
            caption="The tokens and their roles"
            headers={['Position', 'Token', 'Role']}
            rows={tokens.map((token, position) => [position, letter(token), roleAt(position)])}
          />
        </Figure>

        {view === 'steps' ? (
          <>
            <Figure title={step.title} description={step.question} caption={`Step ${workflow.steps.indexOf(step) + 1} of the paper's §3–§4 sequence. A result counts as found when its share of the logit difference clears ${step.criterion.toFixed(2)}; the shares below are computed by ablating and re-running, never looked up.`}>
              <DataTable
                caption={`Every intervention this step ran (${ranked.length} in total)`}
                headers={['The question asked', 'The effect', 'Share of the answer', 'Found']}
                rows={ranked.map((result) => [
                  step.id === 'direct' ? result.target.name : `${viaName(result)} into ${result.target.name} (${(result.circuits ?? []).join(', ')})`,
                  fmt(result.effect, 4),
                  fmt(result.share, 4),
                  Math.abs(result.share) >= step.criterion ? 'found' : '—',
                ])}
              />
            </Figure>

            <Callout tone={step.id === 'direct' ? 'warning' : 'definition'} title={step.id === 'direct' ? 'What step one cannot see' : `This step found ${step.found.length} head${step.found.length === 1 ? '' : 's'}`}>
              {step.id === 'direct' ? (
                <>
                  It found {movers.length ? movers.join(' and ') : 'nothing'}. The other heads write into the marker
                  block, which the readout never looks at, so their direct score is exactly zero and a surface scan
                  cannot name them. That is not a failure of the scan — it is the reason the paper has a step two: the
                  S-inhibition head is in the circuit and has no direct effect at all.
                </>
              ) : (
                <>
                  Path-patching into the {step.id === 'attention' ? 'query, key and value of the movers' : 'circuits of the heads step two found'} named{' '}
                  {step.found.length ? step.found.join(', ') : 'nothing above the criterion'}.{' '}
                  {blind.length > 0
                    ? `Of these, ${blind.join(', ')} had no direct effect at all in step one and were invisible until now — which is the whole point of asking about paths instead of components.`
                    : 'Every head found here was also visible on the surface.'}
                </>
              )}
            </Callout>

            <DataTable
              caption="Where each head is looking at END"
              headers={['Head', 'Layer', 'Attention over the prompt']}
              rows={attention.map((head) => [
                head.name,
                head.layer,
                head.atEnd.map((weight) => fmt(weight, 2)).join(' · '),
              ])}
            />
          </>
        ) : null}

        {view === 'criteria' ? (
          <>
            <Figure
              title="Completeness and minimality"
              description="Ablate the whole found circuit and see what is left of the behaviour; then ablate each member alone and see whether it was needed."
              caption={`Completeness is ${fmt(workflow.criteria.completeness * 100, 1)}% of the logit difference: after the circuit's heads are zeroed, ${fmt(workflow.criteria.afterCircuitAblation, 4)} of the original ${fmt(metric, 4)} survives. Minimality asks the opposite question — whether every member was needed — and a circuit can pass one and fail the other.`}
            >
              <div className="stat-row">
                <Stat label="The clean metric" value={fmt(workflow.criteria.clean, 4)} />
                <Stat label="With the circuit ablated" value={fmt(workflow.criteria.afterCircuitAblation, 4)} tone="warn" />
                <Stat
                  label="Completeness"
                  value={fmt(workflow.criteria.completeness * 100, 1) + '%'}
                  tone={workflow.criteria.completeness > 0.9 ? 'good' : 'warn'}
                />
                <Stat
                  label="Members needed"
                  value={`${workflow.criteria.minimality.filter((entry) => Math.abs(entry.share) > 0.01).length} of ${workflow.criteria.minimality.length}`}
                  hint="each alone moves the answer"
                />
              </div>

              <DataTable
                caption="Every member of the circuit, removed alone"
                headers={['Head', 'The metric without it', 'The effect', 'Share']}
                rows={workflow.criteria.minimality.map((entry) => [
                  entry.target.name,
                  fmt(entry.effect + metric, 4),
                  fmt(entry.effect, 4),
                  fmt(entry.share, 4),
                ])}
              />
            </Figure>

            <Figure
              title="The redundancy check"
              description="The movers alone, and the two of them together."
              caption={`Removing each mover alone takes away ${workflow.criteria.redundancy.eachAlone.map((share) => `${fmt(share * 100, 1)}%`).join(' and ')}; removing both takes ${fmt(workflow.criteria.redundancy.bothTogether * 100, 1)}%. In the paper the backup movers take over when the name movers are removed, so their individual shares are small and the joint one is not. Here the two movers are the same circuit at different gains, so the shares are additive — the toy reproduces the arithmetic of redundancy, not the takeover, and this screen says which of the two it is showing.`}
            >
              <DataTable
                caption="What is lost when the movers are removed"
                headers={['Removed', 'Share of the behaviour lost']}
                rows={[
                  ...workflow.criteria.redundancy.eachAlone.map((share, index) => [
                    movers[index] ?? `mover ${index}`,
                    `${fmt(share * 100, 1)}%`,
                  ]),
                  ['both together', `${fmt(workflow.criteria.redundancy.bothTogether * 100, 1)}%`],
                ]}
              />
            </Figure>

            <Callout tone="note" title="What the four steps are for">
              Not for a list of heads that respond to names. The output is a graph — which head reads which, through
              which circuit — and the two criteria are what stop a plausible list from being called an explanation. The
              paper is explicit that its own circuit passes both and still leaves part of the behaviour unexplained.
            </Callout>
          </>
        ) : null}

        {view === 'published' ? (
          <>
            <Callout tone="warning" title="Everything on this tab is quoted">
              The table below is the paper's transcription of GPT-2 small: its head indices, its class names, its
              figures. Nothing here was computed by this course, and nothing here is the toy model above. The
              arithmetic on the other two tabs is ours, on a model with four heads and sixteen dimensions, and the two
              must not be read as each other.
            </Callout>

            <Figure
              title={`The published circuit: ${published.heads} heads in ${published.classes} classes`}
              description={`${published.model}, on the prompt “${published.prompt}”.`}
              caption={`Checked against the arXiv text (${PAPER_FIGURES.source}) on 2026-10-29. A claim that could not be found there is left out rather than approximated. The total of ${published.heads} is the paper's own, kept separate from the rows below so that a transcription slip shows up as a failed test instead of being quietly absorbed by counting the rows.`}
            >
              <DataTable
                caption="The classes, as the paper names them"
                headers={['Class', 'Heads (layer.index)', 'Fuzzy', 'Role', '§']}
                rows={published.circuit.map((entry) => [
                  entry.name,
                  entry.heads.join(', '),
                  entry.fuzzy.length > 0 ? entry.fuzzy.join(', ') : '—',
                  entry.role,
                  entry.section,
                ])}
              />
              <DataTable
                caption="The paper's own numbers"
                headers={['Quantity', 'Value', 'What it measures']}
                rows={[
                  ['Mean logit difference', PAPER_FIGURES.meanLogitDifference, 'averaged over the paper’s prompt distribution'],
                  ['Circuit share of performance', `${fmt(PAPER_FIGURES.circuitShareOfPerformance * 100, 0)}%`, 'how much of the behaviour the 26-head circuit reproduces'],
                  ['IO over subject', `${fmt(PAPER_FIGURES.ioOverSubject * 100, 1)}%`, 'prompts on which GPT-2 small prefers the indirect object'],
                ]}
              />
            </Figure>

            <Figure
              title="The toy, for comparison"
              description="Four heads, one per class the procedure needs, in three layers."
              caption="One duplicate-token head, one S-inhibition head and two name movers: the same classes, at a scale where every weight can be written down and the whole search can be re-run in a browser. The counts are not the point — the order of the questions is."
            >
              <DataTable
                caption="This model's heads"
                headers={['Head', 'Layer.index', 'Found by']}
                rows={toyClasses.map((head) => [
                  head.name,
                  head.at,
                  workflow.discovered.includes(head.name)
                    ? workflow.steps
                        .filter((entry) => entry.found.includes(head.name))
                        .map((entry) => `§${entry.sections}`)
                        .join(' + ')
                    : 'nothing — it is not in the circuit the steps found',
                ])}
              />
            </Figure>
          </>
        ) : null}

        <Callout tone="note" title="Why the mirrored prompt is here">
          {PROMPTS[prompt].note}. The circuit was written for one of these and not the other: its mary and john
          dimensions are interchangeable by construction, so the four steps have to re-find the same shapes in the
          mirrored prompt. A circuit report that was a lookup table would fail here, and this one does not — which is
          the only sense in which this screen shows generalisation rather than recall.
        </Callout>
      </Panel>
    </div>
  )
}
