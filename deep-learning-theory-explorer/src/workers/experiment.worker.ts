/// <reference lib="webworker" />
import { runTaskDirect, type TaskName } from '../lib/experimentTasks';

/**
 * The experiment worker.
 *
 * The measurements in the laboratories take from a fraction of a second to
 * several seconds. Running them on the main thread freezes the page for that
 * time; running them here keeps the interface alive, so a reader can move a
 * control, watch the busy indicator, or navigate away while a measurement is in
 * flight.
 *
 * The worker imports the same runner functions the main thread would call, so
 * the numbers are identical either way.
 */

export interface WorkerRequest {
  id: number;
  task: TaskName;
  config: unknown;
}

export interface WorkerResponse {
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, task, config } = event.data;
  const started = performance.now();
  try {
    const result = runTaskDirect(task, config);
    const response: WorkerResponse = { id, ok: true, result, durationMs: performance.now() - started };
    (self as unknown as Worker).postMessage(response);
  } catch (e) {
    const response: WorkerResponse = {
      id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      durationMs: performance.now() - started,
    };
    (self as unknown as Worker).postMessage(response);
  }
};
