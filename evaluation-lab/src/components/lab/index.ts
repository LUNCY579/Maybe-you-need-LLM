import type { ComponentType } from 'react'
import { JudgeLab, JUDGE_VIEWS } from './JudgeLab'
import { BiasesLab, BIAS_VIEWS } from './BiasesLab'
import { ArenaLab, ARENA_VIEWS } from './ArenaLab'
import { BenchmarkLab, BENCHMARK_VIEWS } from './BenchmarkLab'
import { MeasurementLab, MEASUREMENT_VIEWS } from './MeasurementLab'

/** Every laboratory screen, by the id the registry and the URLs use. */
export const LAB_SCREENS: Record<string, ComponentType> = {
  judge: JudgeLab,
  biases: BiasesLab,
  arena: ArenaLab,
  benchmark: BenchmarkLab,
  measurement: MeasurementLab,
}

/** The tabs of every laboratory screen, so lessons and tests can name a view. */
export const LAB_VIEWS: Record<string, { value: string; label: string }[]> = {
  judge: JUDGE_VIEWS,
  biases: BIAS_VIEWS,
  arena: ARENA_VIEWS,
  benchmark: BENCHMARK_VIEWS,
  measurement: MEASUREMENT_VIEWS,
}
