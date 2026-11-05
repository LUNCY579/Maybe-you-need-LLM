import { describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  emptyProgress,
  loadProgress,
  saveProgress,
  useProgress,
} from '../src/lib/persistence';

/**
 * Progress persistence and the import path.
 *
 * The learner's record is the only thing this application stores, and it is
 * theirs: it must survive a reload, and it must be possible to move it between
 * machines without corrupting it.
 */
describe('the progress record', () => {
  it('round-trips through localStorage', () => {
    const p = emptyProgress();
    p.lessons['ntk'] = { completed: true, bookmarked: true, lastViewedAt: '2024-01-01T00:00:00.000Z' };
    p.exercises['ntk:0'] = { lessonId: 'ntk', index: 0, solved: true };
    p.quiz.push({ questionId: 'q01', correct: true, answeredAt: '2024-01-01T00:00:00.000Z', choice: 2 });
    p.equationsViewed.push('chi-parallel');
    p.notes['ntk'] = 'the Gram identity is the point';
    saveProgress(p);

    const loaded = loadProgress();
    expect(loaded.lessons.ntk.completed).toBe(true);
    expect(loaded.lessons.ntk.bookmarked).toBe(true);
    expect(loaded.exercises['ntk:0'].solved).toBe(true);
    expect(loaded.quiz[0].questionId).toBe('q01');
    expect(loaded.equationsViewed).toContain('chi-parallel');
    expect(loaded.notes['ntk']).toBe('the Gram identity is the point');
  });

  it('loads a record written before notes existed', () => {
    const legacy = {
      version: 1,
      lessons: { ntk: { completed: true, bookmarked: false } },
      exercises: {},
      quiz: [],
      runs: [],
      equationsViewed: [],
      updatedAt: '2023-01-01T00:00:00.000Z',
    };
    window.localStorage.setItem('dlte.progress.v1', JSON.stringify(legacy));
    const loaded = loadProgress();
    expect(loaded.lessons.ntk.completed).toBe(true);
    expect(loaded.notes).toEqual({});
  });
});

describe('the import path', () => {
  /** exercise the real hook, not a copy of its rules */
  function importRecord(text: string) {
    const { result } = renderHook(() => useProgress());
    return { outcome: result.current.importJson(text), progress: result.current.progress };
  }

  it('refuses malformed JSON', () => {
    expect(importRecord('{not json').outcome.ok).toBe(false);
  });

  it('refuses a record that is not an object', () => {
    expect(importRecord('[1,2,3]').outcome.ok).toBe(false);
    expect(importRecord('"a string"').outcome.ok).toBe(false);
  });

  it('refuses a record from a different version', () => {
    expect(importRecord(JSON.stringify({ version: 99 })).outcome.ok).toBe(false);
  });

  it('accepts a well-formed record and installs it', () => {
    const record = { ...emptyProgress(), lessons: { ntk: { completed: true, bookmarked: false } } };
    const { outcome } = importRecord(JSON.stringify(record));
    expect(outcome.ok).toBe(true);
  });

  it('drops malformed entries instead of importing them', async () => {
    const record = {
      version: 1,
      lessons: { good: { completed: true, bookmarked: false }, bad: 'not an object' },
      exercises: { 'a:0': { lessonId: 'a', index: 0, solved: true }, 'b:0': { lessonId: 5 } },
      quiz: [{ questionId: 'q01', correct: true, answeredAt: '', choice: 0 }, { nope: true }],
      runs: [],
      equationsViewed: ['chi-parallel', 42],
      notes: { good: 'a note', bad: 7 },
    };
    const { result } = renderHook(() => useProgress());
    let outcome = { ok: false, message: '' };
    act(() => {
      outcome = result.current.importJson(JSON.stringify(record));
    });
    expect(outcome.ok).toBe(true);

    // the state update lands on the next render
    await waitFor(() => expect(result.current.progress.lessons.good?.completed).toBe(true));
    const p = result.current.progress;
    expect(p.lessons.bad).toBeUndefined();
    expect(p.exercises['a:0'].solved).toBe(true);
    expect(p.exercises['b:0']).toBeUndefined();
    expect(p.quiz).toHaveLength(1);
    expect(p.equationsViewed).toEqual(['chi-parallel']);
    expect(p.notes.good).toBe('a note');
    expect(p.notes.bad).toBeUndefined();
  });
});

describe('when the browser will not store the record', () => {
  /**
   * A note that says "saved as you type" and is not saved is a lie, so the
   * failure has to be visible. These tests make the store refuse the write.
   */
  function breakStorage() {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    const stub = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
    Object.defineProperty(window, 'localStorage', { value: stub, configurable: true, writable: true });
    return () => {
      if (original) Object.defineProperty(window, 'localStorage', original);
    };
  }

  it('reports that the write failed instead of failing silently', () => {
    const restore = breakStorage();
    try {
      expect(saveProgress(emptyProgress())).toBe(false);
    } finally {
      restore();
    }
  });

  it('reports success when the store works', () => {
    expect(saveProgress(emptyProgress())).toBe(true);
  });

  it('tells the reader through the hook', async () => {
    const restore = breakStorage();
    try {
      const { result } = renderHook(() => useProgress());
      await waitFor(() => expect(result.current.persistenceFailed).toBe(true));
    } finally {
      restore();
    }
  });
});
