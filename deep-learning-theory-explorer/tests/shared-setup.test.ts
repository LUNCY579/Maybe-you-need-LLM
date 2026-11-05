import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHARED_SETUP,
  decodeSetup,
  encodeSetup,
  sanitizeSetup,
  setupFromUrl,
  shareUrlFor,
  type SharedSetup,
} from '../src/lib/sharedSetup';

/**
 * The shared setup is the spine of the application: it is what makes the six
 * laboratories one experiment rather than six. It is also what a shared link
 * carries, so the encoding has to round-trip exactly.
 */

const CUSTOM: SharedSetup = {
  activation: 'relu',
  Cw: 2,
  Cb: 0.25,
  depth: 17,
  width: 130,
  seed: 42,
  initDistribution: 'uniform',
  inputDistribution: 'uniform',
  inputScale: 1.75,
  inputDim: 5,
  samples: 48,
  seeds: 9,
};

describe('the shared setup encoding', () => {
  it('round-trips every field exactly', () => {
    const encoded = encodeSetup(CUSTOM);
    const decoded = decodeSetup(encoded);
    expect(decoded).toEqual(CUSTOM);
  });

  it('round-trips the defaults', () => {
    expect(decodeSetup(encodeSetup(DEFAULT_SHARED_SETUP))).toEqual(DEFAULT_SHARED_SETUP);
  });

  it('produces a compact string', () => {
    const encoded = encodeSetup(CUSTOM);
    expect(encoded.length).toBeLessThan(120);
    expect(encoded).not.toContain('&');
  });

  it('ignores unknown, malformed and hostile fields', () => {
    // nothing decodable means no patch at all
    expect(decodeSetup('act=notAnActivation,cw=abc,dp=-4')).toBeNull();
    expect(decodeSetup('nonsense')).toBeNull();
    expect(decodeSetup('')).toBeNull();
    // an activation that is not in the registry must not be smuggled in
    expect(decodeSetup('act=../../etc/passwd')).toBeNull();
    // a distribution that is not one of the two must not be smuggled in
    expect(decodeSetup('init=exponential')).toBeNull();
  });

  it('refuses out-of-range numbers, which a link must not be able to smuggle in', () => {
    expect(decodeSetup('dp=0')).toBeNull();
    expect(decodeSetup('dp=-4')).toBeNull();
    expect(decodeSetup('wd=0')).toBeNull();
    expect(decodeSetup('cw=0')).toBeNull();
    expect(decodeSetup('cb=-1')).toBeNull();
    expect(decodeSetup('ns=0')).toBeNull();
    expect(decodeSetup('dp=1.5')).toBeNull();
    expect(decodeSetup('dp=100000')).toBeNull();
    // a value inside the range is accepted
    expect(decodeSetup('dp=1')).toEqual({ depth: 1 });
    expect(decodeSetup('cw=2.5')).toEqual({ Cw: 2.5 });
  });

  it('reads a setup out of a URL query string', () => {
    const url = `https://example.org/app?s=${encodeURIComponent(encodeSetup(CUSTOM))}`;
    expect(setupFromUrl(new URL(url).search)).toEqual(CUSTOM);
    expect(setupFromUrl('')).toBeNull();
    expect(setupFromUrl('?s=')).toBeNull();
  });

  it('builds a shareable URL that keeps the route', () => {
    const url = shareUrlFor(CUSTOM, 'https://example.org/app', '#/labs/physics');
    expect(url).toContain('#/labs/physics');
    const query = new URL(url.slice(0, url.indexOf('#'))).search;
    expect(setupFromUrl(query)).toEqual(CUSTOM);
  });

  it('produces a URL that round-trips through a real URL parser', () => {
    const url = shareUrlFor(CUSTOM, 'https://example.org/app', '#/labs/ntk');
    const parsed = new URL(url);
    expect(parsed.hash).toBe('#/labs/ntk');
    expect(setupFromUrl(parsed.search)).toEqual(CUSTOM);
  });
});

describe('checking a proposed change to the shared setup', () => {
  it('accepts what is in range', () => {
    expect(sanitizeSetup({ width: 64, depth: 12 })).toEqual({ width: 64, depth: 12 });
    expect(sanitizeSetup({ activation: 'relu' })).toEqual({ activation: 'relu' });
  });

  it('refuses what is out of range, whatever the source', () => {
    expect(sanitizeSetup({ width: 0 })).toEqual({});
    expect(sanitizeSetup({ width: -8 })).toEqual({});
    expect(sanitizeSetup({ depth: 1.5 })).toEqual({});
    expect(sanitizeSetup({ seed: -1 })).toEqual({});
    expect(sanitizeSetup({ Cw: 0 })).toEqual({});
    expect(sanitizeSetup({ activation: 'nope' })).toEqual({});
  });

  it('refuses fields that are not part of the setup at all', () => {
    expect(sanitizeSetup({ nonsense: 1 } as Record<string, unknown>)).toEqual({});
    expect(sanitizeSetup({ toString: 1 } as Record<string, unknown>)).toEqual({});
  });

  it('refuses a value that is not a number', () => {
    expect(sanitizeSetup({ width: 'wide' } as unknown as Record<string, unknown>)).toEqual({});
    expect(sanitizeSetup({ width: Number.NaN })).toEqual({});
    expect(sanitizeSetup({ width: Number.POSITIVE_INFINITY })).toEqual({});
  });
});
