/**
 * Retrieval: getting the right passage into the window.
 *
 * Chapter 12 builds the retrieval-augmented pipeline, and Chapter 9 bounds
 * it: the window is finite, and everything the retriever puts in it has to
 * come out of the same budget. The chapter therefore has a shape that is easy
 * to read and easy to get wrong:
 *
 *  - **Recall is not enough.** A passage that was retrieved but never used
 *    is the same as a passage that was not retrieved at all. And a passage
 *    that *is* used is not used equally everywhere: Liu et al. (2023) measured
 *    a U-shaped curve, in which a model uses the beginning and the end of a
 *    long context best and the middle worst.
 *  - **More context is not monotonically better.** Raising the number of
 *    retrieved passages raises recall, and it also pushes the decisive
 *    passage towards the middle of the window, where it is used least well.
 *  - **How the passages are selected matters as much as how many.** A
 *    cross-encoder reranker reads the query and the passage together and can
 *    promote a passage the bi-encoder scored poorly. A diversity-first
 *    selection avoids near-duplicates, and can push the decisive passage out
 *    to make room for a different wording of the same thing.
 *
 * This engine makes those three statements computable. It is deterministic:
 * no model is called, and the same inputs always give the same answer.
 */

/** How the passages are chosen for the window. */
export type RetrievalStrategy = 'bi-encoder' | 'rerank' | 'diverse'

export const RETRIEVAL_STRATEGIES: { value: RetrievalStrategy; label: string; description: string }[] = [
  {
    value: 'bi-encoder',
    label: 'Bi-encoder (similarity only)',
    description:
      'The usual first stage: embed the query and each passage separately and take the closest. Fast, and blind to the passage in isolation.',
  },
  {
    value: 'rerank',
    label: 'Rerank with a cross-encoder',
    description:
      'Rescore the candidates with a model that reads the query and the passage together. Slower, and much better at telling a passage that answers the question from one that shares its vocabulary.',
  },
  {
    value: 'diverse',
    label: 'Select for diversity',
    description:
      'Prefer passages that say different things, the way maximal marginal relevance does. It avoids filling the window with the same point in four wordings.',
  },
]

export interface Passage {
  id: string
  label: string
  /** A short excerpt, so the student can read what was retrieved. */
  text: string
  /** The bi-encoder's similarity to the query. */
  similarity: number
  /** The cross-encoder's judgement, used by the reranking strategy. */
  rerank: number
  /** Whether this passage contains the answer. */
  relevant: boolean
  /** How close this passage is to the others, for the diversity strategy. */
  topic: string
}

export interface RetrievalCase {
  id: string
  title: string
  question: string
  passages: Passage[]
  /** The answer, when the decisive passage reaches the model. */
  answer: string
  /** The answer the model gives when it does not. */
  distractedAnswer: string
  /** The note about what the case is for. */
  note: string
}

export interface SelectedPassage {
  passage: Passage
  /** Its position in the window, 0-based. */
  position: number
  /**
   * How strongly the model attends to a passage in this position.
   *
   * The U-shaped curve Liu et al. measured: the ends of a context are used
   * best, the middle worst. With one passage in the window there is no
   * middle, so it counts as fully attended.
   */
  salience: number
}

export interface RetrievalOutcome {
  /** The passages in the window, in the order they were placed. */
  selected: SelectedPassage[]
  /** The passages that were not retrieved. */
  missed: Passage[]
  /** True when the decisive passage reached the window. */
  recalled: boolean
  /** True when the model used the decisive passage. */
  used: boolean
  /** The answer the model gives. */
  answer: string
  /** Whether the answer is right. */
  correct: boolean
  /** The decisive passage's position, when it was recalled. */
  decisivePosition: number | null
  /** One sentence on what happened. */
  explanation: string
  /** The salience of every position in the window, for drawing the curve. */
  curve: number[]
}

/**
 * How strongly a model attends to a passage at a given position.
 *
 * The shape is the one Liu et al. (2023) measured: performance is highest
 * when the relevant information is at the very beginning or the very end of
 * the context, and degrades towards the middle.
 */
export function salienceAt(position: number, length: number): number {
  if (length <= 1) return 1
  // The offset is zero in the middle of the window and largest at its ends,
  // so its square is the U: full attention at the beginning and the end,
  // none in the middle.
  const offset = (2 * position - (length - 1)) / (length - 1)
  return offset * offset
}

/**
 * Choose the passages for the window.
 *
 * The three strategies differ only in the order they choose things in:
 *
 *  - the bi-encoder takes the closest passages by similarity;
 *  - the reranker takes the closest by the cross-encoder's judgement, which
 *    is not the same order — the decisive passage is often not the one the
 *    bi-encoder scored highest;
 *  - the diversity strategy takes the closest, then swaps a passage for a
 *    near-duplicate of one already chosen only if there is a *different*
 *    topic available, so it can pull in the decisive passage when the
 *    top-ranked passages are all about the same thing.
 */
function choosePassages(scenario: RetrievalCase, k: number, strategy: RetrievalStrategy): Passage[] {
  const bySimilarity = [...scenario.passages].sort((a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id))

  if (strategy === 'rerank') {
    return [...scenario.passages].sort((a, b) => b.rerank - a.rerank || a.id.localeCompare(b.id)).slice(0, k)
  }

  if (strategy === 'diverse') {
    // Take the closest, then replace a passage with another one on a
    // different topic when the window is full of the same subject.
    const chosen: Passage[] = []
    const topics = new Set<string>()
    for (const candidate of bySimilarity) {
      if (chosen.length >= k) break
      chosen.push(candidate)
      topics.add(candidate.topic)
    }
    // If everything chosen is about one topic, look for the best passage on
    // a different topic and swap it in for the last one.
    if (topics.size === 1) {
      const alternative = bySimilarity.find((candidate) => candidate.topic !== [...topics][0])
      if (alternative) {
        chosen[chosen.length - 1] = alternative
      }
    }
    return chosen
  }

  return bySimilarity.slice(0, k)
}

/**
 * Put the chosen passages in the window and see whether the model used them.
 */
export function retrieve(
  scenario: RetrievalCase,
  k: number,
  strategy: RetrievalStrategy,
): RetrievalOutcome {
  const selected = choosePassages(scenario, k, strategy)
  const placed: SelectedPassage[] = selected.map((passage, position) => ({
    passage,
    position,
    salience: salienceAt(position, selected.length),
  }))

  const decisive = scenario.passages.find((passage) => passage.relevant)
  const decisiveEntry = decisive ? placed.find((entry) => entry.passage.id === decisive.id) : undefined
  const recalled = Boolean(decisiveEntry)
  // A passage that was retrieved but landed in the middle of the window is
  // retrieved and not used, which is the whole point.
  const used = Boolean(decisiveEntry && decisiveEntry.salience >= 0.5)

  const missed = scenario.passages.filter(
    (passage) => !placed.some((entry) => entry.passage.id === passage.id),
  )

  let explanation: string
  if (!recalled) {
    explanation =
      strategy === 'rerank'
        ? 'The decisive passage was not retrieved, even with the reranker. No amount of reordering helps if the candidate never made the list.'
        : strategy === 'diverse'
          ? 'The decisive passage was crowded out by passages on other topics. Selecting for diversity is not free.'
          : 'The decisive passage was not in the top results. The question of what to do with it never arose.'
  } else if (!used) {
    explanation =
      'The decisive passage was retrieved, but it landed in the middle of the window — and the middle is where a model attends least. It was in the prompt and it was not in the answer.'
  } else {
    explanation =
      'The decisive passage was retrieved and landed where the model attends most. The answer follows.'
  }

  return {
    selected: placed,
    missed,
    recalled,
    used,
    answer: used ? scenario.answer : scenario.distractedAnswer,
    correct: used,
    decisivePosition: decisiveEntry?.position ?? null,
    explanation,
    curve: placed.map((entry) => entry.salience),
  }
}

/* ------------------------------------------------------------------ */
/* Cases                                                               */
/* ------------------------------------------------------------------ */

export const RETRIEVAL_CASES: RetrievalCase[] = [
  {
    id: 'refund-policy',
    title: 'The refund policy',
    question: 'How many days does a customer have to return an item for a refund?',
    passages: [
      {
        id: 'p-shipping',
        label: 'Shipping times',
        text: 'Standard delivery takes three to five working days. Express delivery is next working day where available.',
        similarity: 0.71,
        rerank: 0.21,
        relevant: false,
        topic: 'shipping',
      },
      {
        id: 'p-warranty',
        label: 'Warranty',
        text: 'All hardware carries a two-year warranty against manufacturing defects. Accidental damage is not covered.',
        similarity: 0.68,
        rerank: 0.33,
        relevant: false,
        topic: 'warranty',
      },
      {
        id: 'p-returns',
        label: 'Returns and refunds',
        text: 'Customers may return any unused item within 30 days of delivery for a full refund. The 30 days run from the delivery date, not the order date.',
        similarity: 0.64,
        rerank: 0.95,
        relevant: true,
        topic: 'returns',
      },
      {
        id: 'p-exchanges',
        label: 'Exchanges',
        text: 'An exchange for a different size is treated as a return and a new order. There is no charge for the first exchange.',
        similarity: 0.62,
        rerank: 0.44,
        relevant: false,
        topic: 'returns',
      },
      {
        id: 'p-contact',
        label: 'Contacting us',
        text: 'Our support team answers within one working day. We are closed on public holidays in the country of purchase.',
        similarity: 0.58,
        rerank: 0.09,
        relevant: false,
        topic: 'contact',
      },
      {
        id: 'p-invoice',
        label: 'Invoices',
        text: 'Invoices are issued at the point of sale and list the VAT rate applied. A copy is available in the account area.',
        similarity: 0.55,
        rerank: 0.07,
        relevant: false,
        topic: 'billing',
      },
      {
        id: 'p-fraud',
        label: 'Fraud checks',
        text: 'Orders flagged by the fraud service are held for manual review, which usually takes one to two days.',
        similarity: 0.51,
        rerank: 0.05,
        relevant: false,
        topic: 'fraud',
      },
      {
        id: 'p-gift',
        label: 'Gift receipts',
        text: 'A gift receipt can be issued for any purchase. It shows the price paid but not the item, so it cannot be returned against.',
        similarity: 0.48,
        rerank: 0.06,
        relevant: false,
        topic: 'billing',
      },
    ],
    answer:
      'Thirty days from delivery. The window runs from the delivery date, not the order date, so the two can be weeks apart.',
    distractedAnswer:
      'There is no fixed window — returns are handled case by case, and the support team will confirm what is possible.',
    note:
      'The decisive passage is third by similarity, not first. A bi-encoder that takes the top one never sees it; a cross-encoder that reads the passage with the question finds it immediately.',
  },
  {
    id: 'migration-guide',
    title: 'The migration guide',
    question: 'How do I roll back a failed schema migration?',
    passages: [
      {
        id: 'm-connect',
        label: 'Connecting',
        text: 'The client reads its connection string from the environment. TLS is required for anything other than a local socket.',
        similarity: 0.74,
        rerank: 0.12,
        relevant: false,
        topic: 'connect',
      },
      {
        id: 'm-backup',
        label: 'Backups',
        text: 'A snapshot is taken before every migration and retained for seven days. Restoring one is a separate operation from rolling back.',
        similarity: 0.71,
        rerank: 0.62,
        relevant: false,
        topic: 'backup',
      },
      {
        id: 'm-migrate',
        label: 'Running a migration',
        text: 'Migrations run forward only. Each one is applied in a transaction, so a failure leaves the schema at the previous version.',
        similarity: 0.69,
        rerank: 0.55,
        relevant: false,
        topic: 'migrate',
      },
      {
        id: 'm-rollback',
        label: 'Rolling back',
        text: 'To reverse a migration, run the down script: `migrate down --to <version>`. It refuses to run if any data written since the migration depends on the new columns.',
        similarity: 0.52,
        rerank: 0.96,
        relevant: true,
        topic: 'rollback',
      },
      {
        id: 'm-index',
        label: 'Indexes',
        text: 'Creating an index on a large table takes a lock. Use the concurrent option on production tables.',
        similarity: 0.49,
        rerank: 0.18,
        relevant: false,
        topic: 'index',
      },
      {
        id: 'm-locks',
        label: 'Locks',
        text: 'A long-running transaction blocks every writer. The lock timeout is one second by default.',
        similarity: 0.46,
        rerank: 0.31,
        relevant: false,
        topic: 'locks',
      },
      {
        id: 'm-logging',
        label: 'Logging',
        text: 'Every statement is written to the query log with its duration. The log is rotated nightly.',
        similarity: 0.43,
        rerank: 0.08,
        relevant: false,
        topic: 'logging',
      },
    ],
    answer:
      'Run the down script: `migrate down --to <version>`. It refuses to reverse a migration if data written since depends on the new columns.',
    distractedAnswer:
      'A migration cannot be reversed. Restore the database from the snapshot taken before the migration and start again.',
    note:
      'The rollback passage is fourth by similarity. Raise the number of retrieved passages and it is retrieved — and then it lands in the middle of the window, where it is used least.',
  },
  {
    id: 'meeting-notes',
    title: 'The meeting notes',
    question: 'What did the team decide about the launch date?',
    passages: [
      {
        id: 'n-agenda',
        label: 'Agenda',
        text: 'The meeting covered the launch date, the pricing change, and the support rota, in that order.',
        similarity: 0.77,
        rerank: 0.28,
        relevant: false,
        topic: 'agenda',
      },
      {
        id: 'n-date-1',
        label: 'Launch date, first mention',
        text: 'Priya asked whether the launch date could move again, since the last two dates had slipped.',
        similarity: 0.74,
        rerank: 0.41,
        relevant: false,
        topic: 'date',
      },
      {
        id: 'n-pricing',
        label: 'Pricing',
        text: 'The pricing change was deferred to the following quarter. Revenue impact was not modelled.',
        similarity: 0.71,
        rerank: 0.09,
        relevant: false,
        topic: 'pricing',
      },
      {
        id: 'n-date-2',
        label: 'Launch date, second mention',
        text: 'Tom noted that the launch date depends on the payment provider integration, which is not scheduled until November.',
        similarity: 0.69,
        rerank: 0.52,
        relevant: false,
        topic: 'date',
      },
      {
        id: 'n-date-3',
        label: 'Launch date, the decision',
        text: 'The team decided to hold the launch on 4 November, on the condition that the payment provider integration completes by 1 November.',
        similarity: 0.66,
        rerank: 0.97,
        relevant: true,
        topic: 'date',
      },
      {
        id: 'n-rota',
        label: 'Support rota',
        text: 'The support rota now runs seven days a week from the launch date. Two more people are needed.',
        similarity: 0.64,
        rerank: 0.11,
        relevant: false,
        topic: 'support',
      },
      {
        id: 'n-actions',
        label: 'Actions',
        text: 'Actions: confirm the venue by Friday, circulate the revised deck, and book the photographer.',
        similarity: 0.61,
        rerank: 0.07,
        relevant: false,
        topic: 'actions',
      },
      {
        id: 'n-date-4',
        label: 'Launch date, third mention',
        text: 'Asked again about the launch date, the team said a decision would be recorded in the notes.',
        similarity: 0.59,
        rerank: 0.47,
        relevant: false,
        topic: 'date',
      },
    ],
    answer: 'The launch is held on 4 November, provided the payment provider integration is finished by 1 November.',
    distractedAnswer:
      'The notes record that the launch date was discussed but no decision was taken; the date depends on the payment provider integration.',
    note:
      'Three passages are about the launch date and only one of them is the decision. Selecting for diversity pulls in the other two and pushes the decisive one out — the cost of avoiding repetition.',
  },
]

export const RETRIEVAL_CASE_BY_ID = new Map(RETRIEVAL_CASES.map((entry) => [entry.id, entry]))
