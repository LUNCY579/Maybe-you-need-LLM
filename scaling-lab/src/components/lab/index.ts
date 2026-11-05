import type { ComponentType } from 'react'
import { PowerLawLab, POWERLAW_VIEWS } from './PowerLawLab'
import { ComputeLab, COMPUTE_VIEWS } from './ComputeLab'
import { IsoFlopLab, ISOFLOP_VIEWS } from './IsoFlopLab'
import { PercolationLab, PERCOLATION_VIEWS } from './PercolationLab'
import { EpochsLab, EPOCHS_VIEWS } from './EpochsLab'
import { RepeatsLab, REPEATS_VIEWS } from './RepeatsLab'
import { EmergenceLab, EMERGENCE_VIEWS } from './EmergenceLab'
import { HardwareLab, HARDWARE_VIEWS } from './HardwareLab'

/**
 * The screen for each registered laboratory id.
 *
 * A record rather than a chain of conditionals, so that the test over the registry
 * can ask one question — is there a screen for every id, and an id for every screen —
 * and answer it for all eight at once.
 *
 * The key is the route segment: `/labs/isoflop` renders the third value here, and
 * `src/content/labs.ts` is the list of keys this one has to cover.
 */
export const LAB_SCREENS: Record<string, ComponentType> = {
  powerlaw: PowerLawLab,
  compute: ComputeLab,
  isoflop: IsoFlopLab,
  percolation: PercolationLab,
  epochs: EpochsLab,
  repeats: RepeatsLab,
  emergence: EmergenceLab,
  hardware: HardwareLab,
}

/**
 * The tabs each screen offers, read off the screen itself.
 *
 * A lesson deep-links to one of these by name, so this is the list the curriculum
 * is checked against: a lesson that asks for a view the screen does not have is a
 * link that would quietly open the wrong panel.
 */
export const LAB_VIEWS: Record<string, readonly { value: string; label: string }[]> = {
  powerlaw: POWERLAW_VIEWS,
  compute: COMPUTE_VIEWS,
  isoflop: ISOFLOP_VIEWS,
  percolation: PERCOLATION_VIEWS,
  epochs: EPOCHS_VIEWS,
  repeats: REPEATS_VIEWS,
  emergence: EMERGENCE_VIEWS,
  hardware: HARDWARE_VIEWS,
}
