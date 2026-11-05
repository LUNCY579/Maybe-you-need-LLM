/**
 * Sparse capacity: the mixture of experts.
 *
 * A model with many experts keeps the same number of parameters as a dense
 * model of the same *active* size, and pays for only the experts it uses.
 * The price is routing: the router has to send each token to the right
 * experts, and if they do not get an even share, some experts are trained
 * more than others and the ones that are trained less are worse.
 *
 * Both the imbalance and the auxiliary loss that corrects it are computable,
 * and this module computes them.
 */

import { createRng } from '@llm-materials/course-core'

export interface RoutingOptions {
  /** The number of experts. */
  experts: number
  /** How many experts each token is sent to. */
  topK?: number
  /** The seed. */
  seed?: number
  /** How much the router is biased, to make a badly balanced router. */
  bias?: number
}

export interface RoutingResult {
  /** The expert chosen for each token, per chosen slot. */
  assignment: number[][]
  /** The fraction of the tokens that went to each expert. */
  load: number[]
  /** The fraction of the routing probability that went to each expert. */
  probability: number[]
  /** The auxiliary loss that corrects the imbalance. */
  auxiliaryLoss: number
  /** The largest share of the tokens any one expert received. */
  maxLoad: number
  /** The smallest share any expert received. */
  minLoad: number
}

/**
 * The router.
 *
 * The router is a linear map from the embedding to one score per expert, and
 * the tokens go to the experts with the highest scores. The bias is a
 * deliberate imbalance, so that the laboratory can watch the correction work.
 */
export function route(embeddings: number[][], options: RoutingOptions): RoutingResult {
  const settings = { topK: 1, seed: 1, bias: 0, ...options }
  const router = routerWeights(settings.experts, embeddings[0]?.length ?? 0, settings.seed)
  // A fixed bias that makes some experts more attractive than they should be.
  const preference = settings.experts
    ? Array.from({ length: settings.experts }, (_, e) => settings.bias * (e % 2 === 0 ? 1 : -1))
    : []
  return routeWithPreference(embeddings, settings.experts, settings.topK, router, preference)
}

/**
 * The router's weights.
 *
 * Drawn from the seed, so that a router trained by the auxiliary loss and a
 * router measured by `route` are the same router: the only thing that differs
 * between the two runs is the bias added on top.
 */
function routerWeights(experts: number, dimension: number, seed: number): number[][] {
  const rng = createRng(seed)
  const router: number[][] = []
  for (let e = 0; e < experts; e++) {
    const row: number[] = []
    for (let d = 0; d < dimension; d++) row.push(rng() * 2 - 1)
    router.push(row)
  }
  return router
}

/** The routing itself, given a per-expert additive preference. */
function routeWithPreference(
  embeddings: number[][],
  experts: number,
  topK: number,
  router: number[][],
  preference: number[],
): RoutingResult {
  const assignment: number[][] = []
  const probabilityMass = new Array<number>(experts).fill(0)
  const loadCount = new Array<number>(experts).fill(0)

  for (const embedding of embeddings) {
    const scores = router.map((row, e) => {
      let total = preference[e] ?? 0
      for (let d = 0; d < embedding.length; d++) total += (row[d] ?? 0) * (embedding[d] ?? 0)
      return total
    })
    const maximum = Math.max(...scores)
    const exponentials = scores.map((score) => Math.exp(score - maximum))
    const total = exponentials.reduce((a, b) => a + b, 0)
    for (let e = 0; e < experts; e++) probabilityMass[e] = (probabilityMass[e] ?? 0) + (exponentials[e] ?? 0) / total

    const order = scores.map((score, index) => ({ score, index })).sort((a, b) => b.score - a.score)
    const chosen = order.slice(0, Math.max(1, Math.min(topK, experts))).map((entry) => entry.index)
    assignment.push(chosen)
    for (const expert of chosen) loadCount[expert] = (loadCount[expert] ?? 0) + 1
  }

  const tokens = embeddings.length
  const load = loadCount.map((count) => (tokens === 0 ? 0 : count / tokens))
  const probability = probabilityMass.map((mass) => (tokens === 0 ? 0 : mass / tokens))

  // The auxiliary loss: the number of tokens, times the sum of the products
  // of the load fraction and the probability fraction. It is smallest when
  // the two agree, and it pushes the router towards that.
  let sum = 0
  for (let e = 0; e < experts; e++) sum += (load[e] ?? 0) * (probability[e] ?? 0)
  const auxiliaryLoss = tokens * sum * experts

  return {
    assignment,
    load,
    probability,
    auxiliaryLoss,
    maxLoad: Math.max(...load),
    minLoad: Math.min(...load),
  }
}

/**
 * The capacity of an expert, and the tokens it has to drop.
 *
 * Each expert may take a fixed multiple of its fair share. When the router
 * sends more than that, the extra tokens are dropped: they are the tokens
 * that made the routing expensive in the first place.
 *
 * The fair share is counted in *assignments*, not in tokens. A token sent to
 * two experts occupies two of an expert's slots, so with top-k the whole
 * batch is k·N assignments spread over E experts and the fair share is k·N/E.
 * Read the factor per token instead and a top-2 router at capacity factor one
 * loses half of its assignments even when the load is perfectly even — which
 * is why the implementations scale the factor by k. Pass `perSlot: false` to
 * see that arithmetic for yourself.
 */
export function capacityOverflow(
  load: number[],
  capacityFactor: number,
  options: { tokens?: number; topK?: number; perSlot?: boolean } = {},
): { capacity: number[]; overflow: number[]; droppedFraction: number } {
  const settings = { tokens: 0, topK: 1, perSlot: true, ...options }
  const tokens = settings.tokens
  const assignments = tokens * settings.topK
  const fairShare = (settings.perSlot ? assignments : tokens) / Math.max(1, load.length)
  const capacity = load.map(() => Math.floor(fairShare * capacityFactor))
  const overflow = load.map((fraction, e) => Math.max(0, Math.round(fraction * tokens) - (capacity[e] ?? 0)))
  const dropped = overflow.reduce((a, b) => a + b, 0)
  const totalAssigned = assignments
  return {
    capacity,
    overflow,
    droppedFraction: totalAssigned === 0 ? 0 : dropped / totalAssigned,
  }
}

/**
 * The arithmetic a sparse model saves.
 *
 * A model with E experts and a top-k of k activates k of them, so it does
 * the work of a dense model of k times its active size, while keeping the
 * parameters of a model of E times its active size.
 */
export function sparseSpeedup(experts: number, topK: number): number {
  if (topK <= 0) return 0
  return experts / topK
}

/** The fraction of the parameters a sparse model actually uses in a step. */
export function activeParameterFraction(experts: number, topK: number): number {
  if (experts <= 0) return 0
  return Math.min(1, topK / experts)
}

/**
 * The load-balancing loss in the shape the papers use.
 *
 * `route` above returns the raw product, which is what the gradient is
 * proportional to but whose size depends on the batch. This is the same
 * quantity normalised so that perfect balance gives exactly one, which makes
 * the coefficient in front of it mean the same thing for every model: one
 * means the router is balanced, and the excess over one is the imbalance.
 *
 * The two forms differ only by a constant, and the constant is the part the
 * papers disagree about — GShard scales by the number of experts, Switch by
 * one over the square of the number of experts each token uses. The
 * normalisation here puts both on the same scale so the curves can be compared
 * at one coefficient.
 *
 * One is the value of a router whose load and whose probabilities are both
 * flat. Below one the two have been pushed *against* each other, which the
 * product allows and which a correction that overshoots produces: the
 * probabilities move onto the experts the tokens are not using. It is a worse
 * state than one, not a better one, and the accuracy column of the table is
 * what shows it.
 */
export function loadBalanceLoss(
  load: number[],
  probability: number[],
  options: { topK?: number } = {},
): number {
  const settings = { topK: 1, ...options }
  const experts = Math.max(1, load.length)
  let sum = 0
  for (let e = 0; e < experts; e++) sum += (load[e] ?? 0) * (probability[e] ?? 0)
  // At perfect balance each expert holds topK/E of the assignments and 1/E of
  // the probability, so the sum is topK/E and this expression is 1.
  return (experts * sum) / Math.max(1, settings.topK)
}

/**
 * The correction the loss applies.
 *
 * The router's argmax is not differentiable, so the gradient of the load term
 * is taken as if the hard count were smooth — which is the trick in the GShard
 * paper, and it leaves a correction proportional to how far each expert is
 * from its fair share. This is that update: a proportional controller with
 * gain λ that pushes the router away from whichever expert it is favouring.
 */
export function routerCorrection(load: number[], lambda: number, topK = 1): number[] {
  const fair = fairShare(load.length, topK)
  return load.map((fraction) => -lambda * (fraction - fair))
}

export interface RoutingStep {
  step: number
  auxiliaryLoss: number
  balanceLoss: number
  maxLoad: number
  minLoad: number
  spread: number
  droppedFraction: number
  /** The share of the tokens the router sent to the expert they needed. */
  accuracy: number
  /** The expert holding the largest share of the assignments. */
  busiest: number
}

export interface TrainedRouting {
  steps: RoutingStep[]
  /** The routing at the last step. */
  final: NeedRouting
  /** True when an expert went from over its fair share to under it: the controller swung past the target. */
  oscillates: boolean
  /** The largest single rise in the balance loss across the run. */
  spike: number
}

/** The correction's target: the fair share of the *assignments*, which is top-k over the number of experts. */
export function fairShare(experts: number, topK = 1): number {
  return topK / Math.max(1, experts)
}

/**
 * The expert each token actually needs.
 *
 * Drawn from a skewed distribution: at a concentration of zero every expert is
 * equally likely, and as the concentration rises a few experts are needed far
 * more often than the rest. The skew is planted, and it is the point of the
 * exercise — it is the fact the load-balancing loss is in tension with. A
 * router that follows the data is unbalanced, and a router that is balanced is
 * not following the data.
 */
export function idealExperts(
  tokens: number,
  experts: number,
  concentration: number,
  seed: number,
): number[] {
  const rng = createRng(seed)
  const weights = Array.from({ length: experts }, (_, e) =>
    Math.exp(-concentration * 3 * (e / Math.max(1, experts - 1))),
  )
  const total = weights.reduce((a, b) => a + b, 0)
  const cumulative: number[] = []
  let running = 0
  for (const weight of weights) {
    running += weight / total
    cumulative.push(running)
  }
  return Array.from({ length: tokens }, () => {
    const u = rng()
    const index = cumulative.findIndex((value) => u <= value)
    return index === -1 ? experts - 1 : index
  })
}

/** A router measured against the tokens' needs. */
export interface NeedRouting extends RoutingResult {
  /** The share of the tokens that had one of the experts it was sent to be the one it needed. */
  accuracy: number
  /** The load the data itself implies, if the router followed every token's need. */
  idealLoad: number[]
}

/**
 * Route by need, with a bias.
 *
 * The score is one for the expert the token needs and zero for the others,
 * plus the bias the auxiliary loss has applied. So the only thing the bias does
 * is move tokens off the expert they wanted and onto the one it prefers, which
 * is exactly what the correction does to a real router and exactly what makes
 * the loss a *trade* rather than a fix.
 *
 * This is a toy, and it is presented as one: there is no language model, no
 * gradient, and no expert that computes anything. What it has are the two
 * quantities the papers argue about — the load and the accuracy — and the
 * controller that trades one for the other.
 */
export function routeByNeed(
  ideals: number[],
  experts: number,
  bias: number[],
  topK = 1,
): NeedRouting {
  const k = Math.max(1, Math.min(topK, experts))
  const assignment: number[][] = []
  const probabilityMass = new Array<number>(experts).fill(0)
  const loadCount = new Array<number>(experts).fill(0)
  let served = 0

  for (const ideal of ideals) {
    const scores = Array.from({ length: experts }, (_, e) => (e === ideal ? 1 : 0) + (bias[e] ?? 0))
    const maximum = Math.max(...scores)
    const exponentials = scores.map((score) => Math.exp(score - maximum))
    const total = exponentials.reduce((a, b) => a + b, 0)
    for (let e = 0; e < experts; e++) probabilityMass[e] = (probabilityMass[e] ?? 0) + (exponentials[e] ?? 0) / total

    const order = scores.map((score, index) => ({ score, index })).sort((a, b) => b.score - a.score)
    const chosen = order.slice(0, k).map((entry) => entry.index)
    assignment.push(chosen)
    for (const expert of chosen) loadCount[expert] = (loadCount[expert] ?? 0) + 1
    if (chosen.includes(ideal)) served++
  }

  const tokens = Math.max(1, ideals.length)
  const load = loadCount.map((count) => count / tokens)
  const probability = probabilityMass.map((mass) => mass / tokens)
  let sum = 0
  for (let e = 0; e < experts; e++) sum += (load[e] ?? 0) * (probability[e] ?? 0)

  const idealCounts = new Array<number>(experts).fill(0)
  for (const ideal of ideals) idealCounts[ideal] = (idealCounts[ideal] ?? 0) + 1

  return {
    assignment,
    load,
    probability,
    auxiliaryLoss: tokens * sum * experts,
    maxLoad: Math.max(...load),
    minLoad: Math.min(...load),
    accuracy: served / tokens,
    idealLoad: idealCounts.map((count) => count / tokens),
  }
}

export interface LoadBalancerOptions {
  /** How many tokens in the batch. */
  tokens?: number
  /** How many experts. */
  experts?: number
  /** How strongly the data favours a few experts. */
  concentration?: number
  /** How many experts each token is sent to. */
  topK?: number
  /** The coefficient on the auxiliary loss: the controller's gain. */
  lambda?: number
  /** How many correction steps to run. */
  steps?: number
  /** Each expert may hold this multiple of its fair share. */
  capacityFactor?: number
  /** The seed the needs are drawn with. */
  seed?: number
}

/**
 * The router trained with the auxiliary loss applied, step by step.
 *
 * The only thing that moves is the per-expert bias, and it moves by the
 * correction above, so the whole experiment is the dynamics of a proportional
 * controller. At λ = 0 nothing moves at all: the router keeps serving every
 * token the expert it wanted, and keeps the load the data gave it.
 *
 * What the measured curves say is that the loss and the load do not move
 * together. The loss is a product of the load with the *probabilities*, and the
 * probabilities are smooth: at λ = 0.05 the balance loss walks steadily down,
 * step after step, while the hardest thing about the router — which expert each
 * token is actually sent to — does not change by one token, and neither the
 * busiest expert's load nor the accuracy moves. A bias has to cross the gap
 * between needing an expert and not needing it before the argmax moves at all.
 *
 * When it does, it moves all at once. Past roughly a seventh with the defaults
 * below, one step turns the busiest expert from the one the data chose into a
 * different one, empties an expert completely, and takes a quarter of the tokens
 * off the expert they needed. Then the controller swings: λ = 0.4 alternates
 * between the two states, ends with a worse imbalance than the one it set out to
 * remove and only a third of the tokens served by the expert they wanted.
 *
 * That is the spike, and it is not a mystery of deep learning: it is a
 * controller with a gain too high for the delay in its own loop — and a dead
 * zone in the argmax, which is the delay.
 */
export function trainLoadBalancer(options: LoadBalancerOptions = {}): TrainedRouting {
  const settings = {
    tokens: 256,
    experts: 8,
    concentration: 0.8,
    topK: 1,
    lambda: 0.1,
    steps: 30,
    capacityFactor: 1.25,
    seed: 3,
    ...options,
  }
  const ideals = idealExperts(settings.tokens, settings.experts, settings.concentration, settings.seed)
  const fair = fairShare(settings.experts, settings.topK)
  const bias = new Array<number>(settings.experts).fill(0)

  let current = routeByNeed(ideals, settings.experts, bias, settings.topK)
  const steps: RoutingStep[] = [describeStep(0, current, settings)]

  const beenOver = new Array<boolean>(settings.experts).fill(false)
  let oscillates = false
  let spike = 0

  for (let step = 1; step <= settings.steps; step++) {
    const correction = routerCorrection(current.load, settings.lambda, settings.topK)
    for (let e = 0; e < bias.length; e++) bias[e] = (bias[e] ?? 0) + (correction[e] ?? 0)
    current = routeByNeed(ideals, settings.experts, bias, settings.topK)
    const described = describeStep(step, current, settings)
    steps.push(described)

    const rise = described.balanceLoss - (steps[step - 1]?.balanceLoss ?? 0)
    if (rise > spike) spike = rise
    for (let e = 0; e < current.load.length; e++) {
      const load = current.load[e] ?? 0
      // Five per cent either side of the fair share is the dead band: a
      // controller that settles inside it has done its job, and one that
      // crosses out of it and back is the one that is swinging.
      if (load > fair * 1.05) beenOver[e] = true
      else if (load < fair * 0.95 && beenOver[e]) oscillates = true
    }
  }
  return { steps, final: current, oscillates, spike }
}

function describeStep(
  step: number,
  routing: NeedRouting,
  settings: { experts: number; topK: number; capacityFactor: number },
): RoutingStep {
  const balanceLoss = loadBalanceLoss(routing.load, routing.probability, { topK: settings.topK })
  const overflow = capacityOverflow(routing.load, settings.capacityFactor, {
    tokens: routing.assignment.length,
    topK: settings.topK,
  })
  return {
    step,
    auxiliaryLoss: routing.auxiliaryLoss,
    balanceLoss,
    maxLoad: routing.maxLoad,
    minLoad: routing.minLoad,
    spread: routing.maxLoad - routing.minLoad,
    droppedFraction: overflow.droppedFraction,
    accuracy: routing.accuracy,
    busiest: routing.load.indexOf(routing.maxLoad),
  } satisfies RoutingStep
}

/**
 * The trade the auxiliary loss makes.
 *
 * One curve over λ: the balance the router reaches, the accuracy it pays for
 * it, and whether the controller settles or swings. The papers quote a
 * coefficient; this is what a coefficient buys, and it is the reason the loss
 * is kept small in the models that use it — the imbalance it removes is real,
 * and the tokens it misroutes are real too.
 */
export function lambdaSweep(
  options: LoadBalancerOptions & { lambdas?: number[] } = {},
): { lambda: number; balanceLoss: number; accuracy: number; droppedFraction: number; oscillates: boolean }[] {
  const settings = { lambdas: [0, 0.02, 0.05, 0.1, 0.2, 0.4, 0.8, 1.6], ...options }
  const lambdas = settings.lambdas
  return lambdas.map((lambda) => {
    const trained = trainLoadBalancer({ ...settings, lambda })
    const last = trained.steps[trained.steps.length - 1]
    return {
      lambda,
      balanceLoss: last?.balanceLoss ?? 0,
      accuracy: last?.accuracy ?? 0,
      droppedFraction: last?.droppedFraction ?? 0,
      oscillates: trained.oscillates,
    }
  })
}

/**
 * How many correction steps the argmax stays put.
 *
 * A token's score for the expert it needed beats every other expert's by one,
 * so nothing a token is sent to can change until the *difference* between two
 * experts' biases reaches that one. The busiest expert's bias falls by λ times
 * its excess over the fair share each step and the quietest's rises by λ times
 * its deficit, so the gap closes at λ times the spread of the load, and the
 * number of steps in which the router takes no decision at all is the
 * reciprocal.
 *
 * Measured against `firstMovedStep` at top-1, it is exact to one step: at λ =
 * 0.05 the router’s first changed decision comes at step 83 and this says 82.6,
 * at λ = 0.3 at step 14 and this says 13.8. That is the whole difference between
 * a controller that looks stable and one that is merely slow, and it is why the
 * gain has to be read against the length of the run rather than on its own. At
 * top-2 the premise fails in the reader's favour: a token's second slot is the
 * largest bias among the other experts, so it changes order on the first step.
 */
export function deadZoneSteps(spread: number, lambda: number): number {
  if (lambda <= 0 || spread <= 0) return Number.POSITIVE_INFINITY
  return 1 / (lambda * spread)
}

/**
 * The first step at which the router sends a token somewhere other than where
 * it was sent at step zero — the end of the dead zone, or nothing when the run
 * never gets there.
 *
 * It is a second run rather than a read of `trainLoadBalancer`'s steps because
 * the step records hold the load, not the assignment: at top-2 a token may
 * change its second slot without any of the recorded numbers moving.
 */
export function firstMovedStep(options: LoadBalancerOptions = {}): number | null {
  const settings = {
    tokens: 256,
    experts: 8,
    concentration: 0.8,
    topK: 1,
    lambda: 0.1,
    steps: 30,
    capacityFactor: 1.25,
    seed: 3,
    ...options,
  }
  const ideals = idealExperts(settings.tokens, settings.experts, settings.concentration, settings.seed)
  const bias = new Array<number>(settings.experts).fill(0)
  let current = routeByNeed(ideals, settings.experts, bias, settings.topK)
  const signature = (routing: NeedRouting) => routing.assignment.map((chosen) => chosen.join()).join('|')
  const start = signature(current)
  for (let step = 1; step <= settings.steps; step++) {
    const correction = routerCorrection(current.load, settings.lambda, settings.topK)
    for (let e = 0; e < bias.length; e++) bias[e] = (bias[e] ?? 0) + (correction[e] ?? 0)
    current = routeByNeed(ideals, settings.experts, bias, settings.topK)
    if (signature(current) !== start) return step
  }
  return null
}

/**
 * Top-1 against top-2 under the same coefficient.
 *
 * The same tokens, the same needs, the same capacity factor and the same λ —
 * only the number of experts each token is sent to differs. Three things come
 * out of the pair of curves, and all three are computed rather than quoted.
 *
 * The second slot piles on. Uncorrected, a top-2 router here puts *every* token
 * into its busiest expert as one of its two choices — a load of one, against
 * the two tenths and three quarters the data alone gives it — and at the same
 * capacity factor it drops forty per cent of the assignments where the top-1
 * router drops twenty. That is the concentration the capacity factor was
 * invented to manage, and the reason a top-2 model needs a generous one.
 *
 * The correction is gentler on the top-2 router, because a token that loses its
 * second slot has not lost the expert it needed: the load moves less for the
 * same bias, the loop gain is lower, and the coefficient that makes a top-1
 * curve spike leaves this one nearly flat. What the top-1 router trades for
 * that sensitivity is half the arithmetic per token and a router with one
 * decision in it instead of two.
 */
export function routingInstability(options: LoadBalancerOptions = {}): { top1: TrainedRouting; top2: TrainedRouting } {
  const settings: LoadBalancerOptions = {
    tokens: 256,
    experts: 8,
    concentration: 0.8,
    lambda: 0.1,
    steps: 30,
    capacityFactor: 1.25,
    seed: 3,
    ...options,
  }
  return {
    top1: trainLoadBalancer({ ...settings, topK: 1 }),
    top2: trainLoadBalancer({ ...settings, topK: 2 }),
  }
}

export interface LossPoint {
  step: number
  loss: number
  misroutePenalty: number
  dropPenalty: number
  balancePenalty: number
  accuracy: number
  droppedFraction: number
  balanceLoss: number
}

/**
 * The loss curve a routing run implies.
 *
 * Three terms. A token that did not reach the expert it needed costs whatever
 * a wrong expert is worth; a token that reached an expert with no room costs
 * the same as a missing one; and the imbalance costs λ times the excess over
 * one, since the loss is normalised so that a balanced router adds nothing.
 * The first two are the task and the third is the correction, and the spike is
 * what happens when the correction moves the load faster than the task can
 * absorb it.
 *
 * The two coefficients are planted — there is no language model here to have a
 * real cross-entropy — but the accuracy, the drops and the imbalance they are
 * applied to are computed by the router above.
 */
export function lossCurve(
  steps: RoutingStep[],
  options: { lambda?: number; penaltyPerMisroutedToken?: number; penaltyPerDroppedToken?: number } = {},
): LossPoint[] {
  const settings = { lambda: 0.1, penaltyPerMisroutedToken: 3, penaltyPerDroppedToken: 4, ...options }
  return steps.map((step) => {
    const misroute = settings.penaltyPerMisroutedToken * (1 - step.accuracy)
    const drop = settings.penaltyPerDroppedToken * step.droppedFraction
    const balance = settings.lambda * (step.balanceLoss - 1)
    return {
      step: step.step,
      loss: misroute + drop + balance,
      misroutePenalty: misroute,
      dropPenalty: drop,
      balancePenalty: balance,
      accuracy: step.accuracy,
      droppedFraction: step.droppedFraction,
      balanceLoss: step.balanceLoss,
    }
  })
}

/** The largest rise between one point of a loss curve and the next: the spike. */
export function largestRise(curve: LossPoint[]): number {
  let worst = 0
  for (let i = 1; i < curve.length; i++) {
    const rise = (curve[i]?.loss ?? 0) - (curve[i - 1]?.loss ?? 0)
    if (rise > worst) worst = rise
  }
  return worst
}
