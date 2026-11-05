import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { READING } from '../src/content/reading';

/**
 * The external references still resolve.
 *
 * A reading list with a dead link in it is worse than no reading list: the
 * reader is sent to a page that says the paper is not there, and concludes
 * that the application is careless about its sources. Every external
 * reference in the content is therefore checked against the network.
 *
 * The check needs the network, so it does not run by default:
 *
 *   NETWORK=1 npx vitest run tests/external-links.test.ts
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = join(ROOT, 'src/content');

function externalUrls(): string[] {
  const out = new Set<string>();
  for (const file of readdirSync(CONTENT)) {
    if (!file.endsWith('.ts')) continue;
    const source = readFileSync(join(CONTENT, file), 'utf8');
    for (const m of source.matchAll(/url:\s*'(https?:\/\/[^']+)'/g)) out.add(m[1]);
  }
  return [...out];
}

describe('the external references', () => {
  // set NETWORK=1 to check the links against the network
  it.skipIf(!process.env.NETWORK)('every one of them resolves', async () => {
      const urls = externalUrls();
      expect(urls.length).toBeGreaterThan(10);
      const failures: string[] = [];
      for (const url of urls) {
        try {
          const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
          if (res.status >= 400) failures.push(`${res.status} ${url}`);
        } catch (e) {
          failures.push(`error ${url}: ${String(e).slice(0, 60)}`);
        }
      }
      expect(failures, `dead references:\n${failures.join('\n')}`).toEqual([]);
  });

  it('the reading list is not empty and every entry has a link and a citation', () => {
    expect(READING.length).toBeGreaterThan(10);
    for (const entry of READING) {
      expect(entry.url, `the entry "${entry.id}" has no link`).toMatch(/^https?:\/\//);
      expect(entry.citation.length, `the entry "${entry.id}" has no citation`).toBeGreaterThan(0);
      expect(entry.contributes.length, `the entry "${entry.id}" says nothing about what it contributes`).toBeGreaterThan(0);
      expect(entry.where.length, `the entry "${entry.id}" does not say where it appears here`).toBeGreaterThan(0);
    }
  });
});
