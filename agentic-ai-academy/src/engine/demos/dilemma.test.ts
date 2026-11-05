import { describe, expect, it } from 'vitest'
import {
  DILEMMA_OPPONENTS,
  DILEMMA_OPPONENT_BY_ID,
  PRISONERS_DILEMMA,
  bestTotalAgainst,
  defectionDominates,
  optimalTotalAgainst,
  opponentMove,
  runDilemma,
} from './dilemma'

const alwaysCooperate = DILEMMA_OPPONENT_BY_ID.get('always-cooperate')!
const alwaysDefect = DILEMMA_OPPONENT_BY_ID.get('always-defect')!
const titForTat = DILEMMA_OPPONENT_BY_ID.get('tit-for-tat')!
const grim = DILEMMA_OPPONENT_BY_ID.get('grim-trigger')!

describe('the opponent policies', () => {
  it('always-cooperate cooperates whatever happens', () => {
    expect(opponentMove(alwaysCooperate, [])).toBe('cooperate')
    expect(opponentMove(alwaysCooperate, ['defect', 'defect'])).toBe('cooperate')
  })

  it('always-defect defects whatever happens', () => {
    expect(opponentMove(alwaysDefect, [])).toBe('defect')
    expect(opponentMove(alwaysDefect, ['cooperate'])).toBe('defect')
  })

  it('tit-for-tat cooperates first and then copies', () => {
    expect(opponentMove(titForTat, [])).toBe('cooperate')
    expect(opponentMove(titForTat, ['defect'])).toBe('defect')
    expect(opponentMove(titForTat, ['cooperate'])).toBe('cooperate')
  })

  it('grim trigger punishes one defection permanently', () => {
    expect(opponentMove(grim, [])).toBe('cooperate')
    expect(opponentMove(grim, ['defect'])).toBe('defect')
    expect(opponentMove(grim, ['defect', 'cooperate'])).toBe('defect')
  })
})

describe('the Prisoner\'s Dilemma', () => {
  it('has defection as a dominant strategy', () => {
    expect(defectionDominates(PRISONERS_DILEMMA)).toBe(true)
  })

  it('rewards unilateral defection in the one-shot game', () => {
    const run = runDilemma(alwaysDefect, 1, 'cooperate')
    expect(run.myTotal).toBe(0)
    expect(run.theirTotal).toBe(5)
  })

  it('makes defect–defect the best one-shot outcome', () => {
    const run = runDilemma(alwaysDefect, 1, 'defect')
    expect(run.myTotal).toBe(1)
    expect(run.myTotal).toBe(run.bestPossibleMyTotal)
  })

  it('punishes a defector against a cooperator over the horizon', () => {
    const run = runDilemma(alwaysCooperate, 10, 'defect')
    // Defecting pays 5 each round against a cooperator: 50.
    expect(run.myTotal).toBe(50)
    // But against a tit-for-tat opponent, defecting once collapses the whole game.
    const punished = runDilemma(titForTat, 10, 'defect')
    expect(punished.myTotal).toBeLessThan(runDilemma(titForTat, 10, 'cooperate').myTotal)
  })

  it('sustains cooperation against tit-for-tat over a repeated game', () => {
    const run = runDilemma(titForTat, 10, 'cooperate')
    expect(run.myTotal).toBe(30)
    // But "always cooperate" is not *optimal* in a game that ends: the final
    // round has no future to protect, so a rational player defects there.
    expect(run.reachedOptimal).toBe(false)
    const optimal = runDilemma(titForTat, 10, (history) => (history.length === 9 ? 'defect' : 'cooperate'))
    expect(optimal.myTotal).toBe(32)
    expect(optimal.reachedOptimal).toBe(true)
  })

  it('sustains cooperation against grim trigger only if the player never defects', () => {
    const good = runDilemma(grim, 10, 'cooperate')
    expect(good.myTotal).toBe(30)
    // Defecting earns the temptation payoff once, then grim trigger defects
    // forever: 5 for the defection plus 1 for each of the nine rounds after.
    const bad = runDilemma(grim, 10, 'defect')
    expect(bad.myTotal).toBe(5 + 9)
    expect(bad.myTotal).toBeLessThan(good.myTotal)
  })

  it('reports an optimal total that a cooperator can reach against a forgiving opponent', () => {
    // Against always-cooperate, defecting every round is optimal.
    const equilibrium = optimalTotalAgainst(alwaysCooperate, 10)
    expect(equilibrium).toBe(50)
    // Against tit-for-tat, cooperation pays for every round but the last: in the
    // final period there is no future left to protect.
    expect(optimalTotalAgainst(titForTat, 10)).toBe(9 * 3 + 5)
  })

  it('lets a rational player defect in the final period', () => {
    // Classic finite-horizon effect: 3 per cooperative round, then 5 for the
    // defection in the last round, because the opponent has no future to punish.
    expect(bestTotalAgainst(titForTat, 5)).toBe(4 * 3 + 5)
    expect(bestTotalAgainst(titForTat, 5)).toBe(17)
  })

  it('records one round per horizon step', () => {
    const run = runDilemma(titForTat, 7, 'cooperate')
    expect(run.rounds).toHaveLength(7)
    expect(run.rounds.map((round) => round.round)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('sums the rounds into the totals', () => {
    const run = runDilemma(grim, 4, 'cooperate')
    const sum = run.rounds.reduce((total, round) => total + round.myPayoff, 0)
    expect(run.myTotal).toBe(sum)
  })

  it('is deterministic', () => {
    expect(runDilemma(titForTat, 10, 'cooperate')).toEqual(runDilemma(titForTat, 10, 'cooperate'))
  })

  it('gives every opponent a description and a rationale', () => {
    for (const opponent of DILEMMA_OPPONENTS) {
      expect(opponent.description.length).toBeGreaterThan(10)
      expect(opponent.rationale.length).toBeGreaterThan(10)
    }
  })
})
