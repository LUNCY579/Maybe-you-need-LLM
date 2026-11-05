import { Link } from 'react-router-dom';
import { LESSONS } from '../content/lessons';

/**
 * The lessons a laboratory demonstrates.
 *
 * Every lesson points at the experiment that makes it concrete, so a reader
 * who has read a lesson can go and measure it. The other direction was
 * missing: a reader who is in a laboratory, moving a slider, has no way back
 * to the argument the experiment is there to support. This closes that loop,
 * and it is derived from the lessons themselves rather than written twice.
 *
 * A laboratory can serve several lessons, so the numbers are listed together
 * and the titles are given underneath: a line of five full titles would be a
 * wall of text above the controls.
 */
export function LabLessons({ route, className = '' }: { route: string; className?: string }) {
  const lessons = LESSONS.filter(
    (l) => l.experiment?.route === route || (l.alsoExperiments ?? []).some((e) => e.route === route),
  );
  if (lessons.length === 0) return null;
  const last = lessons.length - 1;
  return (
    <div className={`text-[12px] leading-relaxed ${className}`}>
      <p className="text-lab-400">
        <span className="text-lab-500">This is the experiment for </span>
        {lessons.map((l, i) => (
          <span key={l.id}>
            {i > 0 && (i === last ? (lessons.length === 2 ? ' and ' : ', and ') : ', ')}
            <Link
              to={`/lessons/${l.id}`}
              title={l.title}
              className="text-signal-blue underline decoration-dotted"
            >
              lesson {l.order}
            </Link>
          </span>
        ))}
      </p>
      <p className="text-lab-500">{lessons.map((l) => l.title).join(' · ')}</p>
    </div>
  );
}
