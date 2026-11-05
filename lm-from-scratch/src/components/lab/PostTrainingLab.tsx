import { useMemo, useState } from 'react'
import { fmt } from '@llm-materials/course-core'
import {
  STRATEGIES,
  evaluatePolicy,
  initialPolicy,
  makeProblems,
  policyKl,
  policyProbabilities,
  reinforce,
  supervisedFineTune,
} from '../../core/postTraining'
import { Callout, DataTable, Figure, Panel, SegmentedControl, Slider, Stat, TrendChart } from '@llm-materials/course-ui'

type View = 'sft' | 'rl' | 'examples'

const percent = (value: number) => `${(value * 100).toFixed(1)}%`

export function PostTrainingLab() {
  const [view, setView] = useState<View>('sft')
  const [demonstrations, setDemonstrations] = useState(24)
  const [epochs, setEpochs] = useState(60)
  const [sftRate, setSftRate] = useState(1)
  const [rlSteps, setRlSteps] = useState(80)
  const [rlRate, setRlRate] = useState(0.5)
  const [seed, setSeed] = useState(3)

  const experiment = useMemo(() => {
    const demonstrationSet = makeProblems(demonstrations, 11, 0)
    const trainingSet = makeProblems(120, 11 + seed)
    const heldOut = makeProblems(160, 7 + seed)
    const initial = initialPolicy()
    const before = evaluatePolicy(initial, heldOut)
    const sft = supervisedFineTune(initial, demonstrationSet, { epochs, learningRate: sftRate })
    const afterSft = evaluatePolicy(sft.parameters, heldOut)
    const rl = reinforce(sft.parameters, trainingSet, {
      steps: rlSteps,
      batchSize: 32,
      learningRate: rlRate,
      seed,
    })
    const afterRl = evaluatePolicy(rl.parameters, heldOut)
    const kl = policyKl(sft.parameters, rl.parameters)
    return { demonstrationSet, trainingSet, heldOut, initial, before, sft, afterSft, rl, afterRl, kl }
  }, [demonstrations, epochs, sftRate, rlSteps, rlRate, seed])

  const sftCurve = useMemo(
    () => experiment.sft.history.map((entry) => ({ x: entry.epoch, loss: entry.loss, accuracy: entry.accuracy })),
    [experiment],
  )

  const rlCurve = useMemo(
    () =>
      experiment.rl.history.map((entry) => ({
        x: entry.step,
        reward: entry.reward,
        accuracy: entry.accuracy,
        entropy: entry.entropy,
      })),
    [experiment],
  )

  const probabilityRows = useMemo(() => {
    const contexts = [0, 1] as const
    return STRATEGIES.map((strategy, candidate) => [
      strategy.name,
      ...contexts.flatMap((parity) => [
        percent(policyProbabilities(experiment.initial, parity)[candidate] ?? 0),
        percent(policyProbabilities(experiment.sft.parameters, parity)[candidate] ?? 0),
        percent(policyProbabilities(experiment.rl.parameters, parity)[candidate] ?? 0),
      ]),
    ])
  }, [experiment])

  const accuracyRows = useMemo(
    () => [
      ['an even sum', percent(experiment.before.even), percent(experiment.afterSft.even), percent(experiment.afterRl.even)],
      ['an odd sum', percent(experiment.before.odd), percent(experiment.afterSft.odd), percent(experiment.afterRl.odd)],
      ['all problems', percent(experiment.before.accuracy), percent(experiment.afterSft.accuracy), percent(experiment.afterRl.accuracy)],
    ],
    [experiment],
  )

  return (
    <div className="lab">
      <Panel
        title="Laboratory H · Alignment and reasoning"
        subtitle="Supervised fine-tuning and reinforcement learning against a verifier, both computed exactly"
        accent="rose"
      >
        <div className="lab-controls">
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'sft', label: 'The supervised stage' },
              { value: 'rl', label: 'The reinforcement stage' },
              { value: 'examples', label: 'The verifier' },
            ]}
          />
          <Slider
            label="Demonstrations"
            value={demonstrations}
            min={8}
            max={64}
            step={4}
            onChange={setDemonstrations}
          />
          <Slider label="SFT epochs" value={epochs} min={10} max={120} step={5} onChange={setEpochs} />
          <Slider
            label="SFT learning rate"
            value={sftRate}
            min={0.1}
            max={2}
            step={0.1}
            onChange={setSftRate}
            format={(value) => value.toFixed(1)}
          />
          <Slider label="RL steps" value={rlSteps} min={20} max={200} step={10} onChange={setRlSteps} />
          <Slider
            label="RL learning rate"
            value={rlRate}
            min={0.1}
            max={1}
            step={0.1}
            onChange={setRlRate}
            format={(value) => value.toFixed(1)}
          />
          <Slider label="Seed" value={seed} min={1} max={99} onChange={setSeed} />
        </div>

        {view === 'sft' ? (
          <>
            <div className="stat-row">
              <Stat
                label="Accuracy on the demonstrations"
                value={percent(experiment.afterSft.even)}
                hint="held out, but the same parity"
                tone={experiment.afterSft.even > 0.9 ? 'good' : 'warn'}
              />
              <Stat
                label="Accuracy on the other parity"
                value={percent(experiment.afterSft.odd)}
                hint="never demonstrated"
                tone={experiment.afterSft.odd < 0.4 ? 'warn' : 'good'}
              />
              <Stat
                label="The first epoch’s loss"
                value={fmt(experiment.sft.history[0]!.loss, 3)}
                hint="cross-entropy on the demonstration"
              />
              <Stat
                label="The last epoch’s loss"
                value={fmt(experiment.sft.history[experiment.sft.history.length - 1]!.loss, 3)}
                hint={`after ${epochs} epochs`}
              />
            </div>

            <Figure
              title="The loss on the demonstrations, epoch by epoch"
              description="Cross-entropy of the demonstrated trace under the policy, and the accuracy it implies, at every epoch of the supervised stage."
              caption="The policy starts uniform and learns to put its probability on the one trace the demonstration shows. The loss falls towards zero and the accuracy towards one — on the even sums it was shown."
            >
              <TrendChart
                data={sftCurve}
                series={[
                  { key: 'loss', name: 'the demonstration loss', colour: 'var(--accent-rose)' },
                  { key: 'accuracy', name: 'the demonstration accuracy', colour: 'var(--accent-teal)' },
                ]}
                xLabel="the epoch"
                yLabel="the value"
                height={260}
              />
            </Figure>

            <Figure
              title="What the supervised stage learned"
              description={`The accuracy of the initial policy and the policy after ${epochs} epochs of supervised fine-tuning, on ${experiment.heldOut.length} held-out problems.`}
            >
              <DataTable
                caption="Accuracy, by parity"
                headers={['The problem', 'Before', 'After SFT']}
                rows={accuracyRows.map(([label, before, sft]) => [label, before, sft])}
              />
            </Figure>

            <Callout tone="warning" title="The demonstrations cover half the space">
              Every demonstration has an even sum. The update raises the probability of the trace it shows and never
              touches the other context, so the policy after SFT is {percent(experiment.afterSft.even)} accurate on even
              sums and {percent(experiment.afterSft.odd)} on odd ones — barely better than the initial {percent(experiment.before.odd)}.
              This is the failure mode of imitation: it generalises no further than the data it imitates.
            </Callout>

            <Callout tone="note" title="The policy is a table, not a language model">
              Eight numbers — a score for each of {STRATEGIES.length} strategies in each of two contexts — turned into a
              softmax. It is small on purpose, so the two update rules can be computed in front of you. What it shares
              with a language model is the shape of the problem: a distribution over responses, a demonstration set, a
              verifier, and the same two gradients.
            </Callout>
          </>
        ) : null}

        {view === 'rl' ? (
          <>
            <div className="stat-row">
              <Stat
                label="Accuracy after reinforcement"
                value={percent(experiment.afterRl.accuracy)}
                hint="on the held-out set"
                tone={experiment.afterRl.accuracy > experiment.afterSft.accuracy ? 'good' : 'warn'}
              />
              <Stat
                label="The odd sums, after RL"
                value={percent(experiment.afterRl.odd)}
                hint={`from ${percent(experiment.afterSft.odd)} after SFT`}
                tone={experiment.afterRl.odd > experiment.afterSft.odd ? 'good' : 'warn'}
              />
              <Stat
                label="The KL divergence from SFT"
                value={fmt(experiment.kl, 3)}
                hint="nats, averaged over contexts"
              />
              <Stat
                label="The entropy, after RL"
                value={fmt(experiment.afterRl.entropy, 3)}
                hint={`from ${fmt(experiment.afterSft.entropy, 3)} after SFT`}
              />
            </div>

            <Figure
              title="The reward and the accuracy, step by step"
              description="The mean verifier reward in each batch, the expected accuracy over the whole problem set, and the entropy of the policy."
              caption="The reward is the fraction of sampled traces the verifier accepts. The policy cannot see the held-out set: the curve is its expected accuracy on the same problems it samples from, and it rises because the verifier rewards the correct trace in both contexts."
            >
              <TrendChart
                data={rlCurve}
                series={[
                  { key: 'reward', name: 'the batch reward', colour: 'var(--accent-rose)' },
                  { key: 'accuracy', name: 'the expected accuracy', colour: 'var(--accent-teal)' },
                  { key: 'entropy', name: 'the entropy', colour: 'var(--accent-amber)' },
                ]}
                xLabel="the step"
                yLabel="the value"
                height={280}
              />
            </Figure>

            <Figure
              title="The policy’s four probabilities"
              description="The probability the policy puts on each candidate strategy, before any training, after supervised fine-tuning, and after reinforcement learning, in both contexts."
              caption="SFT concentrates the even context on the demonstrated trace and leaves the odd context uniform. RL moves the odd context too — the verifier sees the correct trace there, although no demonstration ever showed it."
            >
              <DataTable
                caption="Probability of each strategy"
                headers={[
                  'Strategy',
                  'Even, before',
                  'Even, SFT',
                  'Even, RL',
                  'Odd, before',
                  'Odd, SFT',
                  'Odd, RL',
                ]}
                rows={probabilityRows}
              />
            </Figure>

            <Figure
              title="The accuracy, by context"
              description="The accuracy of the initial policy, the supervised policy and the reinforced policy on the same held-out problems."
            >
              <DataTable
                caption="Accuracy before, after SFT and after RL"
                headers={['The problem', 'Before', 'After SFT', 'After RL']}
                rows={accuracyRows}
              />
            </Figure>

            <Callout tone="definition" title="What the verifier rewards, and what it cannot">
              The reward is one bit: the verifier parses the number after the last equals sign and compares it with the
              arithmetic. It rewards the odd sums the demonstrations never covered, which is why RL improves the half SFT
              missed — and it would equally reward a lucky guess, because it checks the answer and not the reasoning.
              The KL divergence from the supervised policy is {fmt(experiment.kl, 3)} nats: the model changed, in the
              direction the reward pointed.
            </Callout>
          </>
        ) : null}

        {view === 'examples' ? (
          <>
            <Figure
              title="Four candidate traces, one verifier"
              description={`The first four demonstration problems, with every candidate trace and the verifier’s verdict.`}
              caption="The trace is parsed for the number after its last equals sign. The addition, the subtraction, the product and the off-by-one all look like reasoning; only the answer decides."
            >
              <DataTable
                caption="The candidate traces"
                headers={['The problem', 'Strategy', 'The trace', 'The verifier']}
                rows={experiment.demonstrationSet.slice(0, 6).flatMap((problem) =>
                  problem.candidates.map((candidate) => [
                    problem.prompt,
                    candidate.strategy,
                    candidate.trace,
                    candidate.correct ? 'accepts' : 'rejects',
                  ]),
                )}
              />
            </Figure>

            <Figure
              title="The demonstrations, by parity"
              description={`All ${experiment.demonstrationSet.length} problems the supervised stage sees, and all ${experiment.heldOut.length} problems it is scored on.`}
            >
              <DataTable
                caption="The problem sets"
                headers={['The set', 'Problems', 'Even sums', 'Odd sums']}
                rows={[
                  [
                    'the demonstrations',
                    experiment.demonstrationSet.length,
                    experiment.demonstrationSet.filter((problem) => problem.parity === 0).length,
                    experiment.demonstrationSet.filter((problem) => problem.parity === 1).length,
                  ],
                  [
                    'the reinforcement set',
                    experiment.trainingSet.length,
                    experiment.trainingSet.filter((problem) => problem.parity === 0).length,
                    experiment.trainingSet.filter((problem) => problem.parity === 1).length,
                  ],
                  [
                    'the held-out set',
                    experiment.heldOut.length,
                    experiment.heldOut.filter((problem) => problem.parity === 0).length,
                    experiment.heldOut.filter((problem) => problem.parity === 1).length,
                  ],
                ]}
              />
            </Figure>

            <Callout tone="definition" title="A verifiable reward is a narrow, exact signal">
              Arithmetic is the easiest case: the verifier is a parser and a comparison, and it cannot be talked into
              accepting a wrong answer. Most tasks that matter do not have one. Where a verifier exists, RL can improve
              beyond its demonstrations, exactly as it does here on the odd sums. Where it does not, the reward has to be
              learned, and a learned reward can be optimised against rather than satisfied.
            </Callout>
          </>
        ) : null}
      </Panel>
    </div>
  )
}
