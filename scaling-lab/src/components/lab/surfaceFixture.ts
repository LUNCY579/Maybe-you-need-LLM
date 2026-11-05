import { useMemo } from 'react'
import { buildScalingTask, trainRidge, type ScalingTask } from '../../core/spectral'
import { fitSurface, type SurfaceFit, type SurfacePoint } from '../../core/surface'

/**
 * The ladder of training runs the loss surface is fitted on.
 *
 * Screens B, C and H all need a `SurfaceFit`, and they need it to be the *same* fit:
 * B's optimum, C's frontier and H's feasibility chain are one story about one measured
 * surface, and three separate grids would make the three screens disagree about
 * numbers that are supposed to line up. So they share the fixture rather than each
 * inventing a grid, and the grid is what a reader can see in B's table.
 *
 * Twenty runs, each a closed-form ridge estimator on freshly drawn data and measured
 * on data it never saw. Cheap enough to redo on every control change.
 */
export const GRID_CAPACITIES = [4, 8, 16, 32, 64]
export const GRID_SAMPLES = [50, 200, 800, 3200]

export interface TrainingSurface {
  task: ScalingTask
  points: SurfacePoint[]
  fit: SurfaceFit
}

/** The task, the runs and the fit, memoised against the scenario’s three numbers. */
export function useTrainingSurface(scenario: { decay: number; noise: number; seed: number }): TrainingSurface {
  const { decay, noise, seed } = scenario
  const task = useMemo(() => buildScalingTask({ decay, noise }), [decay, noise])
  const points = useMemo<SurfacePoint[]>(
    () =>
      GRID_CAPACITIES.flatMap((capacity) =>
        GRID_SAMPLES.map((samples) => {
          const run = trainRidge(task, { capacity, samples, seed })
          return { capacity, samples, loss: run.testLoss }
        }),
      ),
    [task, seed],
  )
  const fit = useMemo(() => fitSurface(points), [points])
  return { task, points, fit }
}
