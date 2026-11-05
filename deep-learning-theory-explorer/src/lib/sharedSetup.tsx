import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ACTIVATION_IDS, type ActivationId } from './numerics/activations';
import type { InitDistribution } from './numerics/mlp';

/**
 * The shared experiment setup.
 *
 * The book has one organising claim: the *same* kernel recursion governs every
 * architecture, every activation and every depth. The application should make
 * that claim concrete, so the laboratories are not five separate toys but five
 * views of one experiment. They therefore share a setup — the activation, the
 * initialization hyperparameters, the depth and width, the input distribution
 * and the seed — and a change made in one laboratory is a change in all of
 * them.
 *
 * The shared state is persisted, so a student who closes the tab finds the
 * setup they left. Nothing else is stored: no results, no personal data.
 */

export interface SharedSetup {
  activation: ActivationId;
  /** rescaled weight variance */
  Cw: number;
  /** bias variance */
  Cb: number;
  /** hidden layers plus the output layer */
  depth: number;
  /** hidden neurons per layer */
  width: number;
  seed: number;
  initDistribution: InitDistribution;
  inputDistribution: 'gaussian' | 'uniform';
  inputScale: number;
  inputDim: number;
  /** input samples per measurement */
  samples: number;
  /** networks averaged per measurement */
  seeds: number;
}

export const DEFAULT_SHARED_SETUP: SharedSetup = {
  activation: 'tanh',
  Cw: 1,
  Cb: 0,
  depth: 12,
  width: 64,
  seed: 1,
  initDistribution: 'gaussian',
  inputDistribution: 'gaussian',
  inputScale: 1,
  inputDim: 8,
  samples: 32,
  seeds: 6,
};

const STORAGE_KEY = 'dlte.shared-setup.v1';

/**
 * A compact encoding of the shared setup, so that an experiment can be shared
 * as a link. The keys are short because the whole thing travels in a URL.
 */
const SETUP_KEYS: Record<string, keyof SharedSetup> = {
  act: 'activation',
  cw: 'Cw',
  cb: 'Cb',
  dp: 'depth',
  wd: 'width',
  sd: 'seed',
  init: 'initDistribution',
  ind: 'inputDistribution',
  ins: 'inputScale',
  idim: 'inputDim',
  ns: 'samples',
  nk: 'seeds',
};

/**
 * The ranges a shared setup is allowed to carry. A link is untrusted input:
 * it must not be able to ask for a negative depth or a zero width.
 */
const SETUP_RANGES: Partial<Record<keyof SharedSetup, { min: number; max: number; integer?: boolean }>> = {
  Cw: { min: 0.0001, max: 1e4 },
  Cb: { min: 0, max: 1e4 },
  depth: { min: 1, max: 1000, integer: true },
  width: { min: 1, max: 10000, integer: true },
  seed: { min: 0, max: 1e9, integer: true },
  inputScale: { min: 1e-6, max: 1e4 },
  inputDim: { min: 1, max: 1000, integer: true },
  samples: { min: 1, max: 1e5, integer: true },
  seeds: { min: 1, max: 1e5, integer: true },
};

/** Every field the shared setup has, as an allow-list. */
const SETUP_FIELDS = new Set<string>([
  'activation',
  'Cw',
  'Cb',
  'depth',
  'width',
  'seed',
  'initDistribution',
  'inputDistribution',
  'inputScale',
  'inputDim',
  'samples',
  'seeds',
]);

/**
 * Check a proposed change to the shared setup.
 *
 * A shared link is untrusted input, and so is a progress record pasted from
 * another machine. Neither must be able to ask for a negative depth or a zero
 * width. Every path into the shared setup goes through here, so the check
 * cannot be forgotten on a new one.
 */
export function sanitizeSetup(patch: Partial<SharedSetup> | Record<string, unknown>): Partial<SharedSetup> {
  const out: Partial<SharedSetup> = {};
  for (const [key, value] of Object.entries(patch)) {
    const field = key as keyof SharedSetup;
    // An allow-list, not an `in` test: `('toString' in ranges)` is true, and
    // a field inherited from Object.prototype would otherwise be copied into
    // the setup.
    if (!SETUP_FIELDS.has(field)) continue;
    if (field === 'activation') {
      if ((ACTIVATION_IDS as readonly string[]).includes(String(value))) out.activation = value as ActivationId;
      continue;
    }
    if (field === 'initDistribution' || field === 'inputDistribution') {
      if (value === 'gaussian' || value === 'uniform') (out as Record<string, unknown>)[field] = value;
      continue;
    }
    const v = Number(value);
    if (!Number.isFinite(v)) continue;
    const range = SETUP_RANGES[field];
    if (range) {
      if (v < range.min || v > range.max) continue;
      if (range.integer && !Number.isInteger(v)) continue;
    }
    (out as Record<string, unknown>)[field] = v;
  }
  return out;
}

export function encodeSetup(setup: SharedSetup): string {
  return Object.entries(SETUP_KEYS)
    .map(([short, field]) => `${short}=${String(setup[field])}`)
    .join(',');
}

export function decodeSetup(encoded: string): Partial<SharedSetup> | null {
  const out: Record<string, string> = {};
  for (const part of encoded.split(',')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    out[part.slice(0, eq)] = part.slice(eq + 1);
  }
  const patch: Partial<SharedSetup> = {};
  for (const [short, field] of Object.entries(SETUP_KEYS)) {
    const raw = out[short];
    if (raw === undefined) continue;
    if (field === 'activation') {
      if ((ACTIVATION_IDS as readonly string[]).includes(raw)) (patch as Record<string, unknown>)[field] = raw;
      continue;
    }
    if (field === 'initDistribution' || field === 'inputDistribution') {
      if (raw === 'gaussian' || raw === 'uniform') (patch as Record<string, unknown>)[field] = raw;
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    const range = SETUP_RANGES[field];
    if (range) {
      if (value < range.min || value > range.max) continue;
      if (range.integer && !Number.isInteger(value)) continue;
    }
    (patch as Record<string, unknown>)[field] = value;
  }
  return Object.keys(patch).length ? (patch as Partial<SharedSetup>) : null;
}

/** Read a shared setup out of a URL's query string, if it carries one. */
export function setupFromUrl(search: string): Partial<SharedSetup> | null {
  try {
    const encoded = new URLSearchParams(search).get('s');
    if (!encoded) return null;
    return decodeSetup(encoded);
  } catch {
    return null;
  }
}

/** The URL that reproduces the current setup, ready to be shared. */
export function shareUrlFor(setup: SharedSetup, base: string, hash: string): string {
  const url = new URL(base);
  url.searchParams.set('s', encodeSetup(setup));
  return `${url.toString()}${hash}`;
}

function isSharedSetup(v: unknown): v is SharedSetup {
  if (!v || typeof v !== 'object') return false;
  const s = v as Partial<SharedSetup>;
  return (
    typeof s.activation === 'string' &&
    typeof s.Cw === 'number' &&
    typeof s.Cb === 'number' &&
    typeof s.depth === 'number' &&
    typeof s.width === 'number' &&
    typeof s.seed === 'number' &&
    typeof s.samples === 'number' &&
    typeof s.seeds === 'number'
  );
}

function load(): SharedSetup {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SHARED_SETUP;
    const parsed: unknown = JSON.parse(raw);
    if (!isSharedSetup(parsed)) return DEFAULT_SHARED_SETUP;
    return { ...DEFAULT_SHARED_SETUP, ...parsed };
  } catch {
    return DEFAULT_SHARED_SETUP;
  }
}

function save(setup: SharedSetup): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
  } catch {
    /* storage unavailable: the setup simply does not persist */
  }
}

interface SharedSetupApi {
  setup: SharedSetup;
  /** change one or more fields of the shared setup */
  patch: (p: Partial<SharedSetup>) => void;
  /** restore the default shared setup */
  reset: () => void;
  /** true when the shared setup differs from the default */
  isCustom: boolean;
}

const SharedSetupContext = createContext<SharedSetupApi | null>(null);

export function SharedSetupProvider({ children }: { children: ReactNode }) {
  // A shared link wins over the stored setup: the whole point of a link is that
  // it reproduces somebody else's experiment.
  const [setup, setSetup] = useState<SharedSetup>(() => {
    const fromUrl = setupFromUrl(window.location.search);
    return fromUrl ? { ...load(), ...fromUrl } : load();
  });

  useEffect(() => {
    save(setup);
  }, [setup]);

  const patch = useCallback((p: Partial<SharedSetup>) => {
    // Everything that reaches the shared setup is checked: a link, a pasted
    // record and a button all come through here.
    const safe = sanitizeSetup(p);
    if (Object.keys(safe).length === 0) return;
    setSetup((s) => {
      // Return the *same* object when nothing actually changes. The identity
      // of the shared setup is a dependency of the laboratories' effects, so a
      // new object on every call would re-trigger them — and an effect that
      // writes to the shared setup would then loop forever.
      let changed = false;
      for (const [key, value] of Object.entries(safe)) {
        if (s[key as keyof SharedSetup] !== value) {
          changed = true;
          break;
        }
      }
      return changed ? { ...s, ...safe } : s;
    });
  }, []);

  const reset = useCallback(() => setSetup(DEFAULT_SHARED_SETUP), []);

  const value = useMemo<SharedSetupApi>(
    () => ({
      setup,
      patch,
      reset,
      isCustom: JSON.stringify(setup) !== JSON.stringify(DEFAULT_SHARED_SETUP),
    }),
    [setup, patch, reset],
  );

  return <SharedSetupContext.Provider value={value}>{children}</SharedSetupContext.Provider>;
}

export function useSharedSetup(): SharedSetupApi {
  const ctx = useContext(SharedSetupContext);
  if (!ctx) throw new Error('useSharedSetup must be used inside a SharedSetupProvider');
  return ctx;
}
