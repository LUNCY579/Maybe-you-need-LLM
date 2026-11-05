/**
 * Social dilemmas.
 *
 * Chapter 15 studies cooperation in games with known equilibrium structure. The
 * point of using those games is that a model's choice can be scored against a
 * formal prediction rather than an opinion — so this engine makes the games
 * playable and scores the outcome against the equilibrium.
 *
 * The classic one-shot Prisoner's Dilemma has a single Nash equilibrium:
 * defect–defect. Cooperating against a rational opponent is *strictly
 * dominated*. But in a repeated game the answer changes: grim trigger sustains
 * cooperation forever as a subgame-perfect equilibrium. Which is why a
 * dilemma score is meaningless without the horizon, and why this engine always
 * reports the horizon alongside the result.
 *
 * Deterministic and scripted: the opponent is a fixed policy, and the student
 * chooses their own action each round.
 */

export type DilemmaAction = 'cooperate' | 'defect'

/**
 * The payoff matrix.
 *
 * `matrix[myAction][theirAction]` is the pair `[myPayoff, theirPayoff]`.
 * A full matrix is needed because the two payoffs depend on *both* actions:
 * in the Prisoner's Dilemma, defecting against a cooperator is the best
 * available move, and that fact is the whole point of the game.
 */
export interface DilemmaPayoffs {
  matrix: Record<DilemmaAction, Record<DilemmaAction, [number, number]>>
}

export interface DilemmaOpponent {
  id: string
  label: string
  description: string
  /** The policy the opponent plays. */
  policy: 'always-cooperate' | 'always-defect' | 'tit-for-tat' | 'grim-trigger'
  /** The note shown after each round, explaining the opponent's move. */
  rationale: string
}

export interface DilemmaRound {
  round: number
  myAction: DilemmaAction
  theirAction: DilemmaAction
  myPayoff: number
  theirPayoff: number
  /** Why the opponent played what it played. */
  note: string
}

export interface DilemmaRun {
  opponent: DilemmaOpponent
  horizon: number
  rounds: DilemmaRound[]
  myTotal: number
  theirTotal: number
  /** The best my-total achievable against this opponent and horizon. */
  bestPossibleMyTotal: number
  /**
   * The best total an optimal player can extract against this *known*
   * opponent. This is a best-response computation, not a Nash equilibrium of
   * the underlying game.
   */
  optimalMyTotal: number
  /** True when the student ended up at least as well as optimal play would. */
  reachedOptimal: boolean
  summary: string
}

/** The standard Prisoner's Dilemma: T > R > P > S, and defection dominates. */
export const PRISONERS_DILEMMA: DilemmaPayoffs = {
  matrix: {
    cooperate: { cooperate: [3, 3], defect: [0, 5] },
    defect: { cooperate: [5, 0], defect: [1, 1] },
  },
}

/** The donation game: mutual cooperation beats unilateral defection, but only just. */
export const DONATION_GAME: DilemmaPayoffs = {
  matrix: {
    cooperate: { cooperate: [2, 2], defect: [-1, 3] },
    defect: { cooperate: [3, -1], defect: [0, 0] },
  },
}

export const DILEMMA_OPPONENTS: DilemmaOpponent[] = [
  {
    id: 'always-cooperate',
    label: 'Always cooperates',
    description: 'Never defects, whatever you do. The most forgiving opponent there is.',
    policy: 'always-cooperate',
    rationale: 'This opponent cooperates in every round regardless of your action.',
  },
  {
    id: 'always-defect',
    label: 'Always defects',
    description: 'Defects every round. The one-shot equilibrium, extended forever.',
    policy: 'always-defect',
    rationale: 'This opponent defects in every round regardless of your action.',
  },
  {
    id: 'tit-for-tat',
    label: 'Tit for tat',
    description: 'Cooperates first, then copies whatever you did last round.',
    policy: 'tit-for-tat',
    rationale: 'Tit for tat copies your previous move.',
  },
  {
    id: 'grim-trigger',
    label: 'Grim trigger',
    description: 'Cooperates until you defect once, then never cooperates again.',
    policy: 'grim-trigger',
    rationale: 'Grim trigger punishes a single defection permanently.',
  },
]

export const DILEMMA_OPPONENT_BY_ID = new Map(DILEMMA_OPPONENTS.map((entry) => [entry.id, entry]))

/** The opponent's move in a round, given the history so far. */
export function opponentMove(opponent: DilemmaOpponent, history: DilemmaAction[]): DilemmaAction {
  switch (opponent.policy) {
    case 'always-cooperate':
      return 'cooperate'
    case 'always-defect':
      return 'defect'
    case 'tit-for-tat':
      return history.length === 0 ? 'cooperate' : (history[history.length - 1] ?? 'cooperate')
    case 'grim-trigger':
      return history.includes('defect') ? 'defect' : 'cooperate'
  }
}

function payoff(payoffs: DilemmaPayoffs, myAction: DilemmaAction, theirAction: DilemmaAction) {
  const [mine, theirs] = payoffs.matrix[myAction][theirAction]
  return { my: mine, their: theirs }
}

/** True when defection gives strictly more than cooperation, whatever the opponent does. */
export function defectionDominates(payoffs: DilemmaPayoffs = PRISONERS_DILEMMA): boolean {
  return (
    payoffs.matrix.defect.cooperate[0] > payoffs.matrix.cooperate.cooperate[0] &&
    payoffs.matrix.defect.defect[0] > payoffs.matrix.cooperate.defect[0]
  )
}

/**
 * Play the rounds of a dilemma.
 *
 * This is the primitive: it does not compute any totals beyond the running
 * sums, so it can be called from both `runDilemma` and
 * `optimalTotalAgainst` without the two recursing into each other.
 */
function playRounds(
  opponent: DilemmaOpponent,
  horizon: number,
  myPolicy: DilemmaAction | ((history: DilemmaAction[]) => DilemmaAction),
  payoffs: DilemmaPayoffs,
): DilemmaRound[] {
  const rounds: DilemmaRound[] = []
  const history: DilemmaAction[] = []

  for (let round = 0; round < horizon; round += 1) {
    const myAction = typeof myPolicy === 'function' ? myPolicy([...history]) : myPolicy
    const theirAction = opponentMove(opponent, history)
    const earned = payoff(payoffs, myAction, theirAction)
    history.push(myAction)

    rounds.push({
      round: round + 1,
      myAction,
      theirAction,
      myPayoff: earned.my,
      theirPayoff: earned.their,
      note:
        history.length === 1
          ? opponent.rationale
          : `${opponent.rationale} You ${myAction === 'cooperate' ? 'cooperated' : 'defected'} in round ${round}.`,
    })
  }

  return rounds
}

/**
 * Play a dilemma against a scripted opponent.
 *
 * `myPolicy` decides the student's action in each round. It can be a fixed
 * action or a function of the history, which is how the "always cooperate",
 * "always defect" and "tit for tat" reference strategies are expressed.
 */
export function runDilemma(
  opponent: DilemmaOpponent,
  horizon: number,
  myPolicy: DilemmaAction | ((history: DilemmaAction[]) => DilemmaAction),
  payoffs: DilemmaPayoffs = PRISONERS_DILEMMA,
): DilemmaRun {
  const rounds = playRounds(opponent, horizon, myPolicy, payoffs)
  const myTotal = rounds.reduce((total, round) => total + round.myPayoff, 0)
  const theirTotal = rounds.reduce((total, round) => total + round.theirPayoff, 0)

  // The best achievable total is found by trying every action sequence, which
  // is cheap for the horizons used here and avoids assuming a policy.
  const bestPossibleMyTotal = bestTotalAgainst(opponent, horizon, payoffs)
  const optimalMyTotal = optimalTotalAgainst(opponent, horizon, payoffs)

  const reachedOptimal = myTotal >= optimalMyTotal

  const summary =
    horizon === 1
      ? `One-shot game: defect–defect is the only Nash equilibrium, so the maximum you can get is ${optimalMyTotal}. You got ${myTotal}.`
      : `Over ${horizon} rounds against ${opponent.label.toLowerCase()}, the best you can do is ${bestPossibleMyTotal} and optimal play gets ${optimalMyTotal}. You got ${myTotal}.`

  return {
    opponent,
    horizon,
    rounds,
    myTotal,
    theirTotal,
    bestPossibleMyTotal,
    optimalMyTotal,
    reachedOptimal,
    summary,
  }
}

/** The highest total achievable against this opponent, by any action sequence. */
export function bestTotalAgainst(opponent: DilemmaOpponent, horizon: number, payoffs: DilemmaPayoffs = PRISONERS_DILEMMA): number {
  let best = Number.NEGATIVE_INFINITY
  for (let mask = 0; mask < 2 ** horizon; mask += 1) {
    const history: DilemmaAction[] = []
    let total = 0
    for (let round = 0; round < horizon; round += 1) {
      const myAction: DilemmaAction = (mask >> round) & 1 ? 'defect' : 'cooperate'
      const theirAction = opponentMove(opponent, history)
      total += payoff(payoffs, myAction, theirAction).my
      history.push(myAction)
    }
    best = Math.max(best, total)
  }
  return best
}

/**
 * The total a rational player gets against this opponent.
 *
 * Against a forgiving opponent, defecting every round is optimal. Against a
 * punishing one, cooperation pays: grim trigger and tit for tat both punish
 * defection, so a rational player cooperates throughout.
 */
/**
 * The total an optimal player gets against this opponent.
 *
 * This is backward induction over a *finite* repeated game, and it is not the
 * same as "always cooperate":
 *
 *  - Against an opponent that never punishes, defecting every round is optimal.
 *  - Against an opponent that punishes, cooperation pays for every round
 *    *except the last one*: in the final period there is no future to protect,
 *    so a rational player defects and takes the temptation payoff. This is the
 *    classic finite-horizon effect, and it is why "cooperate forever" is not
 *    the equilibrium of a repeated game that ends.
 *
 * With a horizon of one, this reduces to the one-shot equilibrium: defect.
 *
 * Note that this is a *best-response* calculation against a known opponent
 * policy, not a Nash equilibrium of the underlying game.
 */
export function optimalTotalAgainst(
  opponent: DilemmaOpponent,
  horizon: number,
  payoffs: DilemmaPayoffs = PRISONERS_DILEMMA,
): number {
  const policy: (history: DilemmaAction[]) => DilemmaAction =
    opponent.policy === 'always-cooperate' || opponent.policy === 'always-defect'
      ? () => 'defect'
      : (history) => (history.length === horizon - 1 ? 'defect' : 'cooperate')
  // Uses the round primitive directly, so it does not recurse back through
  // `runDilemma`.
  return playRounds(opponent, horizon, policy, payoffs).reduce((total, round) => total + round.myPayoff, 0)
}

/** Reference strategies a student can play with. */
export const DILEMMA_STRATEGIES: { id: string; label: string; description: string; policy: (history: DilemmaAction[]) => DilemmaAction }[] = [
  {
    id: 'cooperate',
    label: 'Always cooperate',
    description: 'Cooperate in every round, whatever the opponent does.',
    policy: () => 'cooperate',
  },
  {
    id: 'defect',
    label: 'Always defect',
    description: 'Defect in every round. The one-shot equilibrium strategy.',
    policy: () => 'defect',
  },
  {
    id: 'tit-for-tat',
    label: 'Tit for tat',
    description: 'Cooperate first, then copy the opponent’s last move.',
    policy: (history) => (history.length === 0 ? 'cooperate' : (history[history.length - 1] ?? 'cooperate')),
  },
  {
    id: 'grim',
    label: 'Grim trigger',
    description: 'Cooperate until the opponent defects once, then never cooperate again.',
    policy: (history) => (history.includes('defect') ? 'defect' : 'cooperate'),
  },
]
