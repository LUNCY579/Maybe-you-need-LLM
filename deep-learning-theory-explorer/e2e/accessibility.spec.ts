import { expect, test } from '@playwright/test';

/**
 * Every control has a name.
 *
 * A control with no accessible name is announced as nothing at all: a screen
 * reader says "slider" or "edit" and stops. The name comes from
 * `aria-label`, from `aria-labelledby`, from a `<label>` that owns the
 * control, or — for a button or a link — from its own text.
 *
 * The rule that catches people out is the third one: a `<label>` binds to the
 * *first* control inside it, so a slider with a number box beside it leaves
 * the slider unnamed. The name of each control is therefore computed the way
 * a browser computes it, and every route is walked.
 */

const ROUTES = [
  '/#/',
  '/#/prerequisites',
  '/#/lessons',
  '/#/lessons/ntk',
  '/#/gallery',
  '/#/equations',
  '/#/quiz',
  '/#/dashboard',
  '/#/sources',
  '/#/atlas',
  '/#/reading',
  '/#/diagnostics',
  '/#/labs/physics',
  '/#/labs/initialization',
  '/#/labs/landscape',
  '/#/labs/width-depth',
  '/#/labs/ntk',
  '/#/labs/representation',
];

/** The accessible name of a control, computed the way a browser computes it. */
const NAME_OF = `(el) => {
  const byId = el.getAttribute('aria-labelledby');
  if (byId) {
    const t = byId.split(/\\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
    if (t) return t;
  }
  const aria = (el.getAttribute('aria-label') || '').trim();
  if (aria) return aria;
  const title = (el.getAttribute('title') || '').trim();
  if (title) return title;
  const tag = el.tagName.toLowerCase();
  if (tag === 'button' || tag === 'a') {
    const text = (el.innerText || el.textContent || '').trim();
    if (text) return text;
  }
  const id = el.getAttribute('id');
  if (id) {
    const explicit = document.querySelector('label[for="' + CSS.escape(id) + '"]');
    if (explicit && explicit.textContent && explicit.textContent.trim()) return explicit.textContent.trim();
  }
  const wrapping = el.closest('label');
  if (wrapping) {
    const first = wrapping.querySelector('input, select, textarea, button, [tabindex]');
    if (first === el) return wrapping.textContent.trim();
  }
  return '';
}`;

test.describe('the accessible names', () => {
  for (const route of ROUTES) {
    test(`every control on ${route} is named`, async ({ page }) => {
      await page.goto(route);
      await page.waitForTimeout(1200);

      const unnamed = await page.evaluate(`(() => {
        const name = ${NAME_OF};
        const out = [];
        for (const el of document.querySelectorAll('button, a[href], input, select, textarea')) {
          if (el.getAttribute('aria-hidden') === 'true' || el.closest('[aria-hidden="true"]')) continue;
          if (el.classList.contains('sr-only')) continue;
          if (!name(el)) {
            out.push(el.tagName.toLowerCase() + ' type="' + (el.getAttribute('type') || '') + '" class="' + (el.className || '').toString().slice(0, 60) + '"');
          }
        }
        return out;
      })()`);

      expect(unnamed, `unnamed controls on ${route}`).toEqual([]);
    });
  }
});

test.describe('the structure', () => {
  test('the headings do not skip a level, and the page does not scroll sideways', async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(route);
      await page.waitForTimeout(1000);
      const found = await page.evaluate(() => {
        const out = [];
        const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1]));
        let prev = 0;
        for (const l of levels) {
          if (prev && l > prev + 1) out.push(`heading jumps from h${prev} to h${l}`);
          prev = l;
        }
        if (document.documentElement.scrollWidth > window.innerWidth + 2) {
          out.push(`horizontal overflow: ${document.documentElement.scrollWidth} > ${window.innerWidth}`);
        }
        return out;
      });
      expect(found, `structure problems on ${route}`).toEqual([]);
    }
  });
});

test.describe('what is announced', () => {
  test('the answer to an exercise is announced when it arrives', async ({ page }) => {
    await page.goto('/#/lessons/random-functions');
    const answer = page.getByLabel(/your answer for/i).first();
    await answer.fill('1');
    await page.getByRole('button', { name: 'check' }).first().click();

    const verdict = page.getByRole('status').filter({ hasText: /Correct|Not yet/ });
    await expect(verdict).toBeVisible();
  });

  test('the explanation of an assessment answer is announced when it arrives', async ({ page }) => {
    await page.goto('/#/quiz');
    await page.getByRole('button', { name: 'reveal', exact: true }).click();
    const explanation = page.getByRole('status').filter({ hasText: 'Explanation' });
    await expect(explanation).toBeVisible();
  });

  test('the result of an import is announced', async ({ page }) => {
    await page.goto('/#/dashboard');
    await page.getByText('or paste a progress record').click();
    await page.getByLabel('a progress record to import').fill('{"version": 1}');
    await page.getByRole('button', { name: 'import this record' }).click();
    const message = page.getByRole('status').filter({ hasText: /Imported|Could not import/ });
    await expect(message).toBeVisible();
  });
});

test.describe('the small screen', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('no page scrolls sideways on a phone', async ({ page }) => {
    const problems: string[] = [];
    for (const route of ROUTES) {
      await page.goto(route);
      await page.waitForTimeout(1200);
      const over = await page.evaluate(() => {
        const width = document.documentElement.scrollWidth;
        if (width <= window.innerWidth + 2) return null;
        // find the widest element, to say what is causing it
        let worst = '';
        let worstWidth = 0;
        for (const el of document.querySelectorAll('body *')) {
          const w = el.getBoundingClientRect().width + el.getBoundingClientRect().left;
          if (w > worstWidth) {
            worstWidth = w;
            worst = el.tagName.toLowerCase() + ' class="' + (el.className || '').toString().slice(0, 50) + '"';
          }
        }
        return `${document.documentElement.scrollWidth} > ${window.innerWidth}, widest: ${worst}`;
      });
      if (over) problems.push(`${route}: ${over}`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
