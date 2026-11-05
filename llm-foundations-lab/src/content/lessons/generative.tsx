import { useMemo } from 'react'
import {
  InteractiveExercise,
  LessonSection,
  Prose,
  WorkedExample,
} from '../../components/lesson/LessonChrome'
import { TransformerExplorer } from '../../components/lab/TransformerExplorer'
import { LearningLab } from '../../components/lab/LearningLab'
import { InferenceLab } from '../../components/lab/InferenceLab'
import { Callout } from '../../components/ui/primitives'
import { DisplayMath, InlineMath } from '../../components/ui/Math'
import { buildToyParameters, toyEmbedding, positionalEncoding, DEFAULT_TOY_CONFIG } from '../../core/embeddings'
import { attentionScores, projectQkv } from '../../core/attention'
import { fmt } from '../../core/math'

export function TransformerLesson() {
  return (
    <>
      <LessonSection kicker="Concept" title="From tokens to hidden states">
        <Prose>
          <p>
            A decoder-only Transformer consumes a sequence of tokens. Each token id selects a row from the token embedding
            table, and a positional encoding is added so that the model can tell “model learns” from “learns model” —
            attention on its own is permutation-invariant.
          </p>
          <DisplayMath tex="H = E[x_0, \dots, x_{m-1}] + PE(0, \dots, m-1)" />
          <p>
            The rows of <InlineMath tex="H" /> are the representations the first block processes. Everything downstream —
            queries, keys, values, attention weights, the output distribution — is a function of this matrix.
          </p>
          <p>
            A model built this way is autoregressive: it is trained to predict the next token given everything before
            it, and the same objective is what it performs one token at a time when it generates. Every language model in
            this course is a decoder-only one, because that is the design the book follows.
          </p>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="Queries, keys, values and scaled scores">
        <Prose>
          <p>
            Three learned projections turn <InlineMath tex="H" /> into queries, keys and values. A query is compared with
            every key by a dot product; the results are scaled by <InlineMath tex="1/\sqrt{d}" /> and passed through a
            row-wise softmax to become attention weights, which then mix the values. This is scaled dot-product
            attention, and every part of it is there for a reason.
          </p>
          <DisplayMath tex="\operatorname{Att}_{qkv}(Q,K,V) = \operatorname{Softmax}\!\left(\frac{QK^{\top}}{\sqrt{d}} + M\right)V" />
          <p>
            The scaling is not cosmetic. Dot products grow with the dimension, and a softmax over large logits is
            effectively one-hot: gradients vanish and the model cannot learn to spread attention. Dividing by{' '}
            <InlineMath tex="\sqrt{d}" /> keeps the logits in a useful range.
          </p>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="The causal mask">
        <Prose>
          <p>
            Predicting the next token requires that position <InlineMath tex="i" /> never see position{' '}
            <InlineMath tex="i+1" />. The causal mask enforces this additively: entry <InlineMath tex="(i,k)" /> is 0
            when <InlineMath tex="i \ge k" /> and <InlineMath tex="-\infty" /> otherwise. Because{' '}
            <InlineMath tex="e^{-\infty} = 0" />, masked positions receive exactly zero weight after the softmax.
          </p>
          <DisplayMath tex="M_{(i,k)} = \begin{cases} 0 & i \ge k \\ -\infty & i < k \end{cases}" />
          <p>
            One matrix therefore handles every row of the batch: rows near the beginning of the sequence attend to few
            positions, and the first row attends only to itself, which makes its attention weights exactly{' '}
            <InlineMath tex="[1, 0, \dots, 0]" />.
          </p>
        </Prose>
        <Callout tone="rose" title="What happens without the mask">
          Remove it and the model can read the token it is supposed to predict. Training loss plummets and generation
          fails, because at inference time the future is genuinely unavailable. The Explorer lets you switch masking off to
          watch the leak appear.
        </Callout>
      </LessonSection>

      <LessonSection kicker="Concept" title="Multi-head attention and the output distribution">
        <Prose>
          <p>
            Real models run several attention heads in parallel on different subspaces of the hidden dimension, then
            concatenate and project the results. Different heads can specialise - one tracking syntactic dependencies,
            another copying recently seen tokens - although the specialisation is learned, not designed. A decoder-only
            language model of this shape is the architecture behind most of the systems in the rest of this course.
          </p>
          <DisplayMath tex="F(H) = \operatorname{Merge}(\text{head}_1, \dots, \text{head}_h)W_{\text{head}}" />
          <p>
            Splitting the dimension changes the arithmetic, not just the picture. Each head scales its own scores by{' '}
            <InlineMath tex="1/\sqrt{d_{head}}" />, and because a head owns fewer dimensions the divisor is smaller, so
            the head's scores are larger than the single-head ones for the same raw dot product. The Explorer's{' '}
            <strong className="text-fg">Attention heads</strong> control lets you make that change and watch every
            matrix move.
          </p>
          <p>
            The rest of the block is the same shape twice more. A sub-layer's output is <em>added</em> to its input
            rather than replacing it — the residual connection — and the sum is then normalised. After attention comes a
            feed-forward network: two linear projections with a GELU in between, applied to each position on its own.
          </p>
          <DisplayMath tex="H' = \operatorname{LayerNorm}(H + \operatorname{Attention}(H)), \quad H'' = \operatorname{LayerNorm}(H' + \operatorname{FFN}(H'))" />
          <p>
            The residual connection is why a deep stack of blocks does not destroy the signal: a sub-layer that has
            nothing useful to add can leave its input alone. The Explorer has a <strong className="text-fg">Feed-forward</strong>{' '}
            stage that shows the residual add, the normalisation, the hidden activation and the block's output, so you can
            watch the whole block rather than only its attention half.
          </p>
          <p>
            The final block's hidden states are projected to vocabulary size and normalised, giving a distribution over
            the next token at every position. At generation time only the last row matters; during training every row
            provides a training signal.
          </p>
        </Prose>
      </LessonSection>

      <InteractiveExercise
        id="exercise"
        title="Follow every stage for your own sentence"
        description="Type a sentence, then walk the nine stages: ids, embeddings, positional information, Q/K/V, raw and scaled scores, the causal mask, softmax weights, the attention output and the next-token distribution. The “inspect a single cell” panel shows the arithmetic for any query/key pair, and the arcs figure shows which earlier tokens a position reads."
      >
        <TransformerExplorer />
      </InteractiveExercise>

      <WorkedExample id="worked-example" title="Hand-computing one attention row">
        <Prose>
          <p>
            Take the sentence <span className="font-mono text-fg">the model learns</span>, dimension 4, and a single head.
            The second row of <InlineMath tex="H" /> — the token “model” — produces a query vector. Suppose the scaled
            scores against its two visible keys are <InlineMath tex="[2, 1]" /> (the third position is masked with{' '}
            <InlineMath tex="-\infty" />).
          </p>
          <p>
            Softmax of <InlineMath tex="[2,1]" /> is <InlineMath tex="[0.731, 0.269]" />: each exponential is divided by{' '}
            <InlineMath tex="e^2 + e^1 = 10.107" />, giving <InlineMath tex="7.389/10.107" /> and{' '}
            <InlineMath tex="2.718/10.107" />. The output row is then{' '}
            <InlineMath tex="0.731\,v_0 + 0.269\,v_1" /> — a weighted average of the two visible value vectors. The
            Explorer prints these same intermediate numbers for whatever sentence you type.
          </p>
        </Prose>
      </WorkedExample>
    </>
  )
}

export function ScalingLesson() {
  const demo = useMemo(() => {
    const params = buildToyParameters(8, DEFAULT_TOY_CONFIG)
    const embeddingA = toyEmbedding('model', 8)
    const embeddingB = toyEmbedding('model', 8)
    const scores = attentionScores([embeddingA, embeddingB], [embeddingA, embeddingB], { masked: true, d: 8 })
    return { qkv: projectQkv([embeddingA], params.Wq, params.Wk, params.Wv), scores }
  }, [])

  return (
    <>
      <LessonSection kicker="Concept" title="Data before architecture">
        <Prose>
          <p>
            At scale, the pipeline matters as much as the model. Text is collected, filtered for quality, deduplicated,
            and mixed across domains. Deduplication is not housekeeping: repeated documents are memorised more easily,
            distort the effective distribution and inflate apparent loss progress.
          </p>
          <p>
            A scaling law says how the loss of a language model falls as data and parameters grow. The useful question
            is not how big the model should be, but what keeps it busy: past a certain point, adding parameters without
            adding tokens buys very little.
          </p>
          <p>
            Model modifications �?" architecture tweaks, better initialisation, mixed precision �?" are then combined with
            distributed training, where the interesting quantity is not device count but how often devices must
            synchronise relative to how much work they do between synchronisations.
          </p>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="Parallelism in one paragraph each">
        <Prose>
          <ul className="space-y-2">
            <li>
              <strong className="text-fg">Data parallelism</strong> replicates the model on every device and splits the
              batch. Gradients are averaged across replicas. Memory per device stays high.
            </li>
            <li>
              <strong className="text-fg">Tensor parallelism</strong> splits individual weight matrices across devices so
              a single layer fits in aggregate memory. It requires frequent collective communication.
            </li>
            <li>
              <strong className="text-fg">Pipeline parallelism</strong> assigns different layers to different devices and
              streams micro-batches through the resulting stages, trading pipeline bubbles for memory relief.
            </li>
          </ul>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="Scaling laws">
        <Prose>
          <p>
            Loss falls as a power law in model size, data volume and compute, with an irreducible floor. The practical
            consequence is a budgeting question: for a fixed compute budget approximately{' '}
            <InlineMath tex="C \approx 6ND" /> (parameters times tokens), there is a best split between making the model
            bigger and training it longer.
          </p>
          <DisplayMath tex="L(N, D) \approx L_\infty + \left(\frac{N_c}{N}\right)^{\alpha} + \left(\frac{D_c}{D}\right)^{\beta}" />
          <p>
            The exponents are fitted empirically, not derived, and they depend on architecture, data mixture and
            optimiser. They are useful for planning; they are not laws of nature.
          </p>
        </Prose>
        <Callout tone="amber" title="Use the calculator as a reasoning aid">
          The scaling calculator in the lab uses course constants, not published fits. Its purpose is to make the shape of
          diminishing returns tangible — including the fact that once parameters and data are roughly balanced, ten
          percent more of either buys a similar, and small, improvement.
        </Callout>
      </LessonSection>

      <InteractiveExercise
        id="exercise"
        title="Train a model and explore the scaling trade-off"
        description="First train a real (tiny) model: change the learning rate, batch size, step count and L2 penalty, and watch the train/validation loss curves. Then switch to the scaling view to move a fixed compute budget between parameters and tokens."
      >
        <LearningLab view="training" />
      </InteractiveExercise>

      <WorkedExample id="worked-example" title="Reading the trade-off off the numbers">
        <Prose>
          <p>
            Suppose a run uses <InlineMath tex="N = 1" />B parameters and <InlineMath tex="D = 200" />B tokens, so{' '}
            <InlineMath tex="C \approx 6 \times 10^9 \times 2 \times 10^{11} = 1.2 \times 10^{21}" /> FLOPs. If you double
            the parameters and hold the budget, the token count must halve — and if the model was already data-starved,
            the loss gets worse, not better.
          </p>
          <p>
            That is precisely what the calculator’s “hold compute fixed” table shows: each row has the same product and a
            different split, with the best row at a particular tokens-per-parameter ratio. In the trained toy model the
            analogous effect is visible at a much smaller scale: too large a learning rate and the loss goes up even
            though every step is “learning”.
          </p>
          <p className="font-mono text-xs text-faint">
            demo check: one query–key row, masked scores {demo.scores[0]?.map((value) => (Number.isFinite(value) ? fmt(value, 2) : '−∞')).join('  ')}
          </p>
        </Prose>
      </WorkedExample>
    </>
  )
}

export function LongContextLesson() {
  const positional = useMemo(() => positionalEncoding(1024, 8), [])
  return (
    <>
      <LessonSection kicker="Concept" title="Attention is quadratic; the cache is linear">
        <Prose>
          <p>
            During prefill, every position is compared with every other position, so score computation costs{' '}
            <InlineMath tex="O(T^2 d)" /> per head. During decoding, one query is compared with all cached keys, which is{' '}
            <InlineMath tex="O(T d)" />. The asymmetry explains why long prompts are expensive once and long generations
            are expensive per token.
          </p>
          <p>
            Caching is what makes decoding feasible at all. Without it, generating token <InlineMath tex="t" /> would
            recompute keys and values for all <InlineMath tex="t-1" /> earlier positions — the same work the prefill
            already did, repeated at every step.
          </p>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="Cache size is a design decision">
        <Prose>
          <p>
            The cache stores a key and a value tensor for every layer, every key/value head and every token. For{' '}
            <InlineMath tex="L = 32" /> layers, <InlineMath tex="h_{kv} = 8" /> KV heads, head dimension{' '}
            <InlineMath tex="d_h = 128" />, <InlineMath tex="T = 4096" /> tokens at two bytes per value:
          </p>
          <DisplayMath tex="2 \times 32 \times 8 \times 128 \times 4096 \times 2 = 2^{29} \text{ bytes} = 512 \text{ MiB}" />
          <p>
            Half a gigabyte for one sequence. Grouped-query attention reduces the <InlineMath tex="h_{kv}" /> term by
            sharing key/value heads among query heads: with <InlineMath tex="h_{kv} = 8" /> and{' '}
            <InlineMath tex="h_q = 32" /> the cache is one quarter of the full multi-head cache. Multi-query attention
            takes the same idea to <InlineMath tex="h_{kv} = 1" />.
          </p>
        </Prose>
        <Callout tone="teal" title="Position interpolation in one sentence">
          A model trained on 4k tokens has never seen positional patterns for 64k; interpolation rescales positions so the
          trained range covers the longer sequence, which costs some resolution in the short range.
        </Callout>
      </LessonSection>

      <LessonSection kicker="Concept" title="What the numbers do and do not tell you">
        <Prose>
          <p>
            The formula above predicts memory for a cache of a given shape. It says nothing about throughput, which depends
            on memory bandwidth, kernel efficiency, batch scheduling and how many requests share a prefix. That is why the
            lab separates the analytic model from the local measurement.
          </p>
          <p>
            A useful sanity check: derived quantities should scale as the formula says. Halve the context and the cache
            halves. Double the layer count and it doubles. Change precision from fp16 to int8 and it halves again. If a
            calculator disagrees with those identities, the calculator is wrong.
          </p>
        </Prose>
      </LessonSection>

      <InteractiveExercise
        id="exercise"
        title="Size a cache, then measure the arithmetic"
        description="Set layers, heads, head dimension, context length, precision and batch size to see the cache size and per-token bytes update. Switch to the measurement panel to time the score computation locally and compare the measured growth with the predicted quadratic curve."
      >
        <InferenceLab view="kv-cache" />
      </InteractiveExercise>

      <WorkedExample id="worked-example" title="Four ways to shrink a cache">
        <Prose>
          <p>
            Starting from 512 MiB per sequence at 4,096 tokens with 8 KV heads, each of these changes multiplies the
            footprint:
          </p>
          <ul className="space-y-1.5">
            <li>
              int8 cache: <InlineMath tex="\times 0.5 \Rightarrow 256" /> MiB.
            </li>
            <li>
              Multi-query (<InlineMath tex="h_{kv} = 1" />): <InlineMath tex="\times \tfrac{1}{8} \Rightarrow 64" /> MiB.
            </li>
            <li>
              Halve the context to 2,048 tokens: <InlineMath tex="\times 0.5 \Rightarrow 256" /> MiB.
            </li>
            <li>
              Combine MQA and int8: <InlineMath tex="512 \times 0.5 \times 0.125 = 32" /> MiB.
            </li>
          </ul>
          <p>
            Each reduction buys capacity and costs something: precision costs fidelity, head sharing costs per-head
            expressiveness, and shorter context costs information. The last entry in the positional encoding table here
            (position 1024, first dimension){' '}
            <span className="font-mono text-xs">{fmt(positional[0], 3)}</span> is a reminder that position information
            itself has a representable range.
          </p>
        </Prose>
      </WorkedExample>
    </>
  )
}
