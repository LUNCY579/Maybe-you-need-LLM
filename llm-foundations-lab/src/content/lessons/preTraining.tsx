import { useMemo } from 'react'
import {
  InteractiveExercise,
  LessonSection,
  Prose,
  WorkedExample,
} from '../../components/lesson/LessonChrome'
import { TokenizerLab } from '../../components/lab/TokenizerLab'
import { Callout } from '../../components/ui/primitives'
import { DisplayMath, InlineMath } from '../../components/ui/Math'
import { tokenize } from '../../core/tokenizer'

export function WhyLesson() {
  return (
    <>
      <LessonSection kicker="Concept" title="Three ways to obtain supervision">
        <Prose>
          <p>
            Pre-training is the process of optimising a neural network on a general objective before anyone knows which
            task it will eventually perform. The book frames it as two separate concerns: first fit parameters{' '}
            <InlineMath tex="\theta" /> on the general objective, then adapt the resulting model{' '}
            <InlineMath tex="\hat{g}(\cdot)" /> to downstream tasks by fine-tuning or prompting.
          </p>
          <p>
            What changed the field was not the idea of pre-training — that is decades old — but the source of the
            supervision signal:
          </p>
        </Prose>
        <ul className="space-y-3 text-sm leading-relaxed text-muted">
          <li>
            <strong className="text-fg">Unsupervised pre-training.</strong> Optimise a criterion that is not tied to any
            task at all, for example reconstructing inputs layer by layer. It helps optimisation and regularisation, but
            does not by itself teach language.
          </li>
          <li>
            <strong className="text-fg">Supervised pre-training.</strong> Train on a large labelled task such as sentiment
            classification, then swap the head and fine-tune. Effective, but it inherits the cost of labelled data.
          </li>
          <li>
            <strong className="text-fg">Self-supervised pre-training.</strong> Construct targets from the text itself:
            hide part of the input and predict it, or predict the next token. The supervision signal scales with the
            corpus rather than with human effort, which is why it produced foundation models.
          </li>
        </ul>
      </LessonSection>

      <LessonSection kicker="Concept" title="Why the objective matters more than the architecture">
        <Prose>
          <p>
            A pre-training objective defines what the model is rewarded for. Predict the next token and you build a
            generator; reconstruct masked tokens from both sides of context and you build an encoder that represents
            text well but cannot generate it fluently; corrupt spans and regenerate them and you build a
            sequence-to-sequence system. The same Transformer stack supports all three — the objective is what decides
            which capabilities emerge.
          </p>
          <p>
            That choice also determines the kind of data the model can use. Next-token prediction consumes text
            left-to-right, so it needs no annotation and can process any corpus. Masked-token prediction needs only the
            text plus a masking procedure. The data requirements are therefore almost identical; the difference is in the
            product.
          </p>
        </Prose>
        <Callout tone="indigo" title="A precise statement of what pre-training does not do">
          Pre-training does not encode a task. It produces a distribution over text and a set of internal
          representations. Instruction following, refusal behaviour and question answering are all imposed later, by
          fine-tuning, preference learning or prompting.
        </Callout>
      </LessonSection>

      <InteractiveExercise
        id="exercise"
        title="Predict the segmentation before you look"
        description="Before anything else, work out what a tokenizer will do to a sentence. Count the units yourself, commit to an answer, and then check it against the tokenizer. The number is computed, never stored, so the exercise and the figures cannot disagree."
      >
        <TokenizerLab view="predict" />
      </InteractiveExercise>

      <InteractiveExercise
        title="Inspect a self-supervised target"
        description="Take one sentence, apply the next-token objective and see the exact input/target pairs the loss would be computed on. Then switch to the masking and span-corruption views to compare the three families on the same text."
      >
        <TokenizerLab view="self-supervision" />
      </InteractiveExercise>

      <WorkedExample id="worked-example" title="How many training targets does one sentence carry?">
        <Prose>
          <p>
            Take one short sentence: <span className="font-mono text-fg">the model learns from the text</span> — six
            words after tokenization with our demonstrative tokenizer. Next-token prediction creates one target per
            position that has a successor, so the count is:
          </p>
          <DisplayMath tex="\text{targets} = m - 1 = 6 - 1 = 5" />
          <p>
            Each target is a (context, next token) pair, so the loss has five terms. BERT-style masking at 15% selects{' '}
            <InlineMath tex="\lceil 0.15 \times 6 \rceil = 1" /> position in a sentence this short, which is one of the
            reasons masking is used on longer documents: on short sequences the target density is very low.
          </p>
          <p>
            The multiplication that matters is at corpus scale. A one-trillion-token corpus yields roughly one trillion
            next-token predictions, versus the thousands of examples a small labelled dataset provides.
          </p>
        </Prose>
      </WorkedExample>
    </>
  )
}

export function ObjectivesLesson() {
  const sentence = 'the model learns from text'
  const units = useMemo(() => tokenize(sentence, { mode: 'word' }).tokens.map((t) => t.text), [])
  return (
    <>
      <LessonSection kicker="Concept" title="Decoder-only: predict the next token">
        <Prose>
          <p>
            A decoder-only model factorises the probability of a sequence into per-token conditionals and trains by
            maximising their product:
          </p>
          <DisplayMath tex="\Pr(x_0, \dots, x_m) = \prod_{i} \Pr(x_i \mid x_0, \dots, x_{i-1})" />
          <p>
            Only previous tokens are visible, which is enforced by the causal mask discussed in Module 2. The important
            property is that training and inference perform the same operation: at generation time the model predicts one
            token given a prefix, exactly as it did during training.
          </p>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="Encoder-only: reconstruct what was hidden">
        <Prose>
          <p>
            An encoder-only model corrupts the input and reconstructs the corrupted positions using the full surrounding
            context. The objective only counts masked positions, so the loss is sparse but each term is well conditioned.
          </p>
          <DisplayMath tex="\mathcal{L}_{\text{MLM}}(\theta) = -\sum_{i \in \mathcal{M}} \log \Pr_\theta\!\left(x_i \mid \tilde{x}\right)" />
          <p>
            Because the objective conditions on both directions, it produces strong representations for classification,
            extraction and ranking. It also means the model expects a corrupted input, which is why it does not generate
            text the way a decoder does.
          </p>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="Encoder–decoder: reconstruct spans">
        <Prose>
          <p>
            Span corruption deletes contiguous chunks and asks the decoder to regenerate them, conditioned on the
            corrupted source. The corruption is less local than single-token masking and the target is a whole sequence,
            which makes the objective a genuine sequence-to-sequence task and suits translation, summarisation and
            question answering over long context.
          </p>
        </Prose>
        <Callout tone="teal" title="Choosing a family is a product decision">
          If you need to generate text, start with a decoder. If you need a fixed-length representation for a
          classification or retrieval pipeline, an encoder is usually smaller and cheaper. If your task is naturally
          input→output with a differing output length, an encoder–decoder matches the shape.
        </Callout>
      </LessonSection>

      <InteractiveExercise
        id="exercise"
        title="One sentence, three objectives"
        description="The same text is processed three ways: as next-token targets, as a masked-token reconstruction problem and as a span-corruption problem. Compare the number of loss terms each objective produces."
      >
        <TokenizerLab view="objectives" />
      </InteractiveExercise>

      <WorkedExample id="worked-example" title="Counting loss terms on a six-token sentence">
        <Prose>
          <p>
            For <span className="font-mono text-fg">{sentence}</span>, the demonstrative tokenizer produces{' '}
            {units.length} units: <span className="font-mono text-fg">{units.join(' · ')}</span>.
          </p>
          <ul className="space-y-1.5">
            <li>
              Next-token: <InlineMath tex="6 - 1 = 5" /> loss terms (one per position with a successor).
            </li>
            <li>
              Masked token at 15%: <InlineMath tex="\lceil 6 \times 0.15 \rceil = 1" /> term.
            </li>
            <li>
              Span corruption of one two-token span: 1 term, but that term is a two-token sequence loss, so it is really{' '}
              <InlineMath tex="2" /> sub-terms over the regenerated span.
            </li>
          </ul>
          <p>
            Same data, different supervision density and different geometry — that is the whole comparison in one line.
          </p>
        </Prose>
      </WorkedExample>
    </>
  )
}

export function BertLesson() {
  const [masked] = useMemo(() => tokenize('the model learns from text', { mode: 'word' }).tokens, [])
  return (
    <>
      <LessonSection kicker="Concept" title="The masking recipe">
        <Prose>
          <p>
            BERT selects roughly 15% of positions and, for each selected position, replaces the token with{' '}
            <span className="font-mono">[MASK]</span> 80% of the time, with a random vocabulary token 10% of the time,
            and leaves it unchanged 10% of the time. The loss is computed at all selected positions — the model must
            recover the original token in every case.
          </p>
          <p>
            The mixture exists because <span className="font-mono">[MASK]</span> never appears in real input. If every
            selected position were masked, the encoder would learn to condition on a symbol that is absent at fine-tuning
            time. Leaving the true token or a random token in place keeps the model honest about unmasked input.
          </p>
        </Prose>
        <Callout tone="amber" title="A frequently misread detail">
          15% is the fraction of positions <em>selected</em>, not the fraction replaced by{' '}
          <span className="font-mono">[MASK]</span>. In the book’s description only about 12% of tokens end up as{' '}
          <span className="font-mono">[MASK]</span>, because the other 20% of selections are handled differently.
        </Callout>
      </LessonSection>

      <LessonSection kicker="Concept" title="Special tokens and task heads">
        <Prose>
          <p>
            BERT prepends a special classification token <span className="font-mono">[CLS]</span> and separates sequences
            with <span className="font-mono">[SEP]</span>. After pre-training, the pooled representation of{' '}
            <span className="font-mono">[CLS]</span> — or a sequence of token representations, depending on the task —
            feeds a small task-specific head that is trained on labelled data.
          </p>
          <p>
            This is the adaptation recipe in its simplest form: the encoder provides representations, the head provides
            the decision, and fine-tuning adjusts both slightly. For sentence classification the head is essentially a
            softmax layer over the pooled representation.
          </p>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="What masked pre-training cannot do">
        <Prose>
          <p>
            A masked language model has never been asked to continue text. Asking it to do so means running it out of
            distribution, and the result is typically incoherent. Likewise, the model has no notion of an autoregressive
            generation loop, no KV cache and no decode phase.
          </p>
          <p>
            This is a clean illustration of the general principle: the pre-training objective determines which downstream
            behaviours can be obtained cheaply. Anything outside the objective must be obtained by fine-tuning on the
            right data or by prompting a model that was trained for it.
          </p>
        </Prose>
      </LessonSection>

      <InteractiveExercise
        id="exercise"
        title="Apply the masking recipe yourself"
        description="Choose a masking rate and seed, and watch which positions are selected and how each one is corrupted. The counts update with the recipe described above, and the seed makes every run reproducible."
      >
        <TokenizerLab view="masking" />
      </InteractiveExercise>

      <WorkedExample id="worked-example" title="A six-token sentence, masked">
        <Prose>
          <p>
            With the demonstrative tokenizer, <span className="font-mono text-fg">the model learns from text</span> is six
            units. At a 15% selection rate the expected number of selected positions is{' '}
            <InlineMath tex="6 \times 0.15 = 0.9" />, so most short sentences have zero or one prediction target. At 15%
            selection, the expected number of <span className="font-mono">[MASK]</span> tokens is{' '}
            <InlineMath tex="0.9 \times 0.8 = 0.72" />.
          </p>
          <p>
            That arithmetic explains a practical detail: masked pre-training is usually run on sequences of hundreds of
            tokens, where the target count per sequence is meaningful. It also explains why the first token{' '}
            <span className="font-mono">{masked?.text ?? 'the'}</span> is not special-cased — every position except the
            ones the recipe selects is simply context.
          </p>
        </Prose>
      </WorkedExample>
    </>
  )
}
