/**
 * The context window, and what happens when it is too small.
 *
 * Two sections of the textbook make the same point from different directions:
 *
 *  - §6.2.2: "All information for the query must be specified in a context
 *    window. The size of this context window is limited, which fundamentally
 *    limits the amount of information that can be communicated to the LLM for
 *    a query." The remedies it lists are retrieval augmentation, longer
 *    windows (at quadratic cost), and compression.
 *  - §9.3.2.2: the standard chatbot approach is to "provide a truncated form
 *    of the chat-history to the LLM". The alternatives are compression
 *    schemes — chunking, filtering unnecessary tokens, summarising — and
 *    §9.3.2.3 adds explicit memory management, where read and write are
 *    operations the agent performs (MemGPT, MCP).
 *
 * The hard part is not knowing the policies. It is seeing what each one costs,
 * because three of them can lose the *decisive* fact while looking perfectly
 * reasonable:
 *
 *  - **Truncation** drops the oldest material. If the decisive fact arrived
 *    early, it is gone.
 *  - **Relevance** keeps what looks related to the goal. It can keep the
 *    decisive fact and discard the rest of the document with it.
 *  - **Compression** keeps everything, in shortened form. The summary reads
 *    well and the *number* is missing.
 *  - **Paging out** loses nothing — the material is still in an external
 *    store — but the agent can retrieve only one item per turn, and it may
 *    retrieve the wrong one.
 *  - **Learned compression** replaces the hand-written rule with a scorer
 *    trained on other windows (§9.3.2.2; Gist, Mu et al. 2023). It inherits
 *    the caveat rather than escaping it: it is trained to predict which
 *    material *looks* like it matters, and the summary it prefers can drop
 *    the deciding detail just as neatly as the hand-written one.
 *
 * This engine makes those outcomes computable rather than arguable. It is
 * entirely deterministic: no model is called, and the same inputs always give
 * the same answer — including the training run, which is a fixed full-batch
 * fit whose loss curve is recorded rather than asserted.
 */

/** Where a piece of the prompt came from. */
export type ContextItemKind = 'system' | 'goal' | 'observation' | 'turn'

/** A shortened form of an item, as a compression scheme would produce. */
export interface CompressedForm {
  label: string
  content: string
  tokens: number
  /**
   * Whether the shortened form still carries the fact the answer depends on.
   *
   * This is the whole point of the compression policy: the summary is shorter
   * and reads fine, and the decisive detail is not in it any more.
   */
  retains: boolean
}

export interface ContextItem {
  id: string
  kind: ContextItemKind
  label: string
  content: string
  tokens: number
  /**
   * The answer depends on this item.
   *
   * An item is *critical* when the fact it carries decides the answer. The
   * policies below are judged on whether they keep it.
   */
  critical?: boolean
  /** A shortened form, when the item can be summarised without loss. */
  compressed?: CompressedForm
  /** Words that mark the item as relevant to the goal. */
  tags?: string[]
}

/** The five ways a harness can fit material into a finite window. */
export type ContextPolicy = 'truncate' | 'relevance' | 'compress' | 'page' | 'gist'

export const CONTEXT_POLICIES: { value: ContextPolicy; label: string; description: string }[] = [
  {
    value: 'truncate',
    label: 'Truncate the oldest',
    description:
      'The standard chatbot approach: keep the most recent turns and drop what came before, until the prompt fits.',
  },
  {
    value: 'relevance',
    label: 'Keep what is relevant',
    description:
      'Retrieve the material that bears on the goal and drop the rest, the way retrieval augmentation does.',
  },
  {
    value: 'compress',
    label: 'Compress everything',
    description:
      'Shorten every item that can be shortened, and drop only what still does not fit. The summary reads well — and may be missing the detail that decides the answer.',
  },
  {
    value: 'page',
    label: 'Page out and recall',
    description:
      'Move the overflow into an external store, then recall one item from it. Nothing is lost, but only one thing can be recalled per turn.',
  },
  {
    value: 'gist',
    label: 'Learned compression',
    description:
      'Score every item with a compressor trained on the other windows — and never shown which fact decides this one — then give each item the longest form its score can pay for.',
  },
]

export interface ContextScenario {
  id: string
  title: string
  /** The task the agent is doing. */
  goal: string
  /** The question the agent has to answer at the end. */
  question: string
  /** The default size of the window, in tokens. */
  budget: number
  /** The material, in the order it was produced. */
  items: ContextItem[]
  /** The words that mark an item as bearing on the goal. */
  relevantTags: string[]
  /** The answer when every decisive fact survived. */
  correctAnswer: string
  /** The answer the agent gives when a decisive fact was lost. */
  wrongAnswer: string
  /** What this scenario is for. */
  note: string
}

/** An item as it appears in the final prompt. */
export interface KeptItem {
  item: ContextItem
  /** The tokens it costs in the prompt. */
  tokens: number
  /** Whether it was shortened. */
  compressed: boolean
  /** Whether the decisive fact survived in this form. */
  retains: boolean
}

export interface ContextOutcome {
  /** The items in the final prompt. */
  kept: KeptItem[]
  /** The items that were dropped to make room. */
  dropped: ContextItem[]
  /** The items moved to an external store, under the paging policy. */
  pagedOut: ContextItem[]
  /** The item recalled from the store, under the paging policy. */
  recalled: ContextItem | null
  /** Under the learned policy, the scorer that decided and what it decided per item. */
  gist: GistTrace | null
  /** The tokens the prompt uses. */
  used: number
  /** The size of the window. */
  budget: number
  /** The tokens the material needed before any policy was applied. */
  totalTokens: number
  /** True when the instruction and the task alone do not fit. */
  overflow: boolean
  /** True when every decisive fact survived. */
  intact: boolean
  /** The answer the agent gives. */
  answer: string
  /** Whether the answer is right. */
  correct: boolean
  /** One sentence on what happened. */
  explanation: string
}

/** The kinds of material a harness protects: the instruction and the task. */
const PROTECTED: ContextItemKind[] = ['system', 'goal']

function isProtected(item: ContextItem): boolean {
  return PROTECTED.includes(item.kind)
}

/** How many of the item's tags bear on the goal. */
function relevance(item: ContextItem, scenario: ContextScenario): number {
  if (!item.tags) return 0
  return item.tags.filter((tag) => scenario.relevantTags.includes(tag)).length
}

/** Items ordered by how much they bear on the goal, most relevant first. */
function byRelevance(items: ContextItem[], scenario: ContextScenario): ContextItem[] {
  return [...items]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const score = relevance(b.item, scenario) - relevance(a.item, scenario)
      if (score !== 0) return score
      return a.index - b.index
    })
    .map((entry) => entry.item)
}

/** Items ordered by how little they bear on the goal — what to drop first. */
function byLeastRelevance(items: ContextItem[], scenario: ContextScenario): ContextItem[] {
  return [...items]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const score = relevance(a.item, scenario) - relevance(b.item, scenario)
      if (score !== 0) return score
      // Among equally irrelevant items, the most recent goes first: the older
      // material is the safer thing to keep.
      return b.index - a.index
    })
    .map((entry) => entry.item)
}

function full(item: ContextItem): KeptItem {
  return { item, tokens: item.tokens, compressed: false, retains: item.critical === true }
}

function shortened(item: ContextItem): KeptItem {
  const compressed = item.compressed
  return {
    item,
    tokens: compressed ? compressed.tokens : item.tokens,
    compressed: true,
    retains: compressed ? compressed.retains : item.critical === true,
  }
}

/* ------------------------------------------------------------------ */
/* Learned compression                                                 */
/* ------------------------------------------------------------------ */

/**
 * The signals a learned compressor can see.
 *
 * `critical` is not one of them. The label trains the scorer and is never handed to it as an
 * input, which is the difference between a learner and a lookup: at the moment the harness
 * has to decide, the compressor has only the surface of the material — how much of the
 * goal's vocabulary an item carries, how much of the question's, how recent it is, what
 * shortening it is worth, and whether a short form of it exists at all.
 *
 * The scope note matters: this is a scorer over five hand-built features, fitted by logistic
 * regression, not gist tokens emitted by a language model. What it shares with Gist is the
 * mechanism — a compressor whose behaviour is fitted rather than written — and what it gains
 * is that every weight, every loss value and every decision below is checkable by hand.
 */
export interface GistFeatures {
  /** the share of the goal's tags this item carries */
  tagOverlap: number
  /** the share of the question's terms that appear in this item */
  questionOverlap: number
  /** 1 for the newest unprotected item, 0 for the oldest */
  recency: number
  /** the item's share of the material — what compressing it buys */
  cost: number
  /** whether a shorter form of this item exists */
  compressible: number
}

export type GistFeatureKey = keyof GistFeatures

export const GIST_FEATURES: { key: GistFeatureKey; label: string; note: string }[] = [
  { key: 'tagOverlap', label: 'Goal vocabulary', note: 'How much of the goal’s tag list the item carries.' },
  { key: 'questionOverlap', label: 'Question terms', note: 'How many of the question’s own words appear in the item.' },
  { key: 'recency', label: 'Recency', note: 'How late in the session the item arrived.' },
  { key: 'cost', label: 'Token share', note: 'The item’s share of the material: shortening a large item saves more.' },
  { key: 'compressible', label: 'Has a short form', note: 'Whether a summary of the item exists at all.' },
]

/** The canonical order the weight vector is kept in. */
const FEATURE_KEYS: GistFeatureKey[] = ['tagOverlap', 'questionOverlap', 'recency', 'cost', 'compressible']

/**
 * How the scorer is fitted.
 *
 * Full-batch gradient descent on the log-loss, one fixed step size, a fixed number of
 * epochs, no randomness anywhere — so the weights, the loss curve and every decision drawn
 * from them are the same in this run as in the test that asserts them.
 */
export const GIST_TRAINING = { learningRate: 1, epochs: 300 }

/** A fitted scorer and the curve that produced it. */
export interface GistModel {
  weights: Record<GistFeatureKey, number>
  bias: number
  /** the mean log-loss over the training material, one entry per epoch */
  loss: number[]
  epochs: number
  examples: number
  positives: number
  /** the windows the weights were fitted on — never the one being assembled */
  trainedOn: string[]
}

/** What the scorer made of one item, and what the harness then did with it. */
export interface GistDecision {
  item: ContextItem
  features: GistFeatures
  /** the probability the scorer gives that the answer depends on this item */
  score: number
  action: 'full' | 'gist' | 'drop'
}

/** How well the scores rank decisive material above the rest, on the held-out window. */
export interface GistRanking {
  /** decisive × non-decisive pairs */
  pairs: number
  /** pairs put in the right order, ties counted as half */
  concordant: number
  auc: number
}

/** The learned policy's evidence: the model, what it decided, and how it judged itself. */
export interface GistTrace {
  model: GistModel
  /** the window this model never saw during training */
  heldOut: string
  decisions: GistDecision[]
  ranking: GistRanking
}

/** Words too general to tell one piece of material from another. */
const GIST_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'what', 'how', 'why', 'are', 'was',
  'were', 'its', 'be', 'been', 'is', 'it', 'do', 'does', 'did', 'not', 'of', 'to', 'in', 'on', 'at',
  'by', 'a', 'an', 'they', 'them', 'their', 'we', 'you', 'can', 'still', 'about', 'only', 'then',
  'than', 'which', 'who', 'when', 'has', 'have', 'had', 'will', 'would', 'should',
])

function gistTerms(text: string): Set<string> {
  const found = new Set<string>()
  for (const word of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (word.length === 0 || GIST_STOPWORDS.has(word)) continue
    // A number is a term even though "it" and "is" are not: the facts that get lost from a
    // summary are dates, amounts and counts.
    if (word.length < 3 && !/\d/.test(word)) continue
    found.add(word)
  }
  return found
}

/**
 * The feature vector of every unprotected item in a window.
 *
 * Recency and token share are measured against the *unprotected* material, because that is
 * the material a policy chooses between: the instruction and the task are never in the running.
 */
function gistFeaturesFor(scenario: ContextScenario): Map<string, GistFeatures> {
  const free = scenario.items.filter((item) => !isProtected(item))
  const materialTokens = free.reduce((sum, item) => sum + item.tokens, 0) || 1
  const questionTerms = gistTerms(scenario.question)
  const goalTags = scenario.relevantTags
  const map = new Map<string, GistFeatures>()
  free.forEach((item, index) => {
    const terms = gistTerms(`${item.label} ${item.content}`)
    let sharedTags = 0
    for (const tag of goalTags) if (terms.has(tag)) sharedTags += 1
    let sharedTerms = 0
    for (const term of questionTerms) if (terms.has(term)) sharedTerms += 1
    map.set(item.id, {
      tagOverlap: goalTags.length === 0 ? 0 : sharedTags / goalTags.length,
      questionOverlap: questionTerms.size === 0 ? 0 : sharedTerms / questionTerms.size,
      recency: free.length > 1 ? index / (free.length - 1) : 1,
      cost: item.tokens / materialTokens,
      compressible: item.compressed ? 1 : 0,
    })
  })
  return map
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z))
}

/** Keeps the log finite at the ends of the sigmoid. */
function clamp01(p: number): number {
  return Math.min(1 - 1e-9, Math.max(1e-9, p))
}

/**
 * Fit the compressor on a corpus of windows.
 *
 * The examples are items, not windows: an item is positive when the answer depends on it.
 * Every item is described only by `GIST_FEATURES`, so a fitted weight says something a
 * compressor could compute at run time — `critical` appears on the right-hand side of the
 * fit and nowhere on its left.
 */
export function trainGistModel(
  corpus: ContextScenario[] = CONTEXT_SCENARIOS,
  options: { exclude?: string; epochs?: number; learningRate?: number } = {},
): GistModel {
  const epochs = options.epochs ?? GIST_TRAINING.epochs
  const learningRate = options.learningRate ?? GIST_TRAINING.learningRate

  const trainedOn: string[] = []
  const vectors: number[][] = []
  const labels: number[] = []
  for (const scenario of corpus) {
    if (scenario.id === options.exclude) continue
    const free = scenario.items.filter((item) => !isProtected(item))
    if (free.length === 0) continue
    trainedOn.push(scenario.id)
    const features = gistFeaturesFor(scenario)
    for (const item of free) {
      const entry = features.get(item.id)
      if (!entry) continue
      vectors.push(FEATURE_KEYS.map((key) => entry[key]))
      labels.push(item.critical === true ? 1 : 0)
    }
  }

  const vector = FEATURE_KEYS.map(() => 0)
  let bias = 0
  const loss: number[] = []
  const count = Math.max(1, vectors.length)

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradient = FEATURE_KEYS.map(() => 0)
    let biasGradient = 0
    let total = 0
    for (let row = 0; row < vectors.length; row += 1) {
      const features = vectors[row]
      const label = labels[row]
      let z = bias
      for (let key = 0; key < features.length; key += 1) z += vector[key] * features[key]
      const p = sigmoid(z)
      const clipped = clamp01(p)
      total += -(label * Math.log(clipped) + (1 - label) * Math.log(1 - clipped))
      const error = p - label
      for (let key = 0; key < features.length; key += 1) gradient[key] += error * features[key]
      biasGradient += error
    }
    loss.push(total / count)
    for (let key = 0; key < vector.length; key += 1) vector[key] -= (learningRate * gradient[key]) / count
    bias -= (learningRate * biasGradient) / count
  }

  const weights = {} as Record<GistFeatureKey, number>
  FEATURE_KEYS.forEach((key, index) => {
    weights[key] = vector[index]
  })

  return {
    weights,
    bias,
    loss,
    epochs,
    examples: vectors.length,
    positives: labels.reduce((sum, label) => sum + label, 0),
    trainedOn,
  }
}

const MODEL_CACHE = new Map<string, GistModel>()

/**
 * The scorer used to assemble one window: fitted on every *other* window in the corpus.
 *
 * This is the honest part of the demonstration. Handing the compressor the answer key of the
 * window it is compressing would make the loss curve meaningless, so each window is judged
 * out-of-sample — the same claim Gist makes for itself, tested the way a small one can be.
 */
export function gistModelFor(
  scenario: ContextScenario,
  corpus: ContextScenario[] = CONTEXT_SCENARIOS,
): GistModel {
  const trainedOn = corpus.filter((entry) => entry.id !== scenario.id).map((entry) => entry.id)
  const key = `${scenario.id}|${trainedOn.join(',')}|${GIST_TRAINING.learningRate}|${GIST_TRAINING.epochs}`
  const cached = MODEL_CACHE.get(key)
  if (cached) return cached
  const model = trainGistModel(corpus, { exclude: scenario.id })
  MODEL_CACHE.set(key, model)
  return model
}

/** The probability the scorer puts on "the answer depends on this item". */
export function scoreGistItem(features: GistFeatures, model: GistModel): number {
  let z = model.bias
  for (const key of FEATURE_KEYS) z += model.weights[key] * features[key]
  return sigmoid(z)
}

function rankAgreement(entries: { score: number; critical: boolean }[]): GistRanking {
  let pairs = 0
  let concordant = 0
  for (const positive of entries) {
    if (!positive.critical) continue
    for (const negative of entries) {
      if (negative.critical) continue
      pairs += 1
      if (positive.score > negative.score) concordant += 1
      else if (positive.score === negative.score) concordant += 0.5
    }
  }
  // A window with no decisive item has nothing to rank, and a compressor asked to find
  // nothing cannot be said to have failed to find it.
  return { pairs, concordant, auc: pairs === 0 ? 1 : concordant / pairs }
}

/**
 * Score a window's material, most-likely-to-matter first.
 *
 * Ties are broken by the order the material arrived in, so the ranking is a total order and
 * the allocation below is reproducible.
 */
function rankByGist(scenario: ContextScenario, model: GistModel): { item: ContextItem; features: GistFeatures; score: number }[] {
  const features = gistFeaturesFor(scenario)
  return scenario.items
    .filter((item) => !isProtected(item))
    .map((item, index) => ({ item, index, features: features.get(item.id) as GistFeatures }))
    .map((entry) => ({ ...entry, score: scoreGistItem(entry.features, model) }))
    .sort((a, b) => (b.score === a.score ? a.index - b.index : b.score - a.score))
    .map((entry) => ({ item: entry.item, features: entry.features, score: entry.score }))
}

/**
 * Fit a scenario's material into a window.
 *
 * The first four policies are the ones the textbook names, and each one is a different
 * answer to the same question: *what do you do when the material does not fit?* The fifth is
 * the answer §9.3.2.2 points at when it lists compression as the remedy: let a trained
 * scorer decide what the material is worth.
 */
export function assembleContext(
  scenario: ContextScenario,
  budget: number,
  policy: ContextPolicy,
): ContextOutcome {
  const protectedItems = scenario.items.filter(isProtected)
  const free = scenario.items.filter((item) => !isProtected(item))
  const totalTokens = scenario.items.reduce((sum, item) => sum + item.tokens, 0)
  const protectedTokens = protectedItems.reduce((sum, item) => sum + item.tokens, 0)

  const base = {
    budget,
    totalTokens,
    pagedOut: [] as ContextItem[],
    recalled: null as ContextItem | null,
    gist: null as GistTrace | null,
    overflow: false,
  }

  // The instruction and the task do not fit. Nothing else matters: the
  // harness cannot even state the task.
  if (protectedTokens > budget) {
    return {
      ...base,
      kept: protectedItems.map(full),
      dropped: free,
      used: protectedTokens,
      intact: false,
      correct: false,
      answer: scenario.wrongAnswer,
      explanation:
        'The instruction and the task alone do not fit in the window, so there is nothing to decide. A window this small cannot run the agent at all.',
      overflow: true,
    }
  }

  let kept: KeptItem[] = protectedItems.map(full)
  let dropped: ContextItem[] = []
  let pagedOut: ContextItem[] = []
  let recalled: ContextItem | null = null
  let gist: GistTrace | null = null

  const room = budget - protectedTokens
  const usedOf = (entries: KeptItem[]) => entries.reduce((sum, entry) => sum + entry.tokens, 0)

  if (policy === 'truncate') {
    // Drop the oldest material until the rest fits.
    let survivors = [...free]
    for (const candidate of free) {
      if (usedOf(survivors.map(full)) <= room) break
      survivors = survivors.filter((item) => item.id !== candidate.id)
    }
    kept = [...kept, ...survivors.map(full)]
    dropped = free.filter((item) => !survivors.some((keptItem) => keptItem.id === item.id))
  }

  if (policy === 'relevance') {
    // Keep the material that bears on the goal, most relevant first.
    const ranked = byRelevance(free, scenario)
    const survivors: ContextItem[] = []
    for (const candidate of ranked) {
      if (usedOf(survivors.map(full)) + candidate.tokens > room) continue
      survivors.push(candidate)
    }
    kept = [...kept, ...survivors.map(full)]
    dropped = free.filter((item) => !survivors.some((keptItem) => keptItem.id === item.id))
  }

  if (policy === 'compress') {
    // Shorten everything that can be shortened. If the whole set still does
    // not fit, drop what bears least on the goal.
    const compressed = free.map((item) => (item.compressed ? shortened(item) : full(item)))
    const total = usedOf(compressed)
    if (total <= room) {
      kept = [...kept, ...compressed]
      dropped = []
    } else {
      let survivors = [...compressed]
      for (const candidate of byLeastRelevance(free, scenario)) {
        if (usedOf(survivors) <= room) break
        survivors = survivors.filter((entry) => entry.item.id !== candidate.id)
      }
      kept = [...kept, ...survivors]
      dropped = free.filter((item) => !survivors.some((entry) => entry.item.id === item.id))
    }
  }

  if (policy === 'page') {
    // Move the overflow into an external store, keeping the most recent
    // material in the window, and then recall one item from the store.
    const survivors: ContextItem[] = []
    for (const candidate of [...free].reverse()) {
      if (usedOf(survivors.map(full)) + candidate.tokens > room) continue
      survivors.unshift(candidate)
    }
    pagedOut = free.filter((item) => !survivors.some((keptItem) => keptItem.id === item.id))

    // The agent recalls one item: the one that bears most on the goal. The
    // information is still there — the question is whether the agent looks in
    // the right place.
    const ranked = byRelevance(pagedOut, scenario)
    const candidate = ranked[0] ?? null
    if (candidate) {
      // Make room for the recalled item by dropping what bears least.
      let window = [...survivors]
      while (usedOf(window.map(full)) + candidate.tokens > room && window.length > 0) {
        const victim = byLeastRelevance(window, scenario)[0]
        window = window.filter((item) => item.id !== victim.id)
      }
      if (usedOf(window.map(full)) + candidate.tokens <= room) {
        recalled = candidate
        kept = [...kept, ...window.map(full), ...(candidate ? [full(candidate)] : [])]
      } else {
        kept = [...kept, ...window.map(full)]
      }
    } else {
      kept = [...kept, ...survivors.map(full)]
    }
    dropped = []
  }

  if (policy === 'gist') {
    // Score the material with a compressor trained on the other windows, then give each item
    // the longest form its rank can pay for: the full text while there is room for it, the
    // short form when only the short form fits, nothing at all after that.
    const model = gistModelFor(scenario)
    const decisions: GistDecision[] = []
    const entries: KeptItem[] = []
    let left = room
    for (const ranked of rankByGist(scenario, model)) {
      const { item, features, score } = ranked
      const short = item.compressed
      if (left >= item.tokens) {
        decisions.push({ item, features, score, action: 'full' })
        entries.push(full(item))
        left -= item.tokens
      } else if (short && left >= short.tokens) {
        decisions.push({ item, features, score, action: 'gist' })
        entries.push(shortened(item))
        left -= short.tokens
      } else {
        decisions.push({ item, features, score, action: 'drop' })
      }
    }
    kept = [...kept, ...entries]
    dropped = free.filter((item) => !entries.some((entry) => entry.item.id === item.id))
    gist = {
      model,
      heldOut: scenario.id,
      decisions,
      ranking: rankAgreement(
        decisions.map((decision) => ({ score: decision.score, critical: decision.item.critical === true })),
      ),
    }
  }

  const used = usedOf(kept)
  const survivingFacts = new Set(kept.filter((entry) => entry.retains).map((entry) => entry.item.id))
  const intact = scenario.items
    .filter((item) => item.critical)
    .every((item) => survivingFacts.has(item.id))

  const lost = scenario.items.filter((item) => item.critical && !survivingFacts.has(item.id))
  const compressedLost = scenario.items.filter(
    (item) =>
      item.critical &&
      !survivingFacts.has(item.id) &&
      kept.some((entry) => entry.item.id === item.id),
  )

  let explanation: string
  if (policy === 'truncate') {
    explanation = intact
      ? 'The decisive fact was recent enough to survive the truncation, and the rest of the history was dropped.'
      : `Truncation dropped the decisive fact — “${lost[0]?.label ?? 'a required item'}” — because it was produced early. The agent answered from what was left, and was wrong.`
  } else if (policy === 'relevance') {
    explanation = intact
      ? 'Retrieval kept the material that bears on the goal, and the decisive fact was in it.'
      : `Retrieval kept what looked relevant to the goal, but the decisive fact was not in it. The agent had the surrounding material and still got it wrong.`
  } else if (policy === 'compress') {
    explanation = compressedLost.length
      ? `Everything was shortened, and the summary of “${compressedLost[0]?.label ?? 'a required item'}” no longer contains the fact that decides the answer. The agent had a relevant-looking prompt and was still wrong.`
      : intact
        ? 'Compression shortened the material but kept the decisive detail.'
        : 'Compression dropped what it could not shorten, and the decisive fact went with it.'
  } else if (policy === 'gist') {
    explanation = compressedLost.length
      ? `The compressor was trained on the other windows and never shown which fact decides this one. It scored “${compressedLost[0]?.label ?? 'a required item'}” high enough to keep and short enough to lose the detail — an abstract of the right document, with the number cut out of it.`
      : intact
        ? 'The compressor ranked the decisive material above the material it could stand in for, and the window held it in full.'
        : `The compressor ranked “${lost[0]?.label ?? 'a required item'}” below the material it kept, and by the time its turn came there was no room for it in any form.`
  } else {
    explanation = recalled
      ? `The overflow was paged out, not lost, and the agent recalled “${recalled.label}”. ${intact ? 'That was the decisive item, so the answer survived.' : 'But it was the wrong item to recall, and the decisive fact stayed in the store.'}`
      : 'Everything fit, so nothing had to be paged out.'
  }

  return {
    kept,
    dropped,
    pagedOut,
    recalled,
    gist,
    used,
    budget,
    totalTokens,
    overflow: false,
    intact,
    correct: intact,
    answer: intact ? scenario.correctAnswer : scenario.wrongAnswer,
    explanation,
  }
}

/* ------------------------------------------------------------------ */
/* Scenarios                                                           */
/* ------------------------------------------------------------------ */

export const CONTEXT_SCENARIOS: ContextScenario[] = [
  {
    id: 'refund-window',
    title: 'The refund window',
    goal: 'Check order 4471 and tell the customer whether they are still inside the 30-day refund window.',
    question: 'Is order 4471 still inside the refund window?',
    budget: 120,
    relevantTags: ['order', '4471', 'delivered', 'date', 'refund', 'policy'],
    note:
      'The decisive fact is the delivery date, and it arrives early in the session. Truncation drops it; compression keeps a summary of it that has lost the date; retrieval keeps it; paging out keeps it in a store and recalls it.',
    correctAnswer:
      'Order 4471 was delivered on 12 March, which is 39 days ago. The refund window is 30 days, so a refund is not available.',
    wrongAnswer:
      'Order 4471 is within the 30-day refund window, so a refund is available.',
    items: [
      {
        id: 'system',
        kind: 'system',
        label: 'System prompt',
        content:
          'You are a support agent for a hardware retailer. Answer only from the records you have been given, and do not guess at dates.',
        tokens: 18,
      },
      {
        id: 'goal',
        kind: 'goal',
        label: 'Task',
        content: 'Check order 4471 and tell the customer whether they are still inside the 30-day refund window.',
        tokens: 16,
      },
      {
        id: 'ticket',
        kind: 'observation',
        label: 'Ticket 2210',
        content: 'Ticket #2210 opened by the customer. Channel: web chat. Priority: standard. Account age: 3 years.',
        tokens: 18,
        tags: ['ticket', 'priority'],
      },
      {
        id: 'order-record',
        kind: 'observation',
        label: 'Order 4471',
        content:
          'Order 4471: placed 3 March, delivered 12 March. One 65W USB-C charger, EUR 39.00. Standard delivery, standard tier, packaging intact.',
        tokens: 40,
        critical: true,
        tags: ['order', '4471', 'delivered', 'date', 'march'],
        compressed: {
          label: 'Order 4471 (summary)',
          content: 'Order 4471: one 65W USB-C charger, EUR 39.00, standard delivery.',
          tokens: 14,
          retains: false,
        },
      },
      {
        id: 'customer-1',
        kind: 'turn',
        label: 'Customer',
        content: 'It arrived last Tuesday, but the charger was missing from the box.',
        tokens: 14,
        tags: ['charger', 'missing', 'box'],
      },
      {
        id: 'agent-1',
        kind: 'turn',
        label: 'Agent',
        content: 'Thanks — I have the order open. Let me check the delivery date against our refund policy.',
        tokens: 18,
        tags: ['delivery', 'date', 'refund', 'policy'],
      },
      {
        id: 'policy',
        kind: 'observation',
        label: 'Refund policy',
        content:
          'Refunds are accepted within 30 days of delivery. Returns after 30 days are not refundable; store credit may be offered instead.',
        tokens: 24,
        tags: ['refund', 'policy', 'days'],
        compressed: {
          label: 'Refund policy (summary)',
          content: 'Refunds: within 30 days of delivery.',
          tokens: 8,
          retains: true,
        },
      },
      {
        id: 'catalogue',
        kind: 'observation',
        label: 'Product catalogue',
        content:
          'Catalogue: 65W USB-C charger (EUR 39.00), 100W charger (EUR 59.00), 65W cable (EUR 12.00), laptop stand (EUR 45.00).',
        tokens: 26,
        tags: ['catalogue', 'charger', 'cable'],
        compressed: {
          label: 'Product catalogue (summary)',
          content: 'Catalogue: chargers, cables, stands.',
          tokens: 7,
          retains: false,
        },
      },
      {
        id: 'customer-2',
        kind: 'turn',
        label: 'Customer',
        content: 'I only want a refund for the item that was missing, not a replacement.',
        tokens: 16,
        tags: ['refund', 'missing'],
      },
    ],
  },
  {
    id: 'headline-number',
    title: 'The number in the middle',
    goal: 'Summarise the quarterly report for the board, including the headline revenue figure.',
    question: 'What was the headline revenue figure for the quarter?',
    budget: 100,
    relevantTags: ['revenue', 'headline', 'figure', 'metrics', 'quarterly'],
    note:
      'The decisive number is in the middle of a long document. Truncation keeps the end of the report and loses the middle; compression keeps the direction but loses the number.',
    correctAnswer: 'Revenue for the quarter was EUR 4.2 million, up 11% on the previous quarter.',
    wrongAnswer: 'Revenue grew by about 11% on the previous quarter.',
    items: [
      {
        id: 'system',
        kind: 'system',
        label: 'System prompt',
        content:
          'You are preparing a board summary. Use only the report text supplied, and quote figures exactly.',
        tokens: 16,
      },
      {
        id: 'goal',
        kind: 'goal',
        label: 'Task',
        content: 'Summarise the quarterly report for the board, including the headline revenue figure.',
        tokens: 14,
      },
      {
        id: 'intro',
        kind: 'observation',
        label: 'Report: introduction',
        content:
          'The quarter saw continued expansion in the core business, with growth in all three regions and stable margins across the portfolio.',
        tokens: 22,
        tags: ['overview', 'quarterly', 'growth'],
        compressed: {
          label: 'Introduction (summary)',
          content: 'Growth in all regions, stable margins.',
          tokens: 7,
          retains: false,
        },
      },
      {
        id: 'segment-1',
        kind: 'observation',
        label: 'Report: segment one',
        content:
          'The first segment grew revenue by 4% year on year, driven mainly by the subscription tier, while one-off hardware sales were flat.',
        tokens: 24,
        tags: ['revenue', 'segment', 'growth'],
        compressed: {
          label: 'Segment one (summary)',
          content: 'Segment one: subscription growth, hardware flat.',
          tokens: 7,
          retains: false,
        },
      },
      {
        id: 'metrics',
        kind: 'observation',
        label: 'Report: headline metrics',
        content:
          'Headline revenue for the quarter was EUR 4.2 million, an increase of 11% on the previous quarter and 9% on the same quarter last year.',
        tokens: 30,
        critical: true,
        tags: ['revenue', 'headline', 'figure', 'metrics'],
        compressed: {
          label: 'Headline metrics (summary)',
          content: 'Revenue grew about 11% on the previous quarter.',
          tokens: 9,
          retains: false,
        },
      },
      {
        id: 'segment-2',
        kind: 'observation',
        label: 'Report: segment two',
        content:
          'The second segment was roughly flat in revenue terms, with a small increase in volume offset by lower average selling prices.',
        tokens: 24,
        tags: ['revenue', 'segment', 'volume'],
        compressed: {
          label: 'Segment two (summary)',
          content: 'Segment two: flat revenue.',
          tokens: 6,
          retains: false,
        },
      },
      {
        id: 'outlook',
        kind: 'observation',
        label: 'Report: outlook',
        content:
          'The outlook for the next quarter depends on the renewal cycle, on the timing of two large contracts, and on the exchange rate.',
        tokens: 22,
        tags: ['outlook', 'next', 'quarterly'],
        compressed: {
          label: 'Outlook (summary)',
          content: 'Next quarter depends on renewals, contracts, and FX.',
          tokens: 8,
          retains: false,
        },
      },
      {
        id: 'footnote',
        kind: 'observation',
        label: 'Report: methodology',
        content:
          'Figures are unaudited and are stated in euros at the average rate for the period. Segment definitions changed in the prior year.',
        tokens: 18,
        tags: ['methodology', 'footnote'],
        compressed: {
          label: 'Methodology (summary)',
          content: 'Unaudited, average FX rates.',
          tokens: 5,
          retains: false,
        },
      },
      {
        id: 'editor',
        kind: 'turn',
        label: 'Editor',
        content: 'One page, please, and lead with the number the board will ask about.',
        tokens: 14,
        tags: ['board', 'format'],
      },
    ],
  },
  {
    id: 'ship-tonight',
    title: 'Two conditions',
    goal: 'Decide whether the release can be shipped tonight. Check the test status and the deployment window.',
    question: 'Can the release be shipped tonight?',
    budget: 75,
    relevantTags: ['tests', 'status', 'deployment', 'window', 'ship'],
    note:
      'Two facts decide the answer, and the retrieval heuristic ranks the deployment window above the test status. Paging out recalls the wrong one of the two.',
    correctAnswer: 'No. The tests are green, but the deployment window closed at 21:00, so the release waits until tomorrow.',
    wrongAnswer: 'Yes — the tests passed and the deployment window is still open, so the release can go out tonight.',
    items: [
      {
        id: 'system',
        kind: 'system',
        label: 'System prompt',
        content: 'You are the release assistant. Say yes only if every condition is met.',
        tokens: 12,
      },
      {
        id: 'goal',
        kind: 'goal',
        label: 'Task',
        content: 'Decide whether the release can be shipped tonight. Check the test status and the deployment window.',
        tokens: 14,
      },
      {
        id: 'test-run',
        kind: 'observation',
        label: 'Test run',
        content:
          'Test run 8821: 1,204 tests executed, 1,204 passed, 0 failed, 0 skipped. Duration 6m 41s.',
        tokens: 22,
        critical: true,
        tags: ['tests', 'green'],
        compressed: {
          label: 'Test run (summary)',
          content: 'Test run 8821 completed.',
          tokens: 6,
          retains: false,
        },
      },
      {
        id: 'window',
        kind: 'observation',
        label: 'Deployment window',
        content:
          'The deployment window for the production cluster is 19:00 to 21:00 tonight. Requests outside it are queued for the next morning.',
        tokens: 24,
        critical: true,
        tags: ['deployment', 'window'],
        compressed: {
          label: 'Deployment window (summary)',
          content: 'Deployment window: 19:00 to 21:00 tonight.',
          tokens: 9,
          retains: true,
        },
      },
      {
        id: 'ops-note',
        kind: 'observation',
        label: 'Operations note',
        content:
          'On-call engineer for tonight is B. Adeyemi. The release freeze for the payments team ends on Friday.',
        tokens: 18,
        tags: ['oncall', 'freeze'],
        compressed: {
          label: 'Operations note (summary)',
          content: 'On-call: B. Adeyemi.',
          tokens: 6,
          retains: false,
        },
      },
      {
        id: 'chat-1',
        kind: 'turn',
        label: 'Engineer',
        content: 'We would like to go out tonight if the numbers allow it.',
        tokens: 12,
        tags: ['tonight', 'ship'],
      },
      {
        id: 'rollback',
        kind: 'observation',
        label: 'Rollback plan',
        content:
          'The previous release is tagged and can be restored in about four minutes, provided the migration is reversed first.',
        tokens: 20,
        tags: ['rollback', 'release'],
        compressed: {
          label: 'Rollback plan (summary)',
          content: 'Previous release can be restored in about four minutes.',
          tokens: 9,
          retains: false,
        },
      },
    ],
  },
]

export const CONTEXT_SCENARIO_BY_ID = new Map(CONTEXT_SCENARIOS.map((entry) => [entry.id, entry]))
