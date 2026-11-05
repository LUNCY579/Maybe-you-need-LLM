/**
 * The scenario each laboratory runs by default.
 *
 * A laboratory exists in two places: the browser, where the sliders start here, and
 * the terminal, where `tools/run-lab.mjs` prints the same numbers without a page to
 * open. That claim is only checkable if both read one list, so the defaults live here
 * rather than inside a `useState` call — and the runner's output is a reproduction of
 * the screen rather than a second opinion about it.
 *
 * These are the *starting* settings. Every screen lets a reader move them; nothing
 * here is a result.
 */

export interface ConstitutionScenario {
  /** The exchanges the loop is run over. */
  exchanges: number
  /** How often the model complies with a harmful request before the critique. */
  compliance: number
  /** How often the judge is wrong about a response it is asked to score. */
  judgeNoise: number
  /** The exchanges the two critics are asked about. */
  cases: number
  seed: number
}

export interface AlignmentScenario {
  demonstrations: number
  /** How often the labelers pick the helpful answer over the safe one. */
  chooseHelpful: number
  learningRate: number
  steps: number
  /** The weighting the two rounds are compared under. */
  helpfulWeight: number
  seed: number
}

export interface RedTeamScenario {
  attacks: number
  compliance: number
  /** Whether the attacker aims at what it has not found yet, which is the screen's toggle. */
  modelDriven: boolean
  /** The failures a hunt is aimed at. */
  failures: number
  /** The total budget the discovery curve is drawn up to. */
  budget: number
  /** How many seeds each point of the curve is averaged over. */
  repetitions: number
  seed: number
}

export interface SleeperScenario {
  /** The labelled examples the classifier is scored against. */
  examples: number
  trainingSize: number
  harmfulRate: number
  /** The share of the labelled harm that rides on the cue rather than on the subject. */
  cuedShareOfHarm: number
  /** How often the cue appears on an example that is not harmful. */
  cuePrevalence: number
  /**
   * Which cue the label sheet the classifier is given names.
   *
   * `carries` is the cue the harm in this corpus actually rides on; `other` is a cue
   * that is present in the data and is not it. The screen starts on `other`, because
   * the finding is what a classifier does with a cue nobody told it about.
   */
  sheet: 'carries' | 'other'
  seed: number
}

export interface PreferenceScenario {
  questions: number
  looks: number
  /** The labeler's latent lean toward the answer that agrees with the user. */
  lean: number
  consistency: number
  /** The share of the questions where the user's stated belief happens to be right. */
  userRightRate: number
  seed: number
}

export interface SycophancyScenario {
  cases: number
  seed: number
}

export interface PrivacyScenario {
  /** The records the prefix attack is run over. */
  records: number
  prefixLength: number
  guesses: number
  /** The candidates the membership attack is shown. */
  candidates: number
  /** The share of the members that appear more than once. */
  repeatShare: number
  /** The most copies a duplicated record is given. */
  maxCount: number
  /** The share of the outsiders that resemble a trained record. */
  nearDuplicateShare: number
  /** The attacker's query budget per candidate. */
  queries: number
  seed: number
}

export const CONSTITUTION_DEFAULTS: ConstitutionScenario = {
  exchanges: 40,
  compliance: 0.5,
  judgeNoise: 0.1,
  cases: 60,
  seed: 3,
}

export const ALIGNMENT_DEFAULTS: AlignmentScenario = {
  demonstrations: 40,
  chooseHelpful: 0.8,
  learningRate: 0.5,
  steps: 12,
  helpfulWeight: 0.5,
  seed: 2,
}

export const REDTEAM_DEFAULTS: RedTeamScenario = {
  attacks: 20,
  compliance: 0.4,
  modelDriven: true,
  failures: 12,
  budget: 192,
  repetitions: 24,
  seed: 5,
}

export const SLEEPER_DEFAULTS: SleeperScenario = {
  examples: 120,
  trainingSize: 240,
  harmfulRate: 0.4,
  cuedShareOfHarm: 0.6,
  cuePrevalence: 0.2,
  sheet: 'other',
  seed: 11,
}

export const PREFERENCE_DEFAULTS: PreferenceScenario = {
  questions: 60,
  looks: 3,
  lean: 0.6,
  consistency: 0.5,
  userRightRate: 0.35,
  seed: 3,
}

export const SYCOPHANCY_DEFAULTS: SycophancyScenario = { cases: 200, seed: 4 }

export const PRIVACY_DEFAULTS: PrivacyScenario = {
  records: 40,
  prefixLength: 3,
  guesses: 4,
  candidates: 200,
  repeatShare: 0.35,
  maxCount: 16,
  nearDuplicateShare: 0.25,
  queries: 16,
  seed: 7,
}

/** Keyed by the laboratory id, so the runner can look a scenario up by the same name as the route. */
export const LAB_DEFAULTS: Record<string, object> = {
  constitution: CONSTITUTION_DEFAULTS,
  alignment: ALIGNMENT_DEFAULTS,
  redteam: REDTEAM_DEFAULTS,
  sleeper: SLEEPER_DEFAULTS,
  preference: PREFERENCE_DEFAULTS,
  sycophancy: SYCOPHANCY_DEFAULTS,
  privacy: PRIVACY_DEFAULTS,
}
