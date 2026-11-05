import type { ComponentType } from 'react'
import { DesignLab, DESIGN_VIEWS } from './DesignLab'
import { VerifierLab, VERIFIER_VIEWS } from './VerifierLab'
import { BaselinesLab, BASELINES_VIEWS } from './BaselinesLab'
import { ContaminationLab } from './ContaminationLab'
import { EnvironmentsLab, ENVIRONMENTS_VIEWS } from './EnvironmentsLab'

/** The screen of every laboratory in the registry, by laboratory id. */
export const LAB_SCREENS: Record<string, ComponentType> = {
  design: DesignLab,
  verifier: VerifierLab,
  baselines: BaselinesLab,
  contamination: ContaminationLab,
  environments: EnvironmentsLab,
}

/**
 * The views every screen offers, in the order its tab bar shows them.
 *
 * Contamination has one view and does not put it in the URL; the screen is the
 * whole of its laboratory, so there is nothing for a deep link to choose.
 */
export const LAB_VIEWS: Record<string, readonly { value: string; label: string }[]> = {
  design: DESIGN_VIEWS,
  verifier: VERIFIER_VIEWS,
  baselines: BASELINES_VIEWS,
  contamination: [{ value: 'contamination', label: 'The overlap' }],
  environments: ENVIRONMENTS_VIEWS,
}
