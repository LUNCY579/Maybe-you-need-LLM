/**
 * Progress persistence.
 *
 * Everything is stored in the browser's localStorage under one versioned key.
 * No network calls, no accounts, no analytics: a learning dashboard that works
 * offline is the whole point.
 */

import { useCallback, useEffect, useState } from 'react';
import { sanitizeSetup, type SharedSetup } from './sharedSetup';

export const STORAGE_KEY = 'dlte.progress.v1';

export interface QuizAttempt {
  questionId: string;
  correct: boolean;
  answeredAt: string;
  /** the option the learner picked */
  choice: number;
}

export interface ExperimentRun {
  id: string;
  lab: string;
  presetId?: string;
  /** a short human-readable summary of the settings */
  summary: string;
  ranAt: string;
  /** headline numbers produced by the run, for the dashboard */
  metrics: Record<string, number | string>;
  /**
   * The shared setup the run was made with.
   *
   * A log of experiments that cannot be repeated is a diary, not a record. The
   * settings are kept so that the run can be brought back exactly as it was —
   * the same activation, the same seed, the same width — which is the only way
   * to check the numbers it reports.
   */
  setup?: Partial<SharedSetup>;
}

export interface Progress {
  version: 1;
  lessons: Record<string, { completed: boolean; bookmarked: boolean; lastViewedAt?: string }>;
  exercises: Record<string, { lessonId: string; index: number; solved: boolean }>;
  quiz: QuizAttempt[];
  runs: ExperimentRun[];
  /** ids of equations the learner has opened */
  equationsViewed: string[];
  /** the learner's own notes, keyed by lesson id */
  notes: Record<string, string>;
  updatedAt: string;
}

export function emptyProgress(): Progress {
  return {
    version: 1,
    lessons: {},
    exercises: {},
    quiz: [],
    runs: [],
    equationsViewed: [],
    notes: {},
    updatedAt: new Date().toISOString(),
  };
}

function isProgress(v: unknown): v is Progress {
  if (!v || typeof v !== 'object') return false;
  const p = v as Partial<Progress>;
  return p.version === 1 && typeof p.lessons === 'object' && Array.isArray(p.quiz) && Array.isArray(p.runs);
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed: unknown = JSON.parse(raw);
    if (!isProgress(parsed)) return emptyProgress();
    return { ...emptyProgress(), ...parsed, equationsViewed: parsed.equationsViewed ?? [] };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...p, updatedAt: new Date().toISOString() }));
    return true;
  } catch {
    /*
     * Storage full or disabled. The record lives only in memory for this
     * session, and the reader is told so rather than being left to believe
     * that a note they just wrote has been kept.
     */
    return false;
  }
}

/** React hook exposing the progress record plus the mutations the app performs. */
export function useProgress() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [persistenceFailed, setPersistenceFailed] = useState(false);

  useEffect(() => {
    setPersistenceFailed(!saveProgress(progress));
  }, [progress]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setProgress(loadProgress());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setLesson = useCallback((lessonId: string, patch: Partial<{ completed: boolean; bookmarked: boolean }>) => {
    setProgress((p) => ({
      ...p,
      lessons: {
        ...p.lessons,
        [lessonId]: { ...{ completed: false, bookmarked: false }, ...p.lessons[lessonId], ...patch, lastViewedAt: new Date().toISOString() },
      },
    }));
  }, []);

  const setExercise = useCallback((lessonId: string, index: number, solved: boolean) => {
    const key = `${lessonId}:${index}`;
    setProgress((p) => ({ ...p, exercises: { ...p.exercises, [key]: { lessonId, index, solved } } }));
  }, []);

  const setNote = useCallback((lessonId: string, note: string) => {
    setProgress((p) => {
      const notes = { ...p.notes };
      if (note.trim()) notes[lessonId] = note;
      else delete notes[lessonId];
      return { ...p, notes };
    });
  }, []);

  const recordQuiz = useCallback((attempt: QuizAttempt) => {
    setProgress((p) => ({ ...p, quiz: [...p.quiz.filter((a) => a.questionId !== attempt.questionId), attempt] }));
  }, []);

  const recordRun = useCallback((run: ExperimentRun) => {
    setProgress((p) => ({ ...p, runs: [run, ...p.runs].slice(0, 100) }));
  }, []);

  const viewEquation = useCallback((id: string) => {
    setProgress((p) => (p.equationsViewed.includes(id) ? p : { ...p, equationsViewed: [...p.equationsViewed, id] }));
  }, []);

  const reset = useCallback(() => setProgress(emptyProgress()), []);

  const exportJson = useCallback(() => JSON.stringify(progress, null, 2), [progress]);

  /**
   * Replace the stored record with one the learner pasted in.
   *
   * The payload is untrusted: it is checked against the shape the application
   * expects, and anything that does not fit is dropped rather than imported.
   * A file from another machine therefore restores cleanly, and a malformed one
   * cannot corrupt the record.
   */
  const importJson = useCallback((text: string): { ok: boolean; message: string } => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, message: 'That is not valid JSON.' };
    }
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, message: 'The file does not contain a progress record.' };
    }
    const raw = parsed as Partial<Progress>;
    if (raw.version !== 1) {
      return { ok: false, message: `Unsupported record version ${String(raw.version)}; this build reads version 1.` };
    }
    const clean = emptyProgress();
    if (raw.lessons && typeof raw.lessons === 'object') {
      for (const [id, v] of Object.entries(raw.lessons)) {
        if (!v || typeof v !== 'object') continue;
        const s = v as { completed?: unknown; bookmarked?: unknown; lastViewedAt?: unknown };
        clean.lessons[id] = {
          completed: Boolean(s.completed),
          bookmarked: Boolean(s.bookmarked),
          lastViewedAt: typeof s.lastViewedAt === 'string' ? s.lastViewedAt : undefined,
        };
      }
    }
    if (raw.exercises && typeof raw.exercises === 'object') {
      for (const [key, v] of Object.entries(raw.exercises)) {
        if (!v || typeof v !== 'object') continue;
        const e = v as { lessonId?: unknown; index?: unknown; solved?: unknown };
        if (typeof e.lessonId !== 'string' || typeof e.index !== 'number') continue;
        clean.exercises[key] = { lessonId: e.lessonId, index: e.index, solved: Boolean(e.solved) };
      }
    }
    if (Array.isArray(raw.quiz)) {
      clean.quiz = raw.quiz.filter(
        (a): a is QuizAttempt =>
          !!a && typeof a === 'object' && typeof (a as QuizAttempt).questionId === 'string',
      );
    }
    if (Array.isArray(raw.runs)) {
      clean.runs = raw.runs
        .filter(
          (r): r is ExperimentRun =>
            !!r && typeof r === 'object' && typeof (r as ExperimentRun).id === 'string',
        )
        .map((r) => ({
          ...r,
          // the settings a run carries are untrusted like everything else in
          // the record, and they are restored into the shared setup
          setup: r.setup ? sanitizeSetup(r.setup as Record<string, unknown>) : undefined,
        }))
        .slice(0, 100);
    }
    if (Array.isArray(raw.equationsViewed)) {
      clean.equationsViewed = raw.equationsViewed.filter((v): v is string => typeof v === 'string');
    }
    if (raw.notes && typeof raw.notes === 'object') {
      for (const [id, note] of Object.entries(raw.notes)) {
        if (typeof note === 'string' && note.trim()) clean.notes[id] = note;
      }
    }
    setProgress(clean);
    return {
      ok: true,
      message: `Imported ${Object.keys(clean.lessons).length} lessons, ${Object.keys(clean.exercises).length} exercises, ${clean.quiz.length} answers and ${clean.runs.length} runs.`,
    };
  }, []);

  return { progress, persistenceFailed, setLesson, setExercise, setNote, recordQuiz, recordRun, viewEquation, reset, exportJson, importJson };
}

export function quizScore(progress: Progress) {
  const attempted = progress.quiz.length;
  const correct = progress.quiz.filter((a) => a.correct).length;
  return { attempted, correct, accuracy: attempted ? correct / attempted : Number.NaN };
}
