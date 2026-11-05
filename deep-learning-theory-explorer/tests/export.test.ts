import { describe, expect, it } from 'vitest';
import { toCsv, toProvenanceCsv } from '../src/lib/export';

/**
 * The CSV export is the laboratory's commitment to being checkable: a student
 * should be able to take the numbers off the screen and verify them elsewhere.
 * That only works if the file is well formed.
 */

describe('CSV export', () => {
  it('writes a header and a body', () => {
    const csv = toCsv(['a', 'b'], [[1, 2], [3, 4]]);
    expect(csv).toBe('a,b\r\n1,2\r\n3,4\r\n');
  });

  it('quotes fields that contain a comma, a quote or a newline', () => {
    const csv = toCsv(['name', 'note'], [['plain', 'has, comma'], ['quo"te', 'line\nbreak']]);
    const lines = csv.trim().split('\r\n');
    expect(lines[1]).toBe('plain,"has, comma"');
    expect(lines[2]).toBe('"quo""te","line\nbreak"');
  });

  it('writes an empty field for a missing value', () => {
    const csv = toCsv(['a', 'b', 'c'], [[1, null, undefined]]);
    expect(csv.trim().split('\r\n')[1]).toBe('1,,');
  });

  it('writes the numbers as written, without reformatting them', () => {
    const csv = toCsv(['x'], [[0.1 + 0.2]]);
    expect(csv.trim().split('\r\n')[1]).toBe(String(0.1 + 0.2));
  });

  it('prepends a provenance preamble', () => {
    const csv = toProvenanceCsv({ activation: 'tanh', C_W: 1 }, ['layer', 'K'], [[1, 0.5]]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('# activation: tanh');
    expect(lines[1]).toBe('# C_W: 1');
    expect(lines[2]).toBe('layer,K');
    expect(lines[3]).toBe('1,0.5');
  });
});
