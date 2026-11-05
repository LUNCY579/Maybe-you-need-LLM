import { runTaskDirect, type TaskName } from './experimentTasks';
import type { WorkerRequest, WorkerResponse } from '../workers/experiment.worker';

/**
 * The worker client.
 *
 * If the worker cannot be created — an old browser, a restrictive policy, a
 * test environment without workers — the task runs directly on the calling
 * thread instead. The results are identical; only the responsiveness differs.
 * That is why the fallback calls the *same* function rather than a
 * re-implementation.
 */

let worker: Worker | null = null;
let workerUnavailable = false;
let nextId = 1;

const pending = new Map<number, { resolve: (value: WorkerResponse) => void; reject: (reason: Error) => void }>();

function ensureWorker(): Worker | null {
  if (worker || workerUnavailable) return worker;
  if (typeof Worker === 'undefined') {
    workerUnavailable = true;
    return null;
  }
  try {
    worker = new Worker(new URL('../workers/experiment.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const entry = pending.get(event.data.id);
      if (!entry) return;
      pending.delete(event.data.id);
      if (event.data.ok) entry.resolve(event.data);
      else entry.reject(new Error(event.data.error ?? 'the measurement failed'));
    };
    worker.onerror = () => {
      // The worker died: fail every outstanding request so the caller can fall back.
      workerUnavailable = true;
      for (const [, entry] of pending) entry.reject(new Error('the worker stopped'));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
    return worker;
  } catch {
    workerUnavailable = true;
    return null;
  }
}

/** True when the measurements can be kept off the main thread. */
export function workerAvailable(): boolean {
  return typeof Worker !== 'undefined' && !workerUnavailable;
}

/**
 * Run an experiment task, in a worker when possible.
 *
 * The result is the same either way; the elapsed time is the measured duration
 * of the computation itself, not of the round trip.
 */
export async function runTask<T extends TaskName>(
  task: T,
  config: unknown,
): Promise<{ result: TaskMapResult<T>; durationMs: number; offThread: boolean }> {
  const w = ensureWorker();
  if (!w) {
    const started = performance.now();
    const result = runTaskDirect(task, config) as TaskMapResult<T>;
    return { result, durationMs: performance.now() - started, offThread: false };
  }
  const id = nextId++;
  const request: WorkerRequest = { id, task, config };
  try {
    const response = await new Promise<WorkerResponse>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      w.postMessage(request);
    });
    return { result: response.result as TaskMapResult<T>, durationMs: response.durationMs, offThread: true };
  } catch (e) {
    /*
     * The worker died with the request in flight — a policy change, a browser
     * that ran out of memory, a killed tab. The measurement is still worth
     * having, so it is run here instead: the same function, on this thread.
     * A task that genuinely failed throws again, with the same message, which
     * is the correct outcome.
     */
    const started = performance.now();
    const result = runTaskDirect(task, config) as TaskMapResult<T>;
    return { result, durationMs: performance.now() - started, offThread: false };
  }
}

type TaskMapResult<T extends TaskName> = ReturnType<typeof runTaskDirect<T>>;
