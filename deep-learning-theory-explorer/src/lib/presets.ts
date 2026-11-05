import { useSearchParams } from 'react-router-dom';
import { EXPERIMENT_BY_ID } from '../content/experiments';
import type { ExperimentPreset } from '../content/types';

/**
 * Gallery presets are only useful if they can be *loaded*, not merely read.
 * Each preset carries a complete settings vector; the laboratory picks it up
 * from the `?preset=` query parameter of the hash route and applies the keys it
 * understands.
 */

/** The preset named by the current URL, or null. */
export function usePreset(): ExperimentPreset | null {
  const [params] = useSearchParams();
  const id = params.get('preset');
  return id ? EXPERIMENT_BY_ID[id] ?? null : null;
}

/**
 * Copy the keys of a preset's settings onto a laboratory configuration.
 * Keys the laboratory does not know about are ignored, so one preset can serve
 * several laboratories without any of them having to know the whole vocabulary.
 */
export function applyPreset<T extends object>(
  config: T,
  settings: Record<string, number | string | boolean>,
  keys: ReadonlyArray<string>,
): Partial<T> {
  const patch: Record<string, unknown> = {};
  for (const key of keys) {
    const value = settings[key];
    if (value === undefined) continue;
    patch[key] = value;
  }
  void config;
  return patch as Partial<T>;
}
