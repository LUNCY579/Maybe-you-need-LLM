import { describe, expect, it } from 'vitest';
import { encodeSetup, decodeSetup, shareUrlFor, setupFromUrl } from '../src/lib/sharedSetup';
import { EXPERIMENT_BY_ID } from '../src/content/experiments';

/**
 * The two kinds of link.
 *
 * The application is a hash-routed static site, so it has two places a
 * parameter can live: the query before the hash, which a reader can arrive
 * with from anywhere, and the router's own query inside the hash, which is a
 * property of the route. A gallery preset uses the second, a shared setup uses
 * the first, and a link written by hand has to use the right one.
 */

describe('the shared-setup link', () => {
  const setup = {
    activation: 'relu' as const,
    Cw: 2,
    Cb: 0,
    depth: 12,
    width: 64,
    seed: 1,
    initDistribution: 'gaussian' as const,
    inputDistribution: 'gaussian' as const,
    inputScale: 1,
    inputDim: 8,
    samples: 32,
    seeds: 6,
  };

  it('puts the setup in the query before the hash, and reads it back', () => {
    const url = shareUrlFor(setup, 'https://example.org/app', '#/labs/initialization');
    const query = new URL(url).search;
    expect(query).toContain('s=');
    expect(setupFromUrl(query)).toEqual(setup);
    // the route survives
    expect(new URL(url).hash).toBe('#/labs/initialization');
  });

  it('is ignored when the query carries something else', () => {
    expect(setupFromUrl('?x=1')).toBeNull();
    expect(setupFromUrl('')).toBeNull();
  });
});

describe('the gallery-preset link', () => {
  it('names a preset that exists', () => {
    for (const preset of EXPERIMENT_BY_ID ? Object.values(EXPERIMENT_BY_ID) : []) {
      expect(preset.id).toBeTruthy();
      expect(preset.lab).toBeTruthy();
    }
  });

  it('encodes to a value the decoder accepts', () => {
    // the encoding used for the shared setup is the same machinery
    const encoded = encodeSetup({
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
    });
    expect(decodeSetup(encoded)).not.toBeNull();
  });
});
