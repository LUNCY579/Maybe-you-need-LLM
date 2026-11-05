import type { ComponentType } from 'react'
import { TokenizerLab } from './TokenizerLab'
import { ArchitectureLab } from './ArchitectureLab'
import { AccountingLab } from './AccountingLab'
import { DataLab } from './DataLab'
import { TrainingLab } from './TrainingLab'
import { ScalingLab } from './ScalingLab'
import { SystemsLab } from './SystemsLab'
import { PostTrainingLab } from './PostTrainingLab'
import { CompanionsLab } from './CompanionsLab'

/**
 * The screen for each laboratory id.
 *
 * Kept beside the registry's ids so a test can hold the two lists against each
 * other: a laboratory with no screen and a screen with no laboratory are both
 * mistakes the navigation would otherwise hide.
 */
export const LAB_SCREENS: Record<string, ComponentType> = {
  tokenizer: TokenizerLab,
  architecture: ArchitectureLab,
  accounting: AccountingLab,
  data: DataLab,
  training: TrainingLab,
  scaling: ScalingLab,
  systems: SystemsLab,
  postTraining: PostTrainingLab,
  companions: CompanionsLab,
}
