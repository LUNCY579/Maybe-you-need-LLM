import type { ComponentType } from 'react'
import { ConstitutionLab, CONSTITUTION_VIEWS } from './ConstitutionLab'
import { AlignmentLab, ALIGNMENT_VIEWS } from './AlignmentLab'
import { RedTeamLab, REDTEAM_VIEWS } from './RedTeamLab'
import { SleeperLab, SLEEPER_VIEWS } from './SleeperLab'
import { PreferenceLab, PREFERENCE_VIEWS } from './PreferenceLab'
import { SycophancyLab, SYCOPHANCY_VIEWS } from './SycophancyLab'
import { PrivacyLab, PRIVACY_VIEWS } from './PrivacyLab'

/**
 * The screen for each registered laboratory id.
 *
 * A record rather than a chain of conditionals, so that the test over the registry
 * can ask one question — is there a screen for every id, and an id for every screen —
 * and answer it for all seven at once.
 *
 * The key is the route segment: `/labs/constitution` renders the first value here,
 * and `src/content/labs.ts` is the list of keys this one has to cover.
 */
export const LAB_SCREENS: Record<string, ComponentType> = {
  constitution: ConstitutionLab,
  alignment: AlignmentLab,
  redteam: RedTeamLab,
  sleeper: SleeperLab,
  preference: PreferenceLab,
  sycophancy: SycophancyLab,
  privacy: PrivacyLab,
}

/**
 * The tabs each screen offers, read off the screen itself.
 *
 * A lesson deep-links to one of these by name, so this is the list the curriculum
 * is checked against: a lesson that asks for a view the screen does not have is a
 * link that would quietly open the wrong panel.
 */
export const LAB_VIEWS: Record<string, readonly { value: string; label: string }[]> = {
  constitution: CONSTITUTION_VIEWS,
  alignment: ALIGNMENT_VIEWS,
  redteam: REDTEAM_VIEWS,
  sleeper: SLEEPER_VIEWS,
  preference: PREFERENCE_VIEWS,
  sycophancy: SYCOPHANCY_VIEWS,
  privacy: PRIVACY_VIEWS,
}
