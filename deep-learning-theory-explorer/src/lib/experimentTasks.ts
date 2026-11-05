import { runInitialization, runPhysicsLab, runWidthDepthSweep } from './experiments/kernels';
import { runNtkAnalysis, runNtkClosedForm, runNtkDrift, runNtkWidthScaling, runRepresentation } from './experiments/training';
import { getClassificationDataset } from './numerics/datasets';

/**
 * The experiment tasks.
 *
 * A task is a pure function of a configuration, with a JSON-serialisable
 * result. Keeping them in one module means the worker and the main thread run
 * *exactly* the same code: the fallback path is not a re-implementation, it is
 * the same function called directly.
 *
 * The tasks are the ones that can take a second or more — the ones a reader
 * notices as a frozen page.
 */

export interface TaskMap {
  initialization: {
    run: typeof runInitialization;
    config: Parameters<typeof runInitialization>[0];
    result: ReturnType<typeof runInitialization>;
  };
  'initialization-rows': {
    run: (config: { rows: Parameters<typeof runInitialization>[0][] }) => ReturnType<typeof runInitialization>[];
    config: { rows: Parameters<typeof runInitialization>[0][] };
    result: ReturnType<typeof runInitialization>[];
  };
  physics: {
    run: typeof runPhysicsLab;
    config: Parameters<typeof runPhysicsLab>[0];
    result: ReturnType<typeof runPhysicsLab>;
  };
  'width-depth': {
    run: typeof runWidthDepthSweep;
    config: Parameters<typeof runWidthDepthSweep>[0];
    result: ReturnType<typeof runWidthDepthSweep>;
  };
  ntk: {
    run: typeof runNtkAnalysis;
    config: Parameters<typeof runNtkAnalysis>[0];
    result: ReturnType<typeof runNtkAnalysis>;
  };
  'ntk-scaling': {
    run: typeof runNtkWidthScaling;
    config: Parameters<typeof runNtkWidthScaling>[0];
    result: ReturnType<typeof runNtkWidthScaling>;
  };
  'ntk-closed-form': {
    run: typeof runNtkClosedForm;
    config: Parameters<typeof runNtkClosedForm>[0];
    result: ReturnType<typeof runNtkClosedForm>;
  };
  'ntk-drift': {
    run: (config: Parameters<typeof runNtkDrift>[1]) => ReturnType<typeof runNtkDrift>;
    config: Parameters<typeof runNtkDrift>[1];
    result: ReturnType<typeof runNtkDrift>;
  };
  representation: {
    run: typeof runRepresentation;
    config: Parameters<typeof runRepresentation>[0];
    result: ReturnType<typeof runRepresentation>;
  };
}

export type TaskName = keyof TaskMap;

/** Run a task directly, on the thread that calls it. */
export function runTaskDirect<T extends TaskName>(task: T, config: unknown): TaskMap[T]['result'] {
  const entry = (TASKS as unknown as Record<string, { run: (c: unknown) => unknown }>)[task];
  if (!entry) throw new Error(`unknown experiment task "${task}"`);
  return entry.run(config) as TaskMap[T]['result'];
}

export const TASKS: TaskMap = {
  initialization: { run: runInitialization, config: {} as never, result: undefined as never },
  'initialization-rows': {
    run: (config: { rows: Parameters<typeof runInitialization>[0][] }) => config.rows.map((row) => runInitialization(row)),
    config: { rows: [] },
    result: undefined as never,
  },
  physics: { run: runPhysicsLab, config: {} as never, result: undefined as never },
  'width-depth': { run: runWidthDepthSweep, config: {} as never, result: undefined as never },
  ntk: { run: runNtkAnalysis, config: {} as never, result: undefined as never },
  'ntk-scaling': { run: runNtkWidthScaling, config: {} as never, result: undefined as never },
  'ntk-closed-form': { run: runNtkClosedForm, config: {} as never, result: undefined as never },
  'ntk-drift': {
    run: (config: Parameters<typeof runNtkDrift>[1]) =>
      runNtkDrift(getClassificationDataset('two-moons', 40, 3), config),
    config: {} as never,
    result: undefined as never,
  },
  representation: { run: runRepresentation, config: {} as never, result: undefined as never },
};
