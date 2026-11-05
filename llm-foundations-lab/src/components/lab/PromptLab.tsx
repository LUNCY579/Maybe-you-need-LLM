import { useMemo, useState } from 'react'
import { readNumber, readOneOf, readString, type LabSettings } from './settings'
import {
  DEFAULT_PROMPT_PARTS,
  RETRIEVAL_AXES,
  TOY_DOCUMENTS,
  formatTokens,
  promptBudget,
  retrieve,
  type PromptPart,
} from '../../core/retrieval'
import { tokenize } from '../../core/tokenizer'
import {
  DEFAULT_IN_CONTEXT_MODEL,
  demonstrationsFor,
  fewShotAccuracy,
  fewShotCurve,
  inducedLabelShare,
  majorityLabelRate,
} from '../../core/prompting'
import { Heatmap } from '../viz/Heatmap'
import { FigureCard, LineChartPanel } from '../viz/Charts'
import {
  Badge,
  Button,
  Callout,
  Panel,
  ResetButton,
  SectionHeading,
  SegmentedControl,
  Slider,
  Stat,
} from '../ui/primitives'


export type PromptView = 'budget' | 'retrieval' | 'few-shot'

export interface PromptLabProps {
  view?: PromptView
  onSaveConfig?: (settings: Record<string, number | string | boolean>) => void
  /** Settings restored from a saved configuration. */
  initialSettings?: LabSettings
}

export function PromptLab({ view: initialView = 'budget', onSaveConfig,
  initialSettings,
}: PromptLabProps) {
  const [view, setView] = useState<PromptView>(() =>
    readOneOf(initialSettings, 'view', ['budget', 'retrieval', 'few-shot'] as const, initialView),
  )
  return (
    <div className="lab-frame space-y-5">
      <SegmentedControl
        label="Laboratory · prompting"
        value={view}
        onChange={setView}
        options={[
          { value: 'budget', label: 'Prompt budget' },
          { value: 'retrieval', label: 'Retrieval scoring' },
          { value: 'few-shot', label: 'Few-shot prompting' },
        ]}
      />
      {view === 'budget' ? (
          <BudgetView initialSettings={initialSettings} onSaveConfig={onSaveConfig} />
        ) : view === 'retrieval' ? (
          <RetrievalView initialSettings={initialSettings} onSaveConfig={onSaveConfig} />
        ) : (
          <FewShotView initialSettings={initialSettings} onSaveConfig={onSaveConfig} />
        )}
    </div>
  )
}

function BudgetView({
  initialSettings,
  onSaveConfig,
}: {
  initialSettings?: LabSettings
  onSaveConfig?: (settings: Record<string, number | string | boolean>) => void
}) {
  const [parts, setParts] = useState<PromptPart[]>(DEFAULT_PROMPT_PARTS.map((part) => ({ ...part })))
  const [contextWindow, setContextWindow] = useState(() => readNumber(initialSettings, 'contextWindow', 64))

  const budget = useMemo(() => promptBudget(parts, contextWindow), [parts, contextWindow])
  const reset = () => {
    setParts(DEFAULT_PROMPT_PARTS.map((part) => ({ ...part })))
    setContextWindow(64)
  }

  const update = (id: string, text: string) =>
    setParts((current) => current.map((part) => (part.id === id ? { ...part, text } : part)))

  return (
    <div className="space-y-5">
      <Panel>
        <SectionHeading
          kicker="Laboratory · prompting"
          title="Prompt budget composer"
          description="Assemble a prompt from labelled parts and see the real token count of each part, the share of the context window it consumes, and what has to be dropped when the budget is exceeded. Token counts come from the demonstrative tokenizer, so they are exact for this vocabulary."
          action={
          <div className="flex flex-wrap gap-2">
            <ResetButton onReset={reset} label="Reset prompt" />
            {onSaveConfig ? (
              <Button size="sm" onClick={() => onSaveConfig({ view: 'budget', contextWindow })}>
                Save this configuration
              </Button>
            ) : null}
          </div>
        }
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-3">
            {parts.map((part) => (
              <div key={part.id} className="rounded-xl border border-control bg-panel-2/40 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-fg">{part.label}</span>
                  <div className="flex items-center gap-2">
                    {part.droppable ? <Badge tone="amber">droppable</Badge> : <Badge tone="indigo">required</Badge>}
                    <span className="font-mono text-[11px] text-muted">
                      {budget.parts.find((entry) => entry.id === part.id)?.tokens ?? 0} tokens
                    </span>
                  </div>
                </div>
                <textarea
                  value={part.text}
                  onChange={(event) => update(part.id, event.target.value)}
                  rows={2}
                  className="w-full resize-y rounded-lg border border-line bg-panel px-2 py-1.5 text-xs text-fg focus:border-indigo focus:outline-none"
                  aria-label={`${part.label} text`}
                />
              </div>
            ))}
            <Slider
              label="Context window"
              value={contextWindow}
              min={16}
              max={256}
              step={8}
              onChange={setContextWindow}
              format={(value) => `${value} tokens`}
              hint="Small windows make the trade-offs visible; production windows are thousands of tokens."
            />
          </div>
          <div className="space-y-2">
            <Stat
              label="Total prompt tokens"
              value={formatTokens(budget.totalTokens)}
              tone={budget.overflows ? 'rose' : 'indigo'}
            />
            <Stat
              label="Window utilisation"
              value={`${(budget.utilisation * 100).toFixed(0)}%`}
              tone={budget.utilisation > 1 ? 'rose' : budget.utilisation > 0.8 ? 'amber' : 'positive'}
            />
            <Stat label="Droppable tokens" value={budget.droppableTokens} tone="amber" />
            <Stat
              label={budget.overflows ? 'Tokens to cut' : 'Headroom'}
              value={budget.overflows ? budget.overflowTokens : contextWindow - budget.totalTokens}
              tone={budget.overflows ? 'rose' : 'positive'}
            />
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FigureCard
          title="Where the budget goes"
          subtitle="Each part’s real token count, with the window drawn as the boundary."
          footer="The total is a sum, not an estimate: the demonstrative tokenizer counted every unit."
        >
          <div className="space-y-2">
            {budget.parts.map((part) => {
              const share = budget.totalTokens === 0 ? 0 : part.tokens / budget.totalTokens
              return (
                <div key={part.id} className="flex items-center gap-2 text-xs">
                  <span className="w-32 truncate text-muted">{part.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-line-soft">
                    <div
                      className={`h-full rounded-full ${part.droppable ? 'bg-amber-strong' : 'bg-indigo-strong'}`}
                      style={{ width: `${share * 100}%` }}
                    />
                  </div>
                  <span className="w-16 text-right font-mono text-muted">{part.tokens}</span>
                </div>
              )
            })}
            <div className="flex items-center gap-2 text-xs">
              <span className="w-32 text-fg">context window</span>
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-line-soft">
                <div
                  className={`h-full rounded-full ${budget.overflows ? 'bg-rose' : 'bg-teal-strong'}`}
                  style={{ width: `${Math.min(100, budget.utilisation * 100)}%` }}
                />
              </div>
              <span className="w-16 text-right font-mono text-fg">{contextWindow}</span>
            </div>
          </div>
        </FigureCard>

        <FigureCard
          title="Assembled prompt, token by token"
          subtitle="This is exactly what the model would condition on."
        >
          <div className="flex flex-wrap gap-1.5">
            {parts.flatMap((part) =>
              tokenize(part.text, { mode: 'subword' }).tokens.map((token, index) => (
                <span
                  key={`${part.id}-${index}`}
                  className={`rounded border px-1.5 py-0.5 font-mono text-[11px] ${
                    part.droppable ? 'border-amber/50 bg-amber/10 text-amber' : 'border-indigo/40 bg-indigo/10 text-indigo'
                  }`}
                  title={`${part.label} · id ${token.id ?? '∅'}`}
                >
                  {token.text}
                </span>
              )),
            )}
            {budget.overflows ? (
              <span className="rounded border border-rose/50 bg-rose/10 px-1.5 py-0.5 font-mono text-[11px] text-rose">
                ✂ {budget.overflowTokens} tokens would be cut
              </span>
            ) : null}
          </div>
          <div className="mt-3 space-y-2 text-xs text-muted">
            <p>
              Dropping every droppable part frees{' '}
              <span className="font-mono text-fg">{budget.droppableTokens}</span> tokens. If even that is not enough,
              the required parts must be rewritten.
            </p>
            <p>
              Prompt design is therefore a scheduling problem: examples and retrieved passages compete with the question
              itself for the same window.
            </p>
          </div>
        </FigureCard>
      </div>
    </div>
  )
}

function RetrievalView({
  initialSettings,
  onSaveConfig,
}: {
  initialSettings?: LabSettings
  onSaveConfig?: (settings: Record<string, number | string | boolean>) => void
}) {
  const [query, setQuery] = useState(() =>
    readString(initialSettings, 'query', 'attention scores and the kv cache'),
  )
  const [k, setK] = useState(() => readNumber(initialSettings, 'k', 3))
  const [threshold, setThreshold] = useState(() => readNumber(initialSettings, 'threshold', 0))

  const retrieval = useMemo(() => retrieve(query, TOY_DOCUMENTS, k, threshold), [query, k, threshold])
  const pressed = trimToThree(query)

  return (
    <div className="space-y-5">
      <Panel>
        <SectionHeading
          kicker="Laboratory · retrieval"
          title="Toy retrieval scorer"
          description="Documents are described by a hand-written six-axis keyword vector, and the query is projected into the same space. The cosine similarities are computed exactly; what they describe is this toy keyword model rather than a production embedding index."
          action={
            onSaveConfig ? (
              <Button size="sm" onClick={() => onSaveConfig({ view: 'retrieval', query, k, threshold })}>
                Save this configuration
              </Button>
            ) : null
          }
        />
        <div className="split-side">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Query</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-xl border border-control bg-panel-2 px-3 py-2 text-sm text-fg focus:border-indigo focus:outline-none"
                placeholder="e.g. long context memory"
                data-testid="retrieval-query"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {['tokenization', 'attention mechanics', 'preference alignment', 'long context caching', 'reasoning search'].map(
                (preset) => (
                  <Button key={preset} size="sm" variant="ghost" onClick={() => setQuery(preset)}>
                    {preset}
                  </Button>
                ),
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Slider label="Top-k passages" value={k} min={1} max={5} onChange={setK} />
              <Slider
                label="Score threshold"
                value={threshold}
                min={0}
                max={0.9}
                step={0.05}
                onChange={setThreshold}
                format={(value) => value.toFixed(2)}
                hint="Passages below the threshold are treated as irrelevant and excluded from the prompt."
              />
            </div>
          </div>
          <div className="space-y-2">
            <Stat label="Passages retrieved" value={retrieval.results.length} tone="teal" />
            <Stat
              label="Prompt tokens for context"
              value={formatTokens(
                retrieval.results.reduce((sum, entry) => sum + tokenize(entry.document.text, { mode: 'subword' }).sequenceLength, 0),
              )}
              tone="indigo"
            />
            <Stat label="Query axes activated" value={retrieval.queryVector.filter((value) => value > 0).length} />
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FigureCard
          title="Ranked passages"
          subtitle="Cosine similarity between the query vector and each document vector."
          footer="Retrieval is arithmetic: a bad query vector or a bad document vector produces bad context, no matter how good the generator is."
        >
          <div className="space-y-3">
            {TOY_DOCUMENTS.map((document) => {
              const score = retrieval.scores.find((entry) => entry.id === document.id)?.score ?? 0
              const retrieved = retrieval.results.some((entry) => entry.document.id === document.id)
              return (
                <div key={document.id} className={`rounded-xl border p-3 ${retrieved ? 'border-teal/50 bg-teal/5' : 'border-line'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-fg">{document.title}</span>
                    <span className="font-mono text-xs text-teal">{score.toFixed(4)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{document.text}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-soft">
                      <div className="h-full rounded-full bg-teal-strong" style={{ width: `${Math.max(0, score) * 100}%` }} />
                    </div>
                    {retrieved ? <Badge tone="teal">in prompt</Badge> : <Badge tone="neutral">excluded</Badge>}
                  </div>
                </div>
              )
            })}
          </div>
        </FigureCard>

        <div className="space-y-4">
          <FigureCard title="Vectors in the toy feature space" subtitle="Query against documents, six axes.">
            <Heatmap
              matrix={[retrieval.queryVector, ...TOY_DOCUMENTS.map((document) => document.vector)]}
              rowLabels={['query', ...TOY_DOCUMENTS.map((document) => document.title)]}
              colLabels={[...RETRIEVAL_AXES]}
              domain={[0, 1]}
              title="Feature vectors"
              caption="Notice how a query touching two axes shares mass with several documents; cosine similarity then decides the order."
            />
          </FigureCard>

          <FigureCard title="Assembled prompt" subtitle="What the generator would actually read.">
            <div className="space-y-2 text-xs">
              <p className="rounded-lg border border-indigo/30 bg-indigo/5 p-2 font-mono text-indigo">
                System: answer using only the provided context.
              </p>
              {retrieval.results.map((entry) => (
                <p key={entry.document.id} className="rounded-lg border border-teal/30 bg-teal/5 p-2 text-teal">
                  [{entry.rank}] {entry.document.title} (score {entry.score.toFixed(3)}): {entry.document.text}
                </p>
              ))}
              <p className="rounded-lg border border-amber/30 bg-amber/5 p-2 font-mono text-amber">
                Question: {pressed || query}
              </p>
            </div>
            <Callout tone="amber" title="The failure mode to watch for">
              Retrieval raises the ceiling only when the retrieved text actually contains the answer. A confident
              generator with irrelevant context can be worse than one that says it does not know.
            </Callout>
          </FigureCard>
        </div>
      </div>
    </div>
  )
}

function trimToThree(query: string): string {
  const words = query.trim().split(/\s+/).filter(Boolean)
  return words.slice(0, 6).join(' ')
}

/* --------------------------------------------------------------- Few-shot */

const LABEL_NAMES = ['A', 'B', 'C', 'D', 'E', 'F']

function FewShotView({
  initialSettings,
  onSaveConfig,
}: {
  initialSettings?: LabSettings
  onSaveConfig?: (settings: Record<string, number | string | boolean>) => void
}) {
  const [demonstrations, setDemonstrations] = useState(() => readNumber(initialSettings, 'demonstrations', 4))
  const [labelPull, setLabelPull] = useState(() => readNumber(initialSettings, 'labelPull', 0.8))
  const model = useMemo(() => ({ ...DEFAULT_IN_CONTEXT_MODEL, labelPull }), [labelPull])

  const accuracy = fewShotAccuracy(demonstrations, model)
  const chance = 1 / model.labels
  const curve = useMemo(() => fewShotCurve(undefined, model), [model])
  const forEighty = demonstrationsFor(chance + 0.8 * (model.ceiling - chance), model)

  const compositions = [
    { name: 'no examples', counts: [0, 0, 0, 0] },
    { name: 'balanced, 2 and 2', counts: [2, 2, 0, 0] },
    { name: 'lopsided, 3 and 1', counts: [3, 1, 0, 0] },
    { name: 'one label only', counts: [4, 0, 0, 0] },
  ].map((composition) => ({
    ...composition,
    share: inducedLabelShare(composition.counts, labelPull),
    majority: majorityLabelRate(composition.counts, labelPull),
  }))

  return (
    <div className="space-y-5">
      <Panel>
        <SectionHeading
          kicker="Laboratory · in-context learning"
          title="Few-shot prompting"
          description="The accuracy of a synthetic in-context learner against the number of demonstrations, and the label prior those demonstrations install. The curve is analytic: the constants are chosen to reproduce the shape GPT-3 reports, not fitted to its measured scores."
          action={
            onSaveConfig ? (
              <Button
                size="sm"
                onClick={() => onSaveConfig({ view: 'few-shot', demonstrations, labelPull })}
              >
                Save this configuration
              </Button>
            ) : null
          }
        />
        <div className="split-side">
          <div className="space-y-3">
            <Slider
              label="Demonstrations in the prompt"
              value={demonstrations}
              min={0}
              max={32}
              onChange={setDemonstrations}
              format={(value) => `${value}`}
              hint="Each is one input–output pair, written in natural language."
            />
            <Slider
              label="Label pull"
              value={labelPull}
              min={0}
              max={0.95}
              step={0.05}
              onChange={setLabelPull}
              format={(value) => value.toFixed(2)}
              hint="How strongly the labels of the examples bias the model's answer."
            />
          </div>
          <div className="split-2-tight">
            <Stat label="Accuracy at this prompt" value={`${(accuracy * 100).toFixed(1)}%`} tone="indigo" />
            <Stat label="Chance rate" value={`${(chance * 100).toFixed(1)}%`} tone="neutral" hint={`1 / ${model.labels} labels`} />
            <Stat label="Ceiling in this model" value={`${(model.ceiling * 100).toFixed(1)}%`} tone="teal" />
            <Stat
              label="Demonstrations for 80% of the gap"
              value={Number.isFinite(forEighty) ? forEighty.toFixed(1) : 'never'}
              tone="amber"
            />
          </div>
        </div>
      </Panel>

      <FigureCard
        title="Accuracy against the number of demonstrations"
        subtitle="The chance line is the answer rate of a model that has learned nothing from the prompt."
        footer="The first examples do most of the work: each one shows the task and the answer format at once. The curve flattens because the remaining uncertainty is about the items, not about the task."
      >
        <LineChartPanel
          data={curve.map((point) => ({
            x: point.demonstrations,
            accuracy: Number((point.accuracy * 100).toFixed(1)),
            chance: Number((point.chance * 100).toFixed(1)),
          }))}
          series={[
            { key: 'accuracy', label: 'accuracy (%)', color: 'var(--indigo)' },
            { key: 'chance', label: 'chance (%)', color: 'var(--faint)', dashed: true },
          ]}
          xLabel="demonstrations"
          yLabel="accuracy (%)"
          height={260}
        />
      </FigureCard>

      <FigureCard
        title="The labels leak: what the prompt does to the prior"
        subtitle={`With label pull ${labelPull.toFixed(2)}, the share of each label the model is disposed to emit.`}
        footer="This is the failure mode few-shot prompting is famous for. A prompt whose examples are all one label turns a classifier into a constant function, and the accuracy curve above does not see it coming — the bias shows up in the predictions, not in the average."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-faint">
                <th className="py-1.5 font-medium">prompt composition</th>
                {LABEL_NAMES.slice(0, 4).map((name) => (
                  <th key={name} className="py-1.5 font-medium">
                    share of {name}
                  </th>
                ))}
                <th className="py-1.5 font-medium">share on the majority label</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {compositions.map((row) => (
                <tr key={row.name} className="border-b border-line-soft">
                  <td className="py-1.5 text-fg">{row.name}</td>
                  {row.share.map((share, index) => (
                    <td key={index} className="py-1.5 text-muted">
                      {(share * 100).toFixed(1)}%
                    </td>
                  ))}
                  <td className="py-1.5 text-amber">{(row.majority * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout tone="amber" title="What few-shot prompting is not">
          Few-shot prompting does not train the model, and it cannot prefer an answer the demonstrations never show.
          When the label distribution of the prompt is not the label distribution of the task, the prompt is the task —
          and the model will solve the prompt.
        </Callout>
      </FigureCard>
    </div>
  )
}

export default PromptLab
