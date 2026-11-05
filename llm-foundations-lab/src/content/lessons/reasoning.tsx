import { useMemo } from 'react'
import {
  InteractiveExercise,
  LessonSection,
  Prose,
  WorkedExample,
} from '../../components/lesson/LessonChrome'
import { InferenceLab } from '../../components/lab/InferenceLab'
import { AlignmentLab } from '../../components/lab/AlignmentLab'
import { Callout } from '../../components/ui/primitives'
import { DisplayMath, InlineMath } from '../../components/ui/Math'
import { beamSearch, bestOfN, buildToyReasoningTree } from '../../core/inference'
import { SYNTHETIC_RESULTS, evaluateProtocols, trainStepScorer } from '../../core/reasoning'
import { fmt } from '../../core/math'

export function ReasoningComputeLesson() {
  const tree = useMemo(() => buildToyReasoningTree(), [])
  const greedy = useMemo(() => beamSearch(tree, 1), [tree])
  const beam = useMemo(() => beamSearch(tree, 3), [tree])
  const sampled = useMemo(() => bestOfN(tree, 6, 1, 7), [tree])
  return (
    <>
      <LessonSection kicker="Concept" title="An operational definition of reasoning">
        <Prose>
          <p>
            “Does it reason?” is a question about an unobservable process. The useful version is operational: reasoning is
            the production of intermediate steps that a criterion can evaluate. That definition is testable, and it is the
            one used throughout this module.
          </p>
          <p>
            Under it, three things become measurable: whether a step follows from its predecessors, whether the final
            answer is right, and how much computation was spent to get there. Every claim in the rest of the module is a
            statement about one of those three.
          </p>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="Why more tokens can mean more thinking">
        <Prose>
          <p>
            A decoder performs a fixed amount of computation per generated token. A hard problem that cannot be solved in
            one pass can sometimes be solved by writing intermediate results: each token is another pass through the
            network, conditioned on everything written so far. This is the mechanism behind inference-time compute
            scaling, and it explains why a shorter trace on the same model is not equivalent to a longer one.
          </p>
          <p>
            It also sets the cost model. More steps means more tokens, which means more time and memory. Extra computation
            is a trade, not a free improvement.
          </p>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="Search over a step tree">
        <Prose>
          <p>
            Once steps are explicit, a solution is a path through a tree of partial states. Three strategies cover most
            practice:
          </p>
          <ul className="space-y-2">
            <li>
              <strong className="text-fg">Greedy</strong> — expand the single best-scoring node. Cheapest; cannot recover
              from a locally attractive mistake.
            </li>
            <li>
              <strong className="text-fg">Beam search</strong> — keep the best <InlineMath tex="b" /> partial solutions
              alive. Marginally more expensive per step, much more robust to a misleading first step.
            </li>
            <li>
              <strong className="text-fg">Best-of-n sampling</strong> — draw complete candidate paths independently and
              pick the best by verifier score. Simple to parallelise, but its accuracy depends on how often the sampling
              distribution produces a correct path at all.
            </li>
          </ul>
        </Prose>
        <Callout tone="rose" title="The verifier is the bottleneck">
          Search optimises the objective it is given. A verifier that rewards confident wrong steps steers search toward
          wrong answers with high confidence — scaling the search makes the failure more reliable, not less. “Verification”
          is a promise about a checker, not about truth.
        </Callout>
      </LessonSection>

      <LessonSection kicker="Concept" title="Verification in practice">
        <Prose>
          <p>
            Verifiable rewards come from checkers: a unit test, a solver, a formal proof assistant, a database query whose
            result can be compared with the expected answer. Where a checker exists, reinforcement learning on it is
            well-posed. Where it does not, the reward must come from a learned model, and the reward-model caveats from
            Module 4 return in full.
          </p>
        </Prose>
      </LessonSection>

      <InteractiveExercise
        id="exercise"
        title="Search the toy tree three ways"
        description="Run greedy, beam search and best-of-n on the same reasoning tree and compare the selected answer with the number of verifier calls spent. Then lower the sampling temperature and watch best-of-n collapse toward greedy behaviour."
      >
        <InferenceLab view="search" />
      </InteractiveExercise>

      <WorkedExample id="worked-example" title="Reading the numbers from the lab">
        <Prose>
          <p>
            On the course’s tree, greedy selects <span className="font-mono text-fg">{greedy.selected[0]}</span> at a
            verifier score of 0.90 but it is the wrong answer, spending {greedy.expansions} verifier calls. A beam of
            three selects <span className="font-mono text-fg">{beam.selected[0]}</span> (score 0.97, correct) for{' '}
            {beam.expansions} calls. Best-of-six sampling selects{' '}
            <span className="font-mono text-fg">{sampled.selected[0] ?? 'nothing'}</span> with {sampled.expansions} calls.
          </p>
          <p>
            The beam’s extra calls bought the correct answer here. That will not always be true: on a tree where the
            highest-scoring terminal is also correct, greedy is both cheapest and right. The point is that the trade-off is
            a property of the score landscape, not a universal rule.
          </p>
        </Prose>
      </WorkedExample>
    </>
  )
}

export function LearningReasonLesson() {
  const outcome = useMemo(() => trainStepScorer('outcome'), [])
  const process = useMemo(() => trainStepScorer('process'), [])

  return (
    <>
      <LessonSection kicker="Concept" title="Where reasoning traces come from">
        <Prose>
          <p>
            Supervised reasoning data is built by collecting worked solutions and keeping the ones that are correct and
            coherent. The filters matter as much as the volume: a trace that reaches a right answer through invalid steps
            teaches the wrong procedure, and a trace that is correct but stylistically baroque teaches the style.
          </p>
          <p>
            Human-written traces are expensive and limited; model-generated traces are cheap and numerous but require
            verification to be useful. On-policy distillation resolves the tension by sampling from the current model,
            keeping the traces that pass a checker and training on those — which keeps the training distribution close to
            the inference distribution.
          </p>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="Outcome versus process supervision">
        <Prose>
          <p>
            Outcome supervision uses one label per solution: the final answer was right or wrong. Process supervision uses
            a label per step. The difference is credit assignment.
          </p>
          <p>
            With outcome-only labels, every step of a failed solution receives the same negative signal, whether or not it
            caused the failure. The model learns to distinguish good solutions from bad ones but not good steps from bad
            ones — precisely the distinction needed to search.
          </p>
          <DisplayMath tex="\underbrace{\text{outcome}: L = \ell(\text{solution})}_{\text{one label, many steps}} \qquad \underbrace{\text{process}: L = \sum_j \ell(\text{step}_j)}_{\text{label per step}}" />
        </Prose>
        <Callout tone="indigo" title="The price of step-level labels">
          Step labels need human annotators or a strong verifier, they are noisier than answer labels, and a process reward
          model can be gamed just like an outcome one. In exchange, search can prune partial solutions early instead of
          finishing every path.
        </Callout>
      </LessonSection>

      <LessonSection kicker="Concept" title="Scaling training for reasoning">
        <Prose>
          <p>
            Reasoning training is data-hungry in a specific way: it needs traces that are hard enough to be informative and
            that the model sometimes gets wrong, otherwise there is no learning signal. Curriculum effects are pronounced —
            adding easier data can dilute the gradient from hard examples, and adding harder data can produce mostly
            failures.
          </p>
          <p>
            Reinforcement learning with verifiable rewards avoids some of this by using the checker directly, at the cost
            of requiring a checker at all.
          </p>
        </Prose>
      </LessonSection>

      <InteractiveExercise
        id="exercise"
        title="Watch credit assignment change"
        description="Train the same step scorer twice: once with outcome labels inherited from the solution, once with per-step process labels. Compare the credit spread within failed solutions — the quantity that decides whether bad steps can be identified."
      >
        <AlignmentLab view="process" />
      </InteractiveExercise>

      <WorkedExample id="worked-example" title="The same scorer under two label sets">
        <Prose>
          <p>
            With outcome labels, step-validity accuracy reaches{' '}
            <span className="font-mono text-fg">{(outcome.stepAccuracy * 100).toFixed(1)}%</span>; with process labels it
            reaches <span className="font-mono text-fg">{(process.stepAccuracy * 100).toFixed(1)}%</span>. The twenty-five
            point gap is the credit assignment problem, measured.
          </p>
          <p>
            The more telling number is what happens to the steps of a failed solution that were{' '}
            <em>not</em> at fault. Outcome supervision has only one label for the whole path, so those sound steps are
            dragged down with the failing one: their mean score is{' '}
            <span className="font-mono text-fg">{fmt(outcome.soundStepPenalty, 3)}</span>, against{' '}
            <span className="font-mono text-fg">{fmt(process.soundStepPenalty, 3)}</span> under process supervision.
          </p>
          <p>
            The credit spread inside a failed solution tells the same story. The outcome-trained scorer spreads the blame
            across the path (range <span className="font-mono text-fg">{fmt(outcome.failedPathCreditSpread, 3)}</span>), so
            it cannot say which line went wrong. The process-trained scorer concentrates the blame on one step (range{' '}
            <span className="font-mono text-fg">{fmt(process.failedPathCreditSpread, 3)}</span>) — it can point at the
            offending line. The features are identical in both runs; only the labels differ, and the labels decide what is
            learnable.
          </p>
        </Prose>
      </WorkedExample>
    </>
  )
}

export function EvaluationLesson() {
  const reports = useMemo(() => evaluateProtocols(SYNTHETIC_RESULTS), [])
  const outcome = reports.find((report) => report.protocol === 'outcome')!
  const process = reports.find((report) => report.protocol === 'process')!
  return (
    <>
      <LessonSection kicker="Concept" title="A metric measures a protocol">
        <Prose>
          <p>
            “82% on benchmark X” is shorthand for a claim about a specific task set, scoring rule and sampling budget.
            Change any of the three and the number changes. Two protocols applied to the same synthetic results in the lab
            give different scores — not because either is wrong, but because they measure different things.
          </p>
          <ul className="space-y-2">
            <li>
              <strong className="text-fg">Outcome-based</strong> scoring checks the final answer. Cheap, reproducible,
              blind to whether the reasoning was sound or accidentally correct.
            </li>
            <li>
              <strong className="text-fg">Process-based</strong> scoring checks the steps. Strict and informative, but it
              requires step labels and depends on how step boundaries are defined.
            </li>
            <li>
              <strong className="text-fg">Cost-adjusted</strong> scoring divides by tokens or time. Essential when
              comparing a method that thinks longer against one that does not.
            </li>
          </ul>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="Contamination turns reasoning into recall">
        <Prose>
          <p>
            If evaluation items appear in pre-training data, a high score may reflect memorisation rather than the ability
            under test. The contamination need not be literal: near-duplicate phrasings and leaked solution formats have
            the same effect. This is why held-out, contamination-checked evaluation is a design constraint rather than a
            formality.
          </p>
          <p>
            The same caution applies to sampling budgets. Reporting the best of ten attempts is a maximum, not an
            expectation; pass@k is legitimate as a coverage metric as long as the <InlineMath tex="k" /> is reported.
          </p>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="What remains open">
        <Prose>
          <p>
            The source is explicit that some questions are unresolved. Whether a reasoning trace reflects an internal
            inference process or a post-hoc narrative is contested. The boundary between memorisation and reasoning is
            blurred by models that retrieve a memorised procedure for a familiar problem shape. And the field lacks
            evaluation protocols whose validity is itself well established.
          </p>
          <p>
            An honest course states this rather than hiding it. What can be said with confidence is narrower: explicit
            steps can be searched, search needs a verifier, and verifiers are only as good as their construction.
          </p>
        </Prose>
        <Callout tone="amber" title="How this course avoids overclaiming">
          Every quantitative figure in these modules is either computed from the algorithms described (loss curves,
          gradients, attention weights, cache size, cosine similarities) or a synthetic dataset whose construction is
          visible in the code. Nothing here is presented as a benchmark result for a real model.
        </Callout>
      </LessonSection>

      <InteractiveExercise
        id="exercise"
        title="Read three protocols off the same results"
        description="Apply outcome-only, process-aware and cost-adjusted scoring to ten synthetic questions. The numbers differ by construction, which is exactly the methodological point."
      >
        <InferenceLab view="evaluation" />
      </InteractiveExercise>

      <WorkedExample id="worked-example" title="The three numbers, side by side">
        <Prose>
          <p>
            On the course’s synthetic set the protocols report{' '}
            <InlineMath tex={`${(outcome.score * 100).toFixed(1)}\\%`} /> (outcome),{' '}
            <InlineMath tex={`${(process.score * 100).toFixed(1)}\\%`} /> (sound and correct), and{' '}
            <InlineMath tex={`${fmt(reports[2].score, 3)}`} /> sound answers per 1,000 tokens.
          </p>
          <p>
            Two of the ten questions are answered correctly through unsound steps — plausible guesses. Outcome scoring
            counts them; process scoring does not. A report that cites only the first number is not lying, but it is
            answering a different question from the one a reader will assume.
          </p>
        </Prose>
      </WorkedExample>
    </>
  )
}
