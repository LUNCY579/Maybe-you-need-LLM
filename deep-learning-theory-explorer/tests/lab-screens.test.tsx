import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LABS } from '../src/content/labs';
import { LAB_SCREENS } from '../src/pages/labs';
import { ThemeProvider } from '../src/lib/useTheme';
import { SharedSetupProvider } from '../src/lib/sharedSetup';

/**
 * Every laboratory screen renders, and renders numbers.
 *
 * The numerical core is exhaustively tested on its own, but a screen can still
 * break between the core and the page: a formatter that returns `NaN`, a field
 * renamed in a refactor, a computation that throws inside the worker fallback.
 * A reader meeting that sees a plausible-looking figure, which is worse than
 * seeing an error.
 *
 * These are smoke tests, not behaviour tests: each screen is mounted the way
 * the shell mounts it — inside the theme and shared-setup providers, at its own
 * route — and then held to three things. It must paint its heading. It must
 * produce a real paragraph of prose. And nothing in it may print `NaN`,
 * `undefined`, `Infinity` or `[object Object]`.
 *
 * The generous timeout is the cost of the worker fallback: with no `Worker` in
 * jsdom, the measurements run on the test thread, which is the same code path a
 * restricted browser takes.
 */

function renderLab(route: string) {
  const lab = LABS.find((l) => l.route === route)!;
  const Screen = LAB_SCREENS[lab.id];
  return render(
    <ThemeProvider>
      <SharedSetupProvider>
        <MemoryRouter initialEntries={[route]}>
          <Screen />
        </MemoryRouter>
      </SharedSetupProvider>
    </ThemeProvider>,
  );
}

const BROKEN = [/NaN/, /undefined/, /Infinity/, /\[object /];

/** A screen is settled once its "computing…" placeholder has been replaced by results. */
const isSettled = (text: string) => !/\bcomputing\b/i.test(text);

describe('the laboratory screens', () => {
  for (const lab of LABS) {
    it(`mounts ${lab.name}, waits for its measurement and prints numbers rather than placeholders`, async () => {
      const { container } = renderLab(lab.route);
      const heading = await screen.findByRole('heading', { level: 1 });
      expect(heading.textContent?.length).toBeGreaterThan(10);

      // the computation is debounced and then run on this thread, because jsdom
      // has no Worker; wait for the results rather than the first paint
      await waitFor(() => expect(isSettled(container.textContent ?? '')).toBe(true), { timeout: 120_000 });

      const text = container.textContent ?? '';
      expect(text.length, `${lab.route} renders nothing but controls`).toBeGreaterThan(600);
      expect(/\d+\.\d/.test(text), `${lab.route} shows no computed decimal`).toBe(true);
      for (const pattern of BROKEN) {
        expect(pattern.test(text), `${lab.route} prints something matching ${pattern}`).toBe(false);
      }
    }, 240_000);
  }

  it('serves a screen for every entry of the registry', () => {
    expect(LAB_SCREENS).toHaveProperty('drills');
    expect(Object.keys(LAB_SCREENS).length).toBe(LABS.length);
  });
});
