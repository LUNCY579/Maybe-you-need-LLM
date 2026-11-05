import type { ComponentType } from 'react'
import { ContrastiveLab } from './ContrastiveLab'
import { InstructionLab } from './InstructionLab'
import { SigmoidLab } from './SigmoidLab'
import { FrozenLab } from './FrozenLab'
import { ResamplerLab } from './ResamplerLab'

/**
 * The screen for each laboratory id.
 *
 * Held beside the registry so a test can compare the two lists: a laboratory
 * with no screen and a screen with no laboratory are both mistakes the
 * navigation would otherwise hide.
 */
export const LAB_SCREENS: Record<string, ComponentType> = {
  contrastive: ContrastiveLab,
  instruction: InstructionLab,
  sigmoid: SigmoidLab,
  frozen: FrozenLab,
  resampler: ResamplerLab,
}
