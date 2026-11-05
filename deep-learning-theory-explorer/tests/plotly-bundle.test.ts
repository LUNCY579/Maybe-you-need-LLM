import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * The charting library is bundled with only the traces this application draws.
 *
 * The full distribution is 4.7 megabytes of every trace there is, and
 * evaluating it costs the reader half a second of frozen page. The small
 * build is a fraction of the size — but a trace that is drawn and not
 * registered simply does not appear, silently.
 *
 * So the traces the code asks for and the traces the bundle registers are
 * compared here, and a chart that would be missing is a failing test.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('the charting bundle', () => {
  it('registers every trace the application draws', () => {
    const files = sourceFiles(join(ROOT, 'src'));
    const drawn = new Set<string>();
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      // the trace type of a Plotly trace: type: 'scatter'
      for (const m of text.matchAll(/\btype:\s*'(scatter3d|scatter|bar|histogram|heatmap|contour|surface|box|violin|pie|funnel|waterfall)'/g)) {
        drawn.add(m[1]);
      }
    }
    expect(drawn.size, 'the application draws at least one trace').toBeGreaterThan(0);

    const bundle = readFileSync(join(ROOT, 'src/lib/plotly.ts'), 'utf8');
    for (const trace of drawn) {
      expect(bundle, `the trace "${trace}" is drawn but not registered`).toContain(trace);
    }
  });

  it('registers no trace the application never draws', () => {
    const files = sourceFiles(join(ROOT, 'src'));
    const drawn = new Set<string>();
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\btype:\s*'(scatter3d|scatter|bar|histogram|heatmap|contour|surface|box|violin|pie|funnel|waterfall)'/g)) {
        drawn.add(m[1]);
      }
    }
    const bundle = readFileSync(join(ROOT, 'src/lib/plotly.ts'), 'utf8');
    // 'core' is the library itself, not a trace
    const registered = [...bundle.matchAll(/import\s+\w+\s+from\s+'plotly\.js\/lib\/(\w+)'/g)]
      .map((m) => m[1])
      .filter((t) => t !== 'core');
    for (const trace of registered) {
      expect(drawn, `the trace "${trace}" is registered but never drawn`).toContain(trace);
    }
  });
});
