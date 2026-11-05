import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useComputation } from '../src/lib/hooks';

/**
 * The computation hook is what keeps a laboratory responsive. It has two
 * obligations: the first computation must run, and a slider that fires a change
 * on every pixel must not launch a computation on every pixel.
 */
describe('useComputation', () => {
  it('runs the computation on mount', async () => {
    const fn = vi.fn(() => 42);
    const { result } = renderHook(() => useComputation(fn, { deps: [1] }));
    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(result.current.result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('waits for the dependencies to settle before computing', async () => {
    const fn = vi.fn(() => 1);
    const { result, rerender } = renderHook(({ n }) => useComputation(fn, { deps: [n] }), {
      initialProps: { n: 1 },
    });
    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(fn).toHaveBeenCalledTimes(1);

    // a burst of changes, as a slider produces
    for (const n of [2, 3, 4, 5, 6]) {
      rerender({ n });
    }
    // the status reports that something is pending straight away
    expect(result.current.status).toBe('running');

    await waitFor(() => expect(result.current.status).toBe('done'), { timeout: 5000 });
    // and the computation ran once, not five times
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('reports an error instead of throwing', async () => {
    const fn = () => {
      throw new Error('the kernel diverged');
    };
    const { result } = renderHook(() => useComputation(fn, { deps: [1] }));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('the kernel diverged');
    expect(result.current.result).toBeNull();
  });

  it('re-runs on demand', async () => {
    const fn = vi.fn(() => 7);
    const { result } = renderHook(() => useComputation(fn, { deps: [1] }));
    await waitFor(() => expect(result.current.status).toBe('done'));
    act(() => result.current.rerun());
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
  });

  it('does not compute when auto is off, until asked', async () => {
    const fn = vi.fn(() => 3);
    const { result } = renderHook(() => useComputation(fn, { auto: false, deps: [1] }));
    await new Promise((r) => setTimeout(r, 300));
    expect(fn).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });
});
