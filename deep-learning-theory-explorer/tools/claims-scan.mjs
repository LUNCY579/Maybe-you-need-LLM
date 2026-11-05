import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Lists the prose in this course that states a measurement.
 *
 * The course promises that every number on screen is computed and that every
 * claim of the form "grows linearly in depth" is something the application
 * actually measures. That promise is kept by going through the prose one
 * sentence at a time, which is tedious and easy to skip — and this script is
 * what makes it possible to do in one pass: it prints the sentences that carry
 * a number or a comparison, with the lesson, concept or equation they belong to
 * and the section of the book they cite.
 *
 * It is a review aid, not a gate. It cannot tell whether a sentence is true;
 * the answer is in `tests/`, where each measurement claim has a test that makes
 * the measurement. Run it after editing content, work down the list, and for
 * each sentence either point at the test that backs it or fix the sentence.
 *
 *   node tools/claims-scan.mjs            # every claim, grouped by file
 *   node tools/claims-scan.mjs --json     # the same as records, for diffing
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

/** Fields that hold sentences a student reads, rather than identifiers or TeX. */
const PROSE_FIELDS = new Set([
  'text',
  'caption',
  'statement',
  'note',
  'summary',
  'answer',
  'plain',
  'why',
  'whatHappens',
  'expectation',
  'expectedOutcome',
  'implemented',
  'interpretation',
  'reading',
  'description',
  'caveat',
]);

/**
 * A sentence states a measurement if it commits to a quantity.
 *
 * The list is deliberately wide: a comparative is as much a claim as a number,
 * and the ones that get missed are the words like "only", "never" and "vanishes".
 */
const MEASUREMENT =
  /\d|less|more|greater|smaller|larger|falls|rises|grows|shrinks|decreases|increases|scales|vanish|only|never|always|linear|quadratic|saturat|monoton|exponential/i;

/**
 * Every `key: 'value'` pair in the source, with the string read across lines.
 *
 * The content files are plain data — no computed values inside these fields —
 * so a literal scan is enough, and it does not need the file to compile.
 */
function proseFields(source) {
  const found = [];
  const keyPattern = /([A-Za-z][A-Za-z0-9]*)\s*:\s*/g;
  let match;
  while ((match = keyPattern.exec(source)) !== null) {
    const field = match[1];
    if (!PROSE_FIELDS.has(field)) continue;
    const quote = source[match.index + match[0].length];
    if (quote !== "'" && quote !== '"' && quote !== '`') continue;
    let end = match.index + match[0].length + 1;
    while (end < source.length) {
      if (source[end] === '\\') {
        end += 2;
        continue;
      }
      if (source[end] === quote) break;
      end += 1;
    }
    if (end >= source.length) continue;
    const value = source
      .slice(match.index + match[0].length + 1, end)
      .replace(/\\(['"`\\])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
    keyPattern.lastIndex = end;
    found.push({ field, value, line: source.slice(0, match.index).split('\n').length });
  }
  return found;
}

/** The `id:` most recently seen before an offset — the item a sentence belongs to. */
function ownerAt(source, line) {
  const before = source.split('\n').slice(0, line);
  const item = [...before].reverse().find((text) => /^\s{2,}id: ['"`]/.test(text));
  const section = [...before].reverse().find((text) => /^\s{2,}(section|ref): /.test(text));
  return {
    id: item ? item.match(/['"`]([^'"`]+)['"`]/)[1] : '?',
    cite: section ? (section.match(/:\s*['"`]?([^,'"`\n]+)/)?.[1] ?? '').trim() : '',
  };
}

function sentencesOf(value) {
  return value
    .split(/(?<=[.!?;])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20 && MEASUREMENT.test(sentence));
}

const files = process.argv.slice(2).filter((argument) => !argument.startsWith('--'));
const asJson = process.argv.includes('--json');
const targets = (
  files.length
    ? files
    : ['src/content/lessons.ts', 'src/content/concepts.ts', 'src/content/equations.ts', 'src/content/experiments.ts']
)
  .map((relative) => ({ relative, absolute: resolve(root, relative) }))
  .filter((file) => existsSync(file.absolute));

const claims = [];
for (const file of targets) {
  const source = readFileSync(file.absolute, 'utf8');
  for (const entry of proseFields(source)) {
    const owner = ownerAt(source, entry.line);
    for (const sentence of sentencesOf(entry.value)) {
      claims.push({ file: file.relative, line: entry.line, id: owner.id, cite: owner.cite, field: entry.field, sentence });
    }
  }
}

if (asJson) {
  console.log(JSON.stringify(claims, null, 2));
} else {
  let current = '';
  for (const claim of claims) {
    const where = `${claim.file} · ${claim.id}${claim.cite ? ` · ${claim.cite}` : ''}`;
    if (where !== current) {
      current = where;
      console.log(`\n${where}`);
    }
    console.log(`    [${claim.field}] ${claim.sentence}`);
  }
  console.log(`\n${claims.length} measurement claims across ${targets.length} content files.`);
  console.log('Each one needs a test that makes the measurement. See tests/claims.test.ts for the pattern.');
}
