import {
  InteractiveExercise,
  LessonSection,
  Prose,
  WorkedExample,
} from '../../components/lesson/LessonChrome'
import { InferenceLab } from '../../components/lab/InferenceLab'
import { SamplingLab } from '../../components/lab/SamplingLab'
import { Callout } from '../../components/ui/primitives'
import { DisplayMath, InlineMath } from '../../components/ui/Math'
import { DEFAULT_KV_CONFIG, formatBytes, kvCacheBytes } from '../../core/inference'
import { TOY_LOGITS, TOY_LOGIT_TOKENS, decodeDistribution } from '../../core/sampling'
import { fmt, softmax } from '../../core/math'

export function PrefillLesson() {
  const perToken = kvCacheBytes({ ...DEFAULT_KV_CONFIG, contextLength: 1, batchSize: 1 })
  const batch = kvCacheBytes({ ...DEFAULT_KV_CONFIG, contextLength: 4096, batchSize: 32 })
  return (
    <>
      <LessonSection kicker="Concept" title="Two phases, one model">
        <Prose>
          <p>
            Inference begins with prefill: the whole prompt is processed in one parallel pass, and keys and values for
            every position are written into the cache. Then decode takes over, producing one token per step, each step
            attending to the cache rather than recomputing it.
          </p>
          <p>
            The two phases have different bottlenecks. Prefill is compute-bound and scales quadratically with prompt
            length. Decode is memory-bandwidth-bound: each step moves the whole cache through the processor to compute a
            single token, which is why batching improves throughput so dramatically — the same cache read serves many
            sequences.
          </p>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="What the cache holds">
        <Prose>
          <p>
            For every layer, every key/value head and every processed token, the cache stores one key vector and one value
            vector of length <InlineMath tex="d_h" />. The size is therefore:
          </p>
          <DisplayMath tex="\text{bytes} = 2 \times L \times h_{kv} \times d_h \times T \times b \times B" />
          <p>
            With the lab’s default shape this is {formatBytes(kvCacheBytes({ ...DEFAULT_KV_CONFIG, batchSize: 1 }))} per
            sequence, or about {formatBytes(perToken)} per token — a useful number to remember, because context length
            multiplies it directly.
          </p>
        </Prose>
        <Callout tone="teal" title="Prefix caching">
          Two requests often share a long system prompt. Prefix caching stores the cached state for that shared prefix and
          reuses it, so only the differing suffix needs prefill. It is the serving-side equivalent of memoisation.
        </Callout>
      </LessonSection>

      <LessonSection kicker="Concept" title="Scheduling is where throughput comes from">
        <Prose>
          <p>
            A static batch wastes capacity: short requests finish early while the batch waits for the longest sequence.
            Continuous batching admits new requests as slots free up, so the device stays busy. Combined with paged cache
            management, this is how a serving system turns per-token cost into a predictable per-token price.
          </p>
          <p>
            Parallelism strategies then apply as in training: data parallelism for replicas, tensor parallelism when a
            single layer does not fit, pipeline parallelism to reduce memory per device at the cost of bubbles.
          </p>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="Verification is parallel — the draft is not free">
        <Prose>
          <p>
            Decode produces one token per serial pass of the model, and each pass is memory-bandwidth-bound: the whole
            cache is moved to compute a single token. Speculative decoding attacks that bottleneck with a second,
            smaller <em>draft</em> model. The draft proposes <InlineMath tex="k" /> tokens; the target scores the{' '}
            <InlineMath tex="k+1" /> positions in one parallel pass — the same kind of pass as prefill, not{' '}
            <InlineMath tex="k" /> sequential passes; each drafted token is accepted with probability{' '}
            <InlineMath tex="\min(1, p(x)/q(x))" />; on the first rejection the sampler resamples from the residual{' '}
            <InlineMath tex="\mathrm{norm}(\max(0, p - q))" /> and stops; if all <InlineMath tex="k" /> pass, the target
            contributes one bonus token. The output distribution is exactly <InlineMath tex="p" /> — the check is
            rejection sampling, not an approximation.
          </p>
          <DisplayMath tex="\alpha = \sum_x \min\left(p(x), q(x)\right) = 1 - TV(p, q), \\qquad E = \frac{1 - \alpha^{k+1}}{1 - \alpha}" />
          <p>
            The acceptance probability <InlineMath tex="\alpha" /> is exact and per drafted token; the expected number
            of tokens per verification pass, <InlineMath tex="E" />, grows with <InlineMath tex="k" /> but with
            diminishing returns, and each pass costs one target evaluation plus <InlineMath tex="k" /> cheap draft
            evaluations. Whether the scheme pays is arithmetic on those three numbers, which is what the laboratory
            computes — Leviathan, Kalman and Matias (2023, arXiv:2211.17192, ICML 2023) demonstrated 2–3× on T5-XXL.
          </p>
        </Prose>
        <Callout tone="teal" title="Why it is safe to run on a stock model">
          Nothing about the target's distribution is approximated: whatever the draft proposes, rejection sampling
          restores <InlineMath tex="p" /> exactly or the token comes from the bonus position. A worse draft forfeits
          speed, never correctness — so the risk in deploying this is a slow afternoon, not a wrong answer.
        </Callout>
      </LessonSection>

      <InteractiveExercise
        id="exercise"
        title="Step through decoding"
        description="Choose a prompt by clicking tokens, then step through generation. Each row shows the visible context after truncation to the window, the distribution it produced and the token drawn from it — with the entropy of each step."
      >
        <InferenceLab view="decode" />
      </InteractiveExercise>

      <InteractiveExercise
        id="speculative"
        title="Draft, verify, and keep what passes"
        description="Two distributions over a six-token vocabulary: the target's fixed preferences, and a toy draft that is the same preferences perturbed and re-tempered. Slide the temperatures, the noise, the draft length and the draft's relative cost; the acceptance probability, the expected tokens per pass, the speedup at every k and the best k all recompute exactly."
      >
        <InferenceLab view="speculative" />
      </InteractiveExercise>

      <WorkedExample id="worked-example" title="What caching saves, and what a batch costs">
        <Prose>
          <p>
            Without a cache, generating the <InlineMath tex="t" />-th token requires recomputing keys and values for all{' '}
            <InlineMath tex="t-1" /> previous tokens — work that grows quadratically across a long generation. With the
            cache, each step performs one query against <InlineMath tex="t" /> cached keys, which is linear.
          </p>
          <p>
            The memory side scales the other way. A batch of 32 sequences at 4,096 tokens with the default shape needs{' '}
            {formatBytes(batch)} of cache — which is a statement about the formula, not a measurement of any particular
            server. Serving decisions are about trading that memory against latency.
          </p>
        </Prose>
      </WorkedExample>
    </>
  )
}

export function DecodingLesson() {
  const config = { temperature: 1, topK: 4, topP: 0.9, seed: 1 }
  const trace = decodeDistribution(TOY_LOGITS, TOY_LOGIT_TOKENS, config)
  const cold = softmax(TOY_LOGITS, 0.5)
  const hot = softmax(TOY_LOGITS, 2)
  return (
    <>
      <LessonSection kicker="Concept" title="Decoding is a policy on top of the model">
        <Prose>
          <p>
            The model produces logits; the decoder decides how to turn them into a choice. Greedy decoding takes the
            argmax, beam search keeps several partial sequences, and sampling draws from a modified distribution. None of
            these change the model — they change which of its plausible continuations you see.
          </p>
          <DisplayMath tex="\Pr(y_i \mid x, y_{<i}) = \frac{\exp(u_{y_i}/\tau)}{\sum_{j \in V_i} \exp(u_{y_j}/\tau)}" />
          <p>
            Temperature <InlineMath tex="\tau" /> rescales the logits before filtering, so it interacts with top-k and
            top-p rather than acting independently. A small <InlineMath tex="\tau" /> concentrates the mass; a large one
            flattens it.
          </p>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="Two ways to truncate the tail">
        <Prose>
          <p>
            <strong className="text-fg">Top-k</strong> keeps a fixed number of candidates. It is predictable and simple,
            but the right <InlineMath tex="k" /> depends on the shape of the distribution: too small and the output is
            repetitive, too large and implausible tokens re-enter.
          </p>
          <p>
            <strong className="text-fg">Top-p</strong> (nucleus) keeps the smallest set whose cumulative probability
            reaches <InlineMath tex="p" />. When the distribution is peaked, that set is small; when it is flat, the set
            grows. The candidate count therefore adapts at every step.
          </p>
          <DisplayMath tex="V_i = \left\{ y_i^{\text{top}1}, \dots, y_i^{\text{top}k_p} \right\}, \qquad \sum_{j \le k_p} \Pr(y_i^{\text{top}j}) \ge p" />
          <p>
            In both cases the surviving probabilities are renormalised so they sum to one over the pool — otherwise the
            sampled distribution would be defective.
          </p>
        </Prose>
        <Callout tone="indigo" title="Greedy and beam, fairly">
          Greedy is reproducible and never wanders, which is what you want for structured output. Beam search explores
          several hypotheses but tends to favour short, high-probability sequences unless you calibrate length, and it
          spends <InlineMath tex="b" /> times the compute per step.
        </Callout>
      </LessonSection>

      <LessonSection kicker="Concept" title="Determinism and reproducibility">
        <Prose>
          <p>
            Sampling is only reproducible if the random stream is. Seeding the generator makes a run replayable: the same
            configuration produces the same tokens, which is what allows a bug report to be reproduced and an experiment
            to be compared against a baseline.
          </p>
          <p>
            Two independent streams from the same seed produce identical sequences — the lab shows both, side by side, to
            make that concrete.
          </p>
        </Prose>
      </LessonSection>

      <InteractiveExercise
        id="exercise"
        title="Move every decoding knob"
        description="Edit the logits directly or pick a preset, then slide temperature, top-k, top-p and the seed. The two distributions side by side separate what the model proposed from what the decoder allowed, and the Monte-Carlo table checks the sampler against theory."
      >
        <SamplingLab />
      </InteractiveExercise>

      <WorkedExample id="worked-example" title="From logits to a sampled token">
        <Prose>
          <p>
            Take the default logits <InlineMath tex="[4.2, 3.4, 3.0, 2.2, \dots]" /> with{' '}
            <InlineMath tex="\tau = 0.5" />. Scaling multiplies by 2, giving{' '}
            <InlineMath tex="[8.4, 6.8, 6.0, \dots]" />, and the softmax of that puts{' '}
            <InlineMath tex={fmt(cold[0], 4)} /> on the first token, versus{' '}
            <InlineMath tex={fmt(trace.baseProbabilities[0], 4)} /> at <InlineMath tex="\tau = 1" /> and{' '}
            <InlineMath tex={fmt(hot[0], 4)} /> at <InlineMath tex="\tau = 2" />.
          </p>
          <p>
            Now apply the filters: with top-k = 4 and top-p = 0.9, the lab keeps{' '}
            {trace.candidates.length} candidate{trace.candidates.length === 1 ? '' : 's'}, whose probabilities sum to{' '}
            <InlineMath tex={fmt(trace.candidates.reduce((sum, c) => sum + c.probability, 0), 6)} />. The draw itself is
            just a walk along that renormalised cumulative distribution using one uniform number.
          </p>
        </Prose>
      </WorkedExample>
    </>
  )
}

export function ScalingLesson() {
  return (
    <>
      <LessonSection kicker="Concept" title="Spending compute at inference time">
        <Prose>
          <p>
            Inference-time scaling means improving answers by spending more computation when a request arrives, rather
            than by changing the weights. Four strategies appear in the source: longer context (with retrieved content),
            more samples with search, ensembling over multiple outputs, and explicit thinking-path generation with
            verification.
          </p>
          <p>
            They are not equivalent. Context scaling helps when the answer is retrievable. Sample-and-select helps only if
            a verifier can distinguish candidates. Ensembling helps when errors are uncorrelated. Thinking-path search
            helps when intermediate steps are checkable.
          </p>
        </Prose>
        <DisplayMath tex="\text{accuracy}(s, C) = \Pr\!\left(\exists\, \hat{y} \in \text{candidates}(C) : \text{verify}(\hat{y}) = \text{pass}\right)" />
      </LessonSection>

      <LessonSection kicker="Concept" title="Costs you must report">
        <Prose>
          <p>
            Every one of these strategies consumes tokens, and tokens consume time, memory and money. A comparison that
            holds the budget constant across methods is informative; one that does not is a comparison of budgets. The
            evaluation view of the lab makes the point numerically: three protocols applied to the same results give three
            different rankings.
          </p>
        </Prose>
        <Callout tone="amber" title="Analytical model versus measurement">
          This course uses formulas for cost and, where it measures anything, it measures JavaScript running in your
          browser and labels it as such. A formula explains how cost scales; only a controlled measurement on the target
          hardware supports a throughput or latency claim. Conflating the two is the most common honest mistake in
          systems writing.
        </Callout>
      </LessonSection>

      <LessonSection kicker="Concept" title="Choosing a configuration">
        <Prose>
          <p>
            A practical reading of the trade-offs: if the task has one correct form (a JSON object, a unit conversion),
            use low temperature with a strong form constraint. If the task has many acceptable outputs, sample with
            top-p and compare several candidates. If the task is hard and checkable, pay for search and verification. If
            the task is hard and not checkable, extra compute mostly buys confidence, not accuracy.
          </p>
        </Prose>
      </LessonSection>

      <InteractiveExercise
        id="exercise"
        title="Compare strategies on stated budgets"
        description="Run the three reasoning strategies, then read the accuracy and verifier-call columns together. The evaluation view applies outcome-only, process-aware and cost-adjusted scoring to the same synthetic results."
      >
        <InferenceLab view="search" />
      </InteractiveExercise>

      <WorkedExample id="worked-example" title="An accuracy-per-cost reading">
        <Prose>
          <p>
            Suppose a baseline answers 60 of 100 questions correctly with 400 tokens each, and a search-and-verify method
            answers 68 correctly with 1,200 tokens each. Outcome accuracy improves by 8 points; sound-and-correct rate may
            improve less if some new correct answers come from unsound traces.
          </p>
          <p>
            Per 1,000 tokens the baseline delivers <InlineMath tex="60 / 40 = 1.5" /> correct answers, while the search
            method delivers <InlineMath tex="68 / 120 = 0.57" />. Whether that is a good trade depends entirely on what
            the task costs when it is wrong — which is why the trade-off must be stated, not assumed.
          </p>
        </Prose>
      </WorkedExample>
    </>
  )
}
