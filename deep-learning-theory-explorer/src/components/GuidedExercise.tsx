import { useMemo, useState } from 'react';
import { Badge, Button } from './ui';
import { getComputedExercise, formatComputed } from '../lib/exercises';
import type { Exercise } from '../content/types';

/**
 * A guided numerical exercise.
 *
 * The answer is not a string in the content file: it is *computed* by the same
 * numerical code the laboratories run (`src/lib/exercises.ts`). The learner
 * types a value, presses check, and the app compares it against the live
 * computation, showing the method used and the accepted tolerance.
 *
 * Nothing is graded into a gradebook — the verdict is a verdict about the
 * number, and the learner is invited to disagree with it.
 */
export function GuidedExercise({
  exercise,
  onSolved,
  solved,
}: {
  exercise: Exercise;
  onSolved?: (correct: boolean) => void;
  solved?: boolean;
}) {
  const entry = exercise.computed ? getComputedExercise(exercise.computed) : undefined;
  const [input, setInput] = useState('');
  const [verdict, setVerdict] = useState<'correct' | 'incorrect' | null>(null);
  const [attempted, setAttempted] = useState('');

  const computed = useMemo(() => {
    if (!entry) return null;
    const value = entry.compute();
    return Number.isFinite(value) ? value : null;
  }, [entry]);

  if (!entry || computed === null) {
    return (
      <p className="mt-2 text-[11.5px] text-lab-400">
        This exercise has no computed answer.
      </p>
    );
  }

  const tolerance = exercise.computedTolerance ?? entry.tolerance;
  const check = () => {
    const v = Number(input);
    if (!Number.isFinite(v)) return;
    const ok = Math.abs(v - computed) <= tolerance;
    setVerdict(ok ? 'correct' : 'incorrect');
    setAttempted(String(v));
    onSolved?.(ok);
  };

  return (
    <div className="mt-2 rounded border border-lab-700 bg-lab-850/50 p-2.5">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Badge tone="default">check your answer</Badge>
        <input
          type="number"
          step="any"
          className="mono w-36 rounded border border-lab-600 bg-lab-900 px-2 py-1 text-right text-[12.5px] text-lab-100 focus:border-signal-blue focus:outline-none"
          placeholder="your value"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setVerdict(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') check();
          }}
          aria-label={`your answer for: ${exercise.prompt.slice(0, 60)}`}
        />
        <Button onClick={check} disabled={input.trim() === ''}>
          check
        </Button>
        {entry.unit && <span className="text-[11.5px] text-lab-400">{entry.unit}</span>}
      </div>

      <p className="mt-1.5 text-[11.5px] leading-snug text-lab-400">
        Computed here by the app: {entry.method} Accepted tolerance ±{formatComputed(tolerance, 3)}.
      </p>

      {verdict && (
        <div
          role="status"
          aria-live="polite"
          className={`mt-2 rounded border px-2.5 py-2 text-[12.5px] leading-relaxed ${
            verdict === 'correct'
              ? 'border-signal-green/50 bg-signal-green/10 text-lab-100'
              : 'border-signal-orange/50 bg-signal-orange/10 text-lab-100'
          }`}
        >
          {verdict === 'correct' ? (
            <>
              <span className="text-signal-green">Correct.</span> Your value {attempted} matches the computed{' '}
              <span className="mono">{formatComputed(computed, entry.digits ?? 4)}</span>
              {solved ? ' — already recorded on your dashboard.' : ' — recorded as worked on your dashboard.'}
            </>
          ) : (
            <>
              <span className="text-signal-orange">Not yet.</span> You typed {attempted}; the app computes{' '}
              <span className="mono">{formatComputed(computed, entry.digits ?? 4)}</span>. Open the linked laboratory and
              read off the value you are missing.
            </>
          )}
        </div>
      )}
    </div>
  );
}
