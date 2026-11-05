import {
  InteractiveExercise,
  LessonSection,
  Prose,
  WorkedExample,
} from '../../components/lesson/LessonChrome'
import { PromptLab } from '../../components/lab/PromptLab'
import { InferenceLab } from '../../components/lab/InferenceLab'
import { Callout } from '../../components/ui/primitives'
import { DisplayMath, InlineMath } from '../../components/ui/Math'
import { promptBudget, DEFAULT_PROMPT_PARTS, retrieve } from '../../core/retrieval'

export function DesignLesson() {
  const budget = promptBudget(DEFAULT_PROMPT_PARTS, 64)
  return (
    <>
      <LessonSection kicker="Concept" title="A prompt is a specification, not a wish">
        <Prose>
          <p>
            Everything a frozen model knows about your task at inference time is in the context window. A useful
            decomposition of that context is four parts: the <strong>instruction</strong> (what to do), the{' '}
            <strong>context</strong> (what to use), the <strong>demonstrations</strong> (what the answer should look
            like) and the <strong>output contract</strong> (what shape the answer must take).
          </p>
          <p>
            The prompt is not the only handle on the model. A foundation model has already been pre-trained on a broad
            corpus, so a prompt is a request to use what is already there rather than a way to install new knowledge.
          </p>
          <p>
            Each part competes for the same budget. The default prompt assembled in the lab uses {budget.totalTokens}{' '}
            tokens of a 64-token window, of which {budget.droppableTokens} tokens are demonstrations and retrieved text.
            Prompt engineering, at its core, is allocation under a hard constraint.
          </p>
        </Prose>
        <DisplayMath tex="\underbrace{x_{\text{sys}}}_{\text{instruction}} \; \underbrace{x_{\text{demos}}}_{\text{examples}} \; \underbrace{x_{\text{ctx}}}_{\text{retrieved}} \; \underbrace{x_{\text{q}}}_{\text{question}} \; \rightarrow \; y" />
      </LessonSection>

      <LessonSection kicker="Concept" title="In-context learning is conditioning">
        <Prose>
          <p>
            No parameters change during inference. Demonstrations influence the output because they are part of the
            sequence the model conditions on: the conditional distribution of the next token shifts toward the pattern
            the examples establish. This is why a handful of examples can “teach” a format, and why the effect disappears
            the moment the examples fall out of the context window.
          </p>
          <p>
            It also explains the failure modes. If the demonstrations are inconsistent with each other, the model
            interpolates. If the demonstration labels are wrong, the model faithfully reproduces the errors. If the task
            requires knowledge the model does not have, no number of examples will supply it.
          </p>
        </Prose>
        <Callout tone="indigo" title="Zero-shot, one-shot, few-shot">
          The naming describes how many demonstrations precede the question. More demonstrations usually help with format
          adherence and hurt when they consume the space needed for context.
        </Callout>
      </LessonSection>

      <LessonSection kicker="Concept" title="Diagnosing a bad prompt">
        <Prose>
          <p>
            Most prompt failures are specification failures, and they are diagnosable:
          </p>
          <ul className="space-y-2">
            <li>
              <strong className="text-fg">Ambiguity</strong> — two instructions demand incompatible outputs (“one word”
              and “explain in detail”). The model must guess which to satisfy.
            </li>
            <li>
              <strong className="text-fg">Missing contract</strong> — no format is specified, so the answer is a
              paragraph when a value was needed.
            </li>
            <li>
              <strong className="text-fg">Context exhaustion</strong> — the actual question is pushed out of the window by
              examples and retrieved text.
            </li>
            <li>
              <strong className="text-fg">Unstated audience</strong> — “summarise this” means something different to a
              researcher and an executive.
            </li>
          </ul>
        </Prose>
      </LessonSection>

      <InteractiveExercise
        id="exercise"
        title="Compose a prompt and watch the budget"
        description="Edit each part of the prompt and watch the real token counts, the window utilisation and the truncation point. Then drop the droppable parts and check whether the required content still fits."
      >
        <PromptLab view="budget" />
      </InteractiveExercise>

      <WorkedExample id="worked-example" title="Budget arithmetic for a small window">
        <Prose>
          <p>
            With the default prompt, the tokenizer counts {budget.parts.map((part) => `${part.label.toLowerCase()} ${part.tokens}`).join(', ')} —
            a total of <InlineMath tex={`${budget.totalTokens}`} /> tokens. Against a 64-token window that is{' '}
            <InlineMath tex={`${(budget.utilisation * 100).toFixed(0)}\\%`} /> utilisation, so nothing is dropped.
          </p>
          <p>
            Shrink the window to 32 tokens and the same prompt exceeds it by{' '}
            <InlineMath tex={`${Math.max(0, budget.totalTokens - 32)}`} /> tokens. Dropping the {budget.droppableTokens}{' '}
            droppable tokens may restore fit — and if it does not, the instruction itself must be rewritten. Note what
            that means in practice: a smaller model is not the only constraint; a smaller window changes which prompting
            strategies are even possible.
          </p>
        </Prose>
      </WorkedExample>
    </>
  )
}

export function CotLesson() {
  return (
    <>
      <LessonSection kicker="Concept" title="Computation per token is fixed">
        <Prose>
          <p>
            A decoder performs a fixed number of operations per generated token. If a problem needs more sequential
            computation than one forward pass provides, asking the model to produce intermediate steps gives it more
            computation: every generated token is another pass through the network, conditioned on everything written so
            far.
          </p>
          <p>
            This is the mechanism behind chain-of-thought prompting. It is not that the model “needs to see its own
            reasoning”; it is that writing steps converts one hard computation into a sequence of easier ones, each able
            to use the previous result.
          </p>
        </Prose>
        <Callout tone="indigo" title="A testable prediction">
          If chain of thought works by adding computation, then restricting the trace length should hurt on tasks that
          need multi-step computation, and a model with more layers per token should need shorter traces for the same
          task. Both predictions have been empirically supported.
        </Callout>
      </LessonSection>

      <LessonSection kicker="Concept" title="Decomposition and self-refinement">
        <Prose>
          <p>
            Decomposition splits one hard step into several easier, individually checkable steps. Self-refinement adds a
            revision pass. The crucial difference between them and “think harder” is verifiability: a decomposed step can
            be checked by a calculation, a unit test or a retrieval lookup, whereas a vague instruction cannot.
          </p>
          <p>
            Self-refinement without an external signal is mostly re-sampling. If the second attempt uses the same context
            and the same weights, it draws from the same distribution; when it changes the answer, it is not necessarily
            improving it.
          </p>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="Search, verification and the cost of thinking">
        <Prose>
          <p>
            Once steps are explicit, they can be searched. Generating several candidate paths and selecting with a
            verifier is search with a learned heuristic; keeping the best <InlineMath tex="b" /> partial solutions alive
            is beam search. The accounting is what matters: a strategy is only better if it buys accuracy at an acceptable
            number of verifier calls and generated tokens.
          </p>
          <DisplayMath tex="\text{accuracy} = \Pr\!\left(\exists\, \hat{y} \in \text{candidates}(C) : \text{verify}(\hat{y}) = \text{pass}\right)" />
        </Prose>
      </LessonSection>

      <InteractiveExercise
        id="exercise"
        title="Compare greedy, beam and best-of-n"
        description="Run three strategies on the same reasoning tree. Watch greedy commit early to the branch that looks best at the first step, then see whether a wider beam or more samples recovers the correct path — and at what cost in verifier calls."
      >
        <InferenceLab view="search" />
      </InteractiveExercise>

      <WorkedExample id="worked-example" title="Where greedy fails on the toy tree">
        <Prose>
          <p>
            At the first step the branches score 0.75 (wrong, confident), 0.60 (correct, unremarkable), 0.50 and 0.40.
            Greedy keeps only the 0.75 branch. Two steps later that branch terminates at 0.90 — but the correct branch
            reaches 0.97, and greedy never sees it.
          </p>
          <p>
            A beam of two keeps 0.75 and 0.60 alive; at the next depth the 0.60 branch expands to 0.82 and then 0.97,
            overtaking the trap. The extra verifier calls are the price of not committing too early — exactly the trade-off
            the lab table reports.
          </p>
        </Prose>
      </WorkedExample>
    </>
  )
}

export function RagLesson() {
  const retrieval = retrieve('attention scores and the kv cache', undefined, 3, 0)
  return (
    <>
      <LessonSection kicker="Concept" title="Retrieval converts an open-book question into a closed-book one">
        <Prose>
          <p>
            A model can only use information in its parameters or its context. Retrieval bridges the gap at run time:
            rank a document collection against the query, place the best passages into the prompt, and let the generator
            condition on them. The pipeline is prompt assembly with a search step in front.
          </p>
          <p>
            The quality of the result depends on both halves. A generator that ignores retrieved text produces the same
            answer as before; a retriever that returns irrelevant passages actively hurts, because the context window is
            finite and plausible-looking noise displaces useful information.
          </p>
        </Prose>
      </LessonSection>

      <LessonSection kicker="Concept" title="Similarity search is arithmetic">
        <Prose>
          <p>
            Documents and queries are projected into the same vector space, and ranking is a cosine similarity — the dot
            product normalised by both magnitudes.
          </p>
          <DisplayMath tex="\cos(u, v) = \frac{u \cdot v}{\lVert u \rVert \, \lVert v \rVert}" />
          <p>
            In the lab, documents are described by a hand-written six-axis keyword vector. That makes the mechanism
            inspectable, and it makes a limit explicit: the retrieval can only be as good as the vectors. Production
            systems learn those vectors, which is why retrieval quality is an embedding-model question, not just a
            nearest-neighbour question.
          </p>
        </Prose>
        <Callout tone="amber" title="The honest framing of the toy retriever">
          Nothing here is a neural embedding model. The query vector is a lexical projection onto axis names, and the
          document vectors are authored by hand. The cosine similarities are exact for that representation, and the
          ranking behaviour — which passage wins and why — is faithful to how a real retriever is scored.
        </Callout>
      </LessonSection>

      <LessonSection kicker="Concept" title="Tools and learned prompts">
        <Prose>
          <p>
            Tool use extends the same idea: instead of text, the model emits a structured call, and the result returns as
            context. The contract matters more than the wording — a tool call is a small program, and malformed arguments
            fail regardless of how fluent the model is.
          </p>
          <p>
            Prompt optimisation occupies a different regime. A soft prompt is a learned continuous vector prepended to
            the input; it is a parameter, not text. Discrete prompt search, by contrast, keeps the prompt readable and
            trades compute for quality. The two approaches differ in interpretability and in how the artefact is stored.
          </p>
        </Prose>
      </LessonSection>

      <InteractiveExercise
        id="exercise"
        title="Score passages and assemble the context"
        description="Type a query and watch cosine similarities rank the toy document set. Adjust the top-k and the score threshold, then inspect the assembled prompt: this is exactly the text a generator would condition on."
      >
        <PromptLab view="retrieval" />
      </InteractiveExercise>

      <WorkedExample id="worked-example" title="Ranking two passages against one query">
        <Prose>
          <p>
            For the query <span className="font-mono text-fg">attention scores and the kv cache</span>, the lab scores the
            attention document at {retrieval.scores.find((s) => s.id === 'doc-attention')?.score.toFixed(4)} and the
            long-context memory document at{' '}
            {retrieval.scores.find((s) => s.id === 'doc-longcontext')?.score.toFixed(4)}.
          </p>
          <p>
            Both score highly because the query activates the attention axis and the inference axis, and the neighbour
            expansion gives partial credit to related axes. Adjust the threshold to 0.8 and only the very best passage
            survives; that is the knob that trades context budget against recall.
          </p>
        </Prose>
      </WorkedExample>
    </>
  )
}
