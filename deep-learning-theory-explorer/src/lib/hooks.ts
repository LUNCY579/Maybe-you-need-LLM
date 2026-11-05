import { useCallback, useEffect, useRef, useState } from 'react';
import { runTask } from './workerClient';
import { type TaskName } from './experimentTasks';

export interface ComputationState<T> {
  status: 'idle' | 'running' | 'done' | 'error';
  result: T | null;
  error: string | null;
  /** wall-clock time of the last run in milliseconds, measured — not estimated */
  elapsedMs: number;
  /**
   * True when the result on screen is from the previous configuration and a
   * new one is being computed. The numbers are real, but they are the numbers
   * of the settings the reader has just changed away from.
   */
  stale: boolean;
  rerun: () => void;
}

/**
 * Runs a (usually expensive) synchronous computation, yielding to the browser first
 * so that the UI can paint a "computing…" state. The measured duration is exposed
 * because several laboratories display runtime as part of the experiment metadata.
 *
 * The dependencies are debounced. A slider fires a change on every pixel of
 * travel, and without a delay each one would launch a fresh computation; with
 * it, the laboratory computes once, after the control has come to rest.
 */
export function useComputation<T>(
  fn: () => T,
  options: { auto?: boolean; deps?: unknown[]; delay?: number } = {},
): ComputationState<T> {
  const { auto = true, deps = [], delay = 180 } = options;
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>(auto ? 'running' : 'idle');
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsed] = useState(0);
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  // The dependency list is compared by value: its identity changes on every
  // render, so it cannot be used directly as an effect dependency. `appliedRef`
  // starts empty, so the first computation always runs.
  const key = JSON.stringify(deps);
  const appliedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!auto && nonce === 0) return;
    if (key === appliedRef.current && nonce === 0) return;
    setStatus('running');
    setError(null);
    let alive = true;
    const timer = window.setTimeout(() => {
      const t0 = performance.now();
      try {
        const value = fnRef.current();
        if (!alive) return;
        setResult(value);
        setElapsed(performance.now() - t0);
        setStatus('done');
        appliedRef.current = key;
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
        appliedRef.current = key;
      }
    }, delay);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, auto, key, delay]);

  const rerun = useCallback(() => setNonce((n) => n + 1), []);
  return { status, result, error, elapsedMs, stale: status === 'running' && result !== null, rerun };
}

/** Debounce a value so that dragging a slider does not launch a heavy computation per pixel. */
export function useDebounced<T>(value: T, delay = 240): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export interface AsyncComputationState<T> {
  status: 'idle' | 'running' | 'done' | 'error';
  result: T | null;
  error: string | null;
  /** measured duration of the computation itself */
  elapsedMs: number;
  /** true when the computation ran in a worker rather than on the main thread */
  offThread: boolean;
  /**
   * True when the result on screen is from the previous configuration and a
   * new one is being computed. The numbers are real, but they are the numbers
   * of the settings the reader has just changed away from, and they should not
   * be read as if they were the new ones.
   */
  stale: boolean;
  rerun: () => void;
}

/**
 * Run an experiment task without blocking the interface.
 *
 * The heavy measurements are dispatched to a worker, so the page stays
 * responsive while a sweep is running. The dependencies are debounced, so a
 * slider that fires a change on every pixel of travel produces one
 * measurement, not dozens.
 */
export function useAsyncComputation<T>(
  task: TaskName,
  config: unknown,
  options: { delay?: number; enabled?: boolean } = {},
): AsyncComputationState<T> {
  const { delay = 200, enabled = true } = options;
  const [status, setStatus] = useState<AsyncComputationState<T>['status']>('running');
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsed] = useState(0);
  const [offThread, setOffThread] = useState(false);
  const [nonce, setNonce] = useState(0);

  // The configuration is compared by value: its identity changes on every
  // render, so it cannot be used directly as an effect dependency.
  const key = JSON.stringify(config);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setStatus('running');
    setError(null);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          /*
           * `runTask` runs the measurement on this thread if the worker cannot
           * be used or dies with the request in flight, so a rejection here
           * means the measurement itself failed, and the message is the one the
           * task raised.
           */
          const { result: value, durationMs, offThread: off } = await runTask(task, config);
          if (!alive) return;
          setResult(value as T);
          setElapsed(durationMs);
          setOffThread(off);
          setStatus('done');
        } catch (e) {
          if (!alive) return;
          setError(e instanceof Error ? e.message : String(e));
          setStatus('error');
        }
      })();
    }, delay);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, key, task, delay, enabled]);

  const rerun = useCallback(() => setNonce((n) => n + 1), []);
  return { status, result, error, elapsedMs, offThread, stale: status === 'running' && result !== null, rerun };
}

export interface PausableRunState<T> {
  /** the most recent value produced by the generator */
  value: T | null;
  /** true while the generator is still producing values */
  running: boolean;
  /** true when the generator has finished */
  done: boolean;
  /** true while the run is suspended by the user */
  paused: boolean;
  pause: () => void;
  resume: () => void;
  /** restart from the beginning */
  restart: () => void;
}

/**
 * Drive a generator from the interface, one yield per animation frame, with a
 * pause that the user controls.
 *
 * This is how the representation laboratory stays responsive during a long
 * training run: the generator advances in small pieces, the browser paints
 * between them, and the user can suspend the run and inspect the current
 * weights.
 */
export function usePausableGenerator<T>(
  factory: () => Generator<T, void, unknown>,
  deps: unknown[],
): PausableRunState<T> {
  const [value, setValue] = useState<T | null>(null);
  const [running, setRunning] = useState(true);
  const [done, setDone] = useState(false);
  const [paused, setPaused] = useState(false);
  const [nonce, setNonce] = useState(0);
  const pausedRef = useRef(false);
  const factoryRef = useRef(factory);
  factoryRef.current = factory;

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const generator = factoryRef.current();
    setValue(null);
    setRunning(true);
    setDone(false);

    const tick = () => {
      if (cancelled) return;
      if (pausedRef.current) {
        timer = window.setTimeout(tick, 120);
        return;
      }
      const next = generator.next();
      if (cancelled) return;
      if (next.value !== undefined) setValue(next.value);
      if (next.done) {
        setRunning(false);
        setDone(true);
        return;
      }
      setRunning(true);
      timer = window.setTimeout(tick, 0);
    };
    timer = window.setTimeout(tick, 30);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);
  }, []);

  const restart = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);
    setNonce((n) => n + 1);
  }, []);

  return { value, running, done, paused, pause, resume, restart };
}
