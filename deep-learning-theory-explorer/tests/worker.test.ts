import { describe, expect, it, afterEach, vi } from 'vitest';
import { runTaskDirect, TASKS, type TaskName } from '../src/lib/experimentTasks';
import { runInitialization, runWidthDepthSweep } from '../src/lib/experiments/kernels';
import { runNtkClosedForm } from '../src/lib/experiments/training';

/**
 * The task registry.
 *
 * The worker and the main thread must produce *the same numbers*, so the
 * registry is the single place that decides what a task means, and the test
 * checks that the two routes agree exactly.
 */
describe('the experiment task registry', () => {
  it('knows every task it is asked to run', () => {
    const names = Object.keys(TASKS);
    expect(names.length).toBeGreaterThanOrEqual(6);
    for (const name of names) {
      expect(typeof TASKS[name as TaskName].run).toBe('function');
    }
  });

  it('rejects a task it does not know', () => {
    expect(() => runTaskDirect('nope' as TaskName, {})).toThrow(/unknown experiment task/);
  });

  it('rejects an invalid configuration with a clear message', () => {
    expect(() => runTaskDirect('initialization', { activation: 'tanh', depth: 1 })).toThrow(
      /depth must be an integer of at least 2/,
    );
    expect(() => runTaskDirect('initialization', { activation: 'tanh', depth: 4, width: 0 })).toThrow(/width must be an integer/);    expect(() => runTaskDirect('initialization', { activation: 'nope' })).toThrow(/unknown activation/);
    expect(() => runTaskDirect('width-depth', { activation: 'tanh', depths: [] })).toThrow(/at least one depth/);
  });

  it('produces the same initialization measurement as the direct call', () => {
    const config = {
      activation: 'tanh' as const,
      Cw: 1,
      Cb: 0,
      depth: 4,
      width: 16,
      samples: 6,
      seeds: 3,
      seed: 7,
      input: { distribution: 'gaussian' as const, scale: 1, dim: 4 },
      initDistribution: 'gaussian' as const,
    };
    const direct = runInitialization(config);
    const viaTask = runTaskDirect('initialization', config);
    expect(viaTask.layers.map((l) => l.measured)).toEqual(direct.layers.map((l) => l.measured));
    expect(viaTask.criticalSelection?.Cw).toBe(direct.criticalSelection?.Cw);
  });

  it('produces the same sweep as the direct call', () => {
    const config = {
      activation: 'linear' as const,
      Cw: 1,
      Cb: 0,
      width: 16,
      depths: [2, 4],
      depth: 2,
      widths: [8, 16],
      samples: 4,
      seeds: 4,
      seed: 3,
    };
    const direct = runWidthDepthSweep(config);
    const viaTask = runTaskDirect('width-depth', config);
    expect(viaTask.depthSweep.map((p) => p.varianceKernel)).toEqual(direct.depthSweep.map((p) => p.varianceKernel));
  });

  it('runs a list of configurations for the initialization laboratory', () => {    const row = {
      activation: 'tanh' as const,
      Cw: 1,
      Cb: 0,
      depth: 3,
      width: 8,
      samples: 4,
      seeds: 2,
      seed: 2,
      input: { distribution: 'gaussian' as const, scale: 1, dim: 4 },
      initDistribution: 'gaussian' as const,
    };
    const results = runTaskDirect('initialization-rows', { rows: [row, { ...row, Cw: 1.4 }] }) as ReturnType<
      typeof runInitialization
    >[];
    expect(results.length).toBe(2);
    expect(results[1].layers[results[1].layers.length - 1].measured).toBeGreaterThan(
      results[0].layers[results[0].layers.length - 1].measured,
    );
  });

  it('compares the two-layer NTK with its closed form, the way the lesson figure does', () => {
    const config = { width: 64, seeds: 4, samples: 5, inputDim: 4, seed: 2024 };
    const direct = runNtkClosedForm(config);
    const viaTask = runTaskDirect('ntk-closed-form', config) as ReturnType<typeof runNtkClosedForm>;
    expect(viaTask.closed).toEqual(direct.closed);
    expect(viaTask.measured).toEqual(direct.measured);
    expect(viaTask.relativeError).toBeCloseTo(direct.relativeError, 12);
  });

  it('and the closed form gets better as the network widens, as the theory says', () => {
    // the finite-width correction is what the two curves disagree about, and it
    // shrinks as the width grows
    const narrow = runNtkClosedForm({ width: 32, seeds: 4, samples: 5, inputDim: 4, seed: 2024 });
    const wide = runNtkClosedForm({ width: 128, seeds: 4, samples: 5, inputDim: 4, seed: 2024 });
    expect(wide.relativeError).toBeLessThan(narrow.relativeError);
  });
});

describe('when the worker dies', () => {
  const original = globalThis.Worker;

  afterEach(() => {
    globalThis.Worker = original;
  });

  /**
   * A worker that accepts the request and then dies without answering, which
   * is what a killed tab or a memory limit looks like from here.
   */
  function dyingWorker() {
    globalThis.Worker = class {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      postMessage() {
        setTimeout(() => this.onerror?.(new Event('error')), 0);
      }
      terminate() {}
    } as unknown as typeof Worker;
  }

  /** A fresh copy of the client, so one test cannot disable the worker for the next. */
  async function freshClient() {
    vi.resetModules();
    return (await import('../src/lib/workerClient')).runTask;
  }

  it('still produces the measurement, on this thread', async () => {
    dyingWorker();
    const runTask = await freshClient();
    const config = {
      activation: 'tanh' as const,
      Cw: 1,
      Cb: 0,
      depth: 3,
      width: 8,
      samples: 4,
      seeds: 2,
      seed: 2,
      input: { distribution: 'gaussian' as const, scale: 1, dim: 4 },
      initDistribution: 'gaussian' as const,
    };
    const { result, offThread } = await runTask('initialization', config);
    expect(offThread).toBe(false);
    const direct = runInitialization(config);
    expect(result.layers.map((l) => l.measured)).toEqual(direct.layers.map((l) => l.measured));
  });

  it('still reports a task that genuinely failed', async () => {
    dyingWorker();
    const runTask = await freshClient();
    await expect(runTask('initialization', { activation: 'tanh', depth: 1 })).rejects.toThrow(
      /depth must be an integer of at least 2/,
    );
  });
});
