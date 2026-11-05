import { Link } from 'react-router-dom';
import type { ExperimentPreset } from '../content/types';

/**
 * Shown in a laboratory when a gallery preset has been loaded, so that the
 * student always knows which recipe produced the numbers on screen, and can
 * see the expected outcome next to the measurement.
 */
export function PresetBanner({ preset, labLabel }: { preset: ExperimentPreset; labLabel: string }) {
  return (
    <div className="rounded-md border border-signal-blue/40 bg-signal-blue/10 px-3 py-2.5 text-[12.5px] leading-relaxed text-lab-100">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-signal-blue">Gallery preset loaded</span>
        <span className="font-medium">{preset.name}</span>
        <span className="mono text-[11px] text-lab-400">
          seed {preset.seed} · {labLabel}
        </span>
        <Link to="/gallery" className="ml-auto text-[11.5px] underline decoration-dotted">
          back to the gallery
        </Link>
      </div>
      <p className="mt-1 text-lab-200">
        <span className="text-lab-400">Hypothesis: </span>
        {preset.hypothesis}
      </p>
      <p className="mt-1 rounded border border-signal-green/30 bg-signal-green/10 px-2 py-1 text-lab-100">
        <span className="text-signal-green">Expected: </span>
        {preset.expected}
      </p>
    </div>
  );
}
