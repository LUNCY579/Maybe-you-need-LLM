import type { ComponentType } from 'react'
import { SparseLab } from './SparseLab'
import { DenseLab } from './DenseLab'
import { LateLab } from './LateLab'
import { ContextLab } from './ContextLab'

/**
 * The screen for each laboratory id.
 *
 * Held beside the registry so a test can compare the two lists: a laboratory
 * with no screen and a screen with no laboratory are both mistakes the
 * navigation would otherwise hide.
 */
export const LAB_SCREENS: Record<string, ComponentType> = {
  sparse: SparseLab,
  dense: DenseLab,
  late: LateLab,
  context: ContextLab,
}
