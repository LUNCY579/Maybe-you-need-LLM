import { useMemo } from 'react'
import {
  InteractiveExercise,
  LessonSection,
  Prose,
  WorkedExample,
} from '../../components/lesson/LessonChrome'
import { AlignmentLab } from '../../components/lab/AlignmentLab'
import { Callout } from '../../components/ui/primitives'
import { DisplayMath, InlineMath } from '../../components/ui/Math'
import {
  PREFERENCE_DATASET,
  dpoLogOdds,
  dpoPreferenceProbability,
  impliedReward,
  runAlignment,
} from '../../core/alignment'
import { fmt, sigmoid } from '../../core/math'

/**
 * Alignment module lessons.
 *
 * The chapter is covered in three lessons, following the order the book takes:
 * instruction alignment (Section 4.2), human preference alignment (Section 4.3)
 * and the improved preference method (Section 4.4). Every number in the worked
 * examples is recomputed here from the laboratory core, so the prose and the
 * figures cannot drift apart.
 */

export function SftLesson() {
  const run = useMemo(
    () => runAlignment({ objective: 'sft', learningRate: 0.5, steps: 120, beta: 0.6 }),
    [],
  )

  return (
    <>
      <LessonSection kicker="Concept" title="Alignment is a pipeline, not a single step">
        <Prose>
          <p>
            A pre-trained model predicts text. It does not follow instructions, does not decline harmful requests and has
            no notion of which of two plausible answers a person would prefer. Alignment is the set of techniques that add
            those behaviours, and it proceeds in stages: instruction alignment first, then preference alignment.
          </p>
          <p>
            Instruction alignment means supervised fine-tuning on demonstrations: given an instruction and a good response,
            increase the probability of the response. Preference alignment means optimising which of several plausible
            responses is chosen, which requires a different kind of data.
          </p>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="The SFT objective">
        <Prose>
          <p>
            Supervised fine-tuning maximises the likelihood of the demonstrated response token by token, given the
            instruction. In practice only response tokens contribute to the loss; the instruction is context.
          </p>
          <DisplayMath tex="\mathcal{L}_{\text{SFT}}(\theta) = -\mathbb{E}_{(x,y) \sim \mathcal{D}} \sum_{t} \log \Pr_\theta(y_t \mid x, y_{<t})" />
          <p>
            This is the same cross-entropy used in pre-training, applied to a much smaller and much more carefully
            constructed dataset. The difference is entirely in the data: instructions and responses instead of raw documents.
          </p>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="Data construction is the hard part">
        <Prose>
          <p>
            Instruction datasets are built from human writers, from existing supervised datasets reformatted as
            instructions, or from model-generated responses that pass quality filters. Three properties matter more than
            volume: coverage of the task types you care about, consistency of format, and honesty of the responses.
          </p>
          <p>
            Style artefacts propagate. If 90% of demonstrations open with the same phrase, the fine-tuned model will
            over-produce it, because it is faithfully modelling the data distribution. That is a data bug with a modelling
            symptom, and no optimiser setting will fix it.
          </p>
        </Prose>
        <Callout tone="rose" title="The limit of imitation">
          SFT can only push probability toward responses it has seen. If a better answer was never demonstrated, nothing in
          the objective prefers it. Preference learning exists precisely to escape this ceiling.
        </Callout>
      </LessonSection>

      <InteractiveExercise
        id="exercise"
        title="Fit a demonstration and watch the alternatives"
        description="Train a toy policy with the SFT objective and inspect the probability of the chosen response against the rejected alternatives before and after. Notice that the alternatives are pushed down even though they were never compared."
      >
        <AlignmentLab view="sft" />
      </InteractiveExercise>

      <WorkedExample id="worked-example" title="How much probability does SFT move?">
        <Prose>
          <p>
            In the lab, the toy policy is a softmax over three responses. Starting from{' '}
            <InlineMath tex="w = (0.2, 0.2, 0.2)" /> and <InlineMath tex="\beta = 0.6" />, the chosen response begins near
            chance. After {run.history.length - 1} gradient steps the mean negative log-likelihood of the chosen answers
            falls from <span className="font-mono text-fg">{fmt(run.history[0].loss, 4)}</span> to{' '}
            <span className="font-mono text-fg">{fmt(run.history[run.history.length - 1].loss, 4)}</span> nats.
          </p>
          <p>
            Because the toy feature vectors are close together, the loss cannot go to zero: a single weight vector must
            serve all four examples, and their features are not perfectly separable. Real SFT has the same property for a
            different reason — a demonstration set constrains the model only where it is informative.
          </p>
        </Prose>
      </WorkedExample>
    </>
  )
}

export function RlhfLesson() {
  const run = useMemo(
    () => runAlignment({ objective: 'reward', learningRate: 2, steps: 200, beta: 0.6 }),
    [],
  )
  const example = PREFERENCE_DATASET[0]
  const chosen = example.candidates.find((candidate) => candidate.id === example.chosen)!
  const rejected = example.candidates.find((candidate) => candidate.id === example.rejected)!
  const dot3 = (a: number[], b: number[]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const rewardDiff = dot3(run.params.w, chosen.features) - dot3(run.params.w, rejected.features)

  return (
    <>
      <LessonSection kicker="Concept" title="Comparisons carry different information than demonstrations">
        <Prose>
          <p>
            Asking someone to write a good answer is expensive and produces one sample. Asking someone to rank two answers
            is cheap and produces a constraint. Preference data is therefore easier to collect at scale, and it encodes
            something demonstrations cannot: which of two plausible answers is better.
          </p>
          <p>
            The Bradley–Terry model turns a comparison into a probability, assuming each response has a latent score and
            the chance of preferring one is a logistic function of the score difference:
          </p>
          <DisplayMath tex="\Pr(y_a \succ y_b \mid x) = \sigma\!\left(r(x, y_a) - r(x, y_b)\right)" />
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="Training the reward model">
        <Prose>
          <p>
            Train a scorer so that observed preferences become likely: for every pair, increase the score difference between
            the chosen and the rejected response. This is logistic regression on differences, with no policy involved.
          </p>
          <DisplayMath tex="\mathcal{L}_{\text{RM}}(\phi) = -\mathbb{E}_{(x, y_a, y_b)} \log \sigma\!\left(r_\phi(x, y_a) - r_\phi(x, y_b)\right)" />
          <p>
            The reward model is a learned proxy for human judgement, and every proxy can be exploited. Optimise it hard
            enough and the policy finds inputs that score highly without being useful — reward hacking.
          </p>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="Policy optimisation with a leash">
        <Prose>
          <p>
            RLHF then tunes the language model to score well under the reward model, with a penalty for drifting away from
            the reference policy:
          </p>
          <DisplayMath tex="\tilde{\theta} = \arg\min_\theta \mathbb{E}_{x \sim \mathcal{D}} \mathbb{E}_{y \sim \pi_\theta} \left[ -r(x,y) + \lambda \left( \log \pi_\theta(y \mid x) - \log \pi_{\text{ref}}(y \mid x) \right) \right]" />
          <p>
            The penalty is not decoration. Without it the policy is free to leave the region where the reward model is
            accurate, and it will: the reward model is only trustworthy near the data it was trained on.
          </p>
        </Prose>
        <Callout tone="amber" title="What RLHF costs">
          Two models (policy and reward), a value function in the PPO variant, online sampling at every update, and a reward
          model that must be retrained when the policy distribution shifts. DPO was introduced to remove most of that
          machinery.
        </Callout>
      </LessonSection>

      <InteractiveExercise
        id="exercise"
        title="Train a reward model on comparisons"
        description="Fit the reward model on the four preference pairs, then inspect the scores it assigns to preferred and rejected responses and the loss trajectory. Compare the shape of that curve with the DPO curve in the next lesson."
      >
        <AlignmentLab view="reward" />
      </InteractiveExercise>

      <WorkedExample id="worked-example" title="From a score difference to a preference probability">
        <Prose>
          <p>
            After {run.history.length - 1} steps on the first pair, the learned reward difference is{' '}
            <InlineMath tex={`r(a) - r(b) = ${fmt(rewardDiff, 4)}`} />, which gives:
          </p>
          <DisplayMath tex={`\\Pr(y_a \\succ y_b) = \\sigma(${fmt(rewardDiff, 3)}) = ${fmt(sigmoid(rewardDiff), 4)}`} />
          <p>
            A difference of about <span className="font-mono text-fg">{fmt(rewardDiff, 1)}</span> corresponds to a strong
            but not absolute preference. That is the right calibration: real preference data is noisy, and a model that
            predicts certainty from four comparisons is overfitting.
          </p>
        </Prose>
      </WorkedExample>
    </>
  )
}

export function DpoLesson() {
  const example = PREFERENCE_DATASET[0]
  const params = useMemo(
    () => ({
      w: runAlignment({ objective: 'dpo', learningRate: 0.5, steps: 120, beta: 0.6 }).params.w,
      beta: 0.6,
    }),
    [],
  )
  const d = dpoLogOdds(params, example)
  const p = dpoPreferenceProbability(params, example)
  const chosen = example.candidates.find((candidate) => candidate.id === example.chosen)!

  return (
    <>
      <LessonSection kicker="Derivation" title="Step 1 — the KL-regularised objective has a closed form">
        <Prose>
          <p>
            Start from the RLHF objective and treat the reward model and the reference policy as fixed. Rearranging the two
            log-probability terms lets them be written as a single log of a ratio:
          </p>
          <DisplayMath tex="\tilde{\theta} = \arg\min_\theta \mathbb{E}_{x,y} \left[ \log \pi_\theta(y\mid x) - \log\!\left( \pi_{\text{ref}}(y \mid x) \exp\!\left(\frac{1}{\lambda} r(x,y)\right) \right) \right]" />
          <p>
            The second term is an unnormalised distribution in <InlineMath tex="y" />. Normalising it defines a distribution{' '}
            <InlineMath tex="\pi^*" />, and the objective becomes a KL divergence between the policy and that distribution:
          </p>
          <DisplayMath tex="\pi^*(y \mid x) = \frac{1}{Z(x)} \pi_{\text{ref}}(y \mid x) \exp\!\left(\frac{1}{\lambda} r(x,y)\right)" />
        </Prose>
      </LessonSection>

      <LessonSection kicker="Derivation" title="Step 2 — invert the relation to get the reward">
        <Prose>
          <p>
            The optimum is attained when the two distributions coincide, and inverting that equation expresses the reward
            through the policy’s log-ratio plus a normalising term:
          </p>
          <DisplayMath tex="r(x,y) = \lambda \log \frac{\pi_\theta(y \mid x)}{\pi_{\text{ref}}(y \mid x)} + \lambda \log Z(x)" />
          <p>
            This is the pivot of the whole method. It says a reward model is not needed to represent reward — the policy
            itself implies one.
          </p>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Derivation" title="Step 3 — substitute into Bradley–Terry, and Z cancels">
        <Prose>
          <p>
            For a single prompt, both responses carry the same <InlineMath tex="\lambda \log Z(x)" /> term, so subtracting
            one reward from the other eliminates it. Nothing is approximated: the cancellation is exact.
          </p>
          <DisplayMath tex="\Pr(y_a \succ y_b \mid x) = \sigma\!\left( \lambda \log \frac{\pi_\theta(y_a \mid x)}{\pi_{\text{ref}}(y_a \mid x)} - \lambda \log \frac{\pi_\theta(y_b \mid x)}{\pi_{\text{ref}}(y_b \mid x)} \right)" />
          <p>
            In the course’s toy policy, where <InlineMath tex="\log \pi" /> is affine in the weights, the whole expression
            collapses to <InlineMath tex="\lambda (w - w_{\text{ref}}) \cdot \Delta\phi" /> — which is what the lab
            computes.
          </p>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="What changes in practice">
        <Prose>
          <p>The loss is now a supervised objective over a fixed preference dataset:</p>
          <DisplayMath tex="\mathcal{L}_{\text{DPO}}(\theta) = -\mathbb{E}_{(x,y_a,y_b) \sim \mathcal{D}_r} \log \Pr(y_a \succ y_b \mid x)" />
          <p>
            Three consequences follow. No reward model is trained. No online sampling loop is required, so the dataset can
            be reused for multiple epochs. And the reference model must be kept available, because its log-probabilities
            appear in every pair’s term.
          </p>
        </Prose>
        <Callout tone="indigo" title="The trade-off, stated fairly">
          DPO is simpler and more sample-efficient than PPO-style RLHF, but the derivation assumes a fixed reward model and
          a preference model that matches the data. When the reward is genuinely non-stationary or when online exploration
          matters, the assumptions are the weak point — not the algebra.
        </Callout>
      </LessonSection>

      <InteractiveExercise
        id="exercise"
        title="Follow d, the sigmoid and the loss"
        description="Train the policy with the DPO objective and trace one pair: the log-odds d, the preference probability σ(d) and the softplus loss. Then open the gradient-check table to compare the analytic gradient with a finite difference."
      >
        <AlignmentLab view="dpo" />
      </InteractiveExercise>

      <WorkedExample id="worked-example" title="Numbers for one familiar pair">
        <Prose>
          <p>
            For the pair in the first example with <InlineMath tex="\lambda = 0.6" /> after training:
          </p>
          <DisplayMath tex={`d = ${fmt(d, 5)}, \\qquad \\Pr(y_a \\succ y_b) = \\sigma(d) = ${fmt(p, 5)}, \\qquad \\mathcal{L} = \\text{softplus}(-d) = ${fmt(Math.log(1 + Math.exp(-d)), 5)}`} />
          <p>
            The implied reward difference is the same quantity divided by <InlineMath tex="\lambda" />:{' '}
            <InlineMath tex={`${fmt(impliedReward(params, chosen), 4)}`} /> for the chosen response alone, with the other
            response’s value carrying the opposite sign of the pair difference. Equivalently: reward is policy-over-reference
            in disguise.
          </p>
        </Prose>
      </WorkedExample>
    </>
  )
}
