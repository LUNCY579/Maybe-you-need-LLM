import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PREREQUISITE_DRILLS, PREREQUISITE_TOOLS, drillsForTool } from '../src/content/prerequisites';
import { LAB_ROUTES } from '../src/content/labs';
import { COMPUTED_EXERCISES, computedValue, formatComputed } from '../src/lib/exercises';
import { DrillsLab } from '../src/pages/labs/DrillsLab';

/**
 * The prerequisite drills.
 *
 * Laboratory F grades itself against live computations, so the two things worth
 * checking are that every drill really has one, and that the grading behaves
 * like grading rather than decoration: a hand-derivable value must be accepted,
 * a wrong one refused, and the tolerance must be tight enough that a careless
 * guess is not a pass.
 *
 * The drill's own arithmetic is tested where the computation lives, in
 * `tests/exercises.test.ts`; what is tested here is the join between the
 * content list and the registry, and the screen.
 */

describe('the drill set', () => {
  it('has unique ids, and every drill belongs to a tool the navigator lists', () => {
    const ids = PREREQUISITE_DRILLS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    const tools = new Set(PREREQUISITE_TOOLS.map((t) => t.id));
    for (const drill of PREREQUISITE_DRILLS) {
      expect(tools.has(drill.tool), `${drill.id} names no tool`).toBe(true);
    }
  });

  it('drills every tool the navigator says a reader needs', () => {
    for (const tool of PREREQUISITE_TOOLS) {
      expect(drillsForTool(tool.id).length, `${tool.name} has no drill`).toBeGreaterThan(0);
    }
    expect(PREREQUISITE_DRILLS.length).toBeGreaterThanOrEqual(PREREQUISITE_TOOLS.length);
  });

  it('points each drill at a screen the application serves', () => {
    for (const drill of PREREQUISITE_DRILLS) {
      expect(LAB_ROUTES, `${drill.id} -> ${drill.route}`).toContain(drill.route);
    }
  });

  it('grades every drill against a computation that exists and is finite', () => {
    for (const drill of PREREQUISITE_DRILLS) {
      const entry = COMPUTED_EXERCISES[drill.computed];
      expect(entry, `${drill.id} names ${drill.computed}, which is not registered`).toBeDefined();
      const value = computedValue(drill.computed);
      expect(Number.isFinite(value as number), `${drill.id} does not compute`).toBe(true);
      expect(entry!.method.length, `${drill.id} has no method line`).toBeGreaterThan(20);
    }
  });

  it('uses a tolerance tight enough that the answer is not free', () => {
    for (const drill of PREREQUISITE_DRILLS) {
      const entry = COMPUTED_EXERCISES[drill.computed]!;
      const value = computedValue(drill.computed)!;
      // the accepted window must be narrower than the distance from zero to the answer,
      // so typing 0 is not a pass for a nonzero quantity
      expect(entry.tolerance, `${drill.id} tolerance ±${entry.tolerance} against ${value}`).toBeLessThan(Math.abs(value));
      expect(entry.tolerance).toBeGreaterThan(0);
    }
  });

  it('states a prompt, a setup and a derivation for every drill', () => {
    for (const drill of PREREQUISITE_DRILLS) {
      expect(drill.prompt.length, drill.id).toBeGreaterThan(20);
      expect(drill.given.length, drill.id).toBeGreaterThan(10);
      expect(drill.working.length, drill.id).toBeGreaterThan(40);
      expect(['numerical', 'conceptual', 'code']).toContain(drill.kind);
    }
  });
});

describe('the drills screen', () => {
  it('lists the tools, the drills and the computed answer for each', async () => {
    render(
      <MemoryRouter initialEntries={['/labs/drills']}>
        <DrillsLab />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Prerequisite drills');
    expect(screen.getByText(new RegExp(`${PREREQUISITE_DRILLS.length} graded checks`))).toBeInTheDocument();
    for (const drill of PREREQUISITE_DRILLS.slice(0, 4)) {
      expect(screen.getAllByText(drill.prompt, { exact: false }).length).toBeGreaterThan(0);
      const value = computedValue(drill.computed)!;
      expect(document.body.textContent).toContain(formatComputed(value, 4));
    }
  });

  it('accepts the hand-derived value and refuses a wrong one', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/labs/drills']}>
        <DrillsLab />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { level: 1 });

    const first = screen.getAllByRole('spinbutton')[0]!;
    await user.type(first, '0');
    await user.click(screen.getAllByRole('button', { name: 'check' })[0]!);
    expect(await screen.findAllByText(/^Not yet\./)).not.toHaveLength(0);

    await user.clear(first);
    await user.type(first, String(computedValue(PREREQUISITE_DRILLS[0]!.computed)));
    await user.click(screen.getAllByRole('button', { name: 'check' })[0]!);
    expect(await screen.findByText(/^Correct\./)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('solved').length).toBeGreaterThan(0));
  });

  it('shows the working only when the reader asks for it', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/labs/drills']}>
        <DrillsLab />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { level: 1 });
    const working = PREREQUISITE_DRILLS[0]!.working;
    expect(document.body.textContent).not.toContain(working);

    await user.click(screen.getAllByRole('button', { name: 'show the working' })[0]!);
    expect(await screen.findByText(working, { exact: false })).toBeInTheDocument();
  });

  it('filters to one tool at a time', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/labs/drills']}>
        <DrillsLab />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { level: 1 });
    const gaussian = PREREQUISITE_TOOLS[0]!;
    await user.click(screen.getByRole('button', { name: new RegExp(`^${gaussian.name.split(' and ')[0]} · `) }));
    for (const drill of drillsForTool(gaussian.id)) {
      expect(screen.getAllByText(drill.prompt, { exact: false }).length).toBeGreaterThan(0);
    }
    for (const drill of drillsForTool(PREREQUISITE_TOOLS[1]!.id)) {
      expect(screen.queryByText(drill.prompt, { exact: false })).not.toBeInTheDocument();
    }
    expect(screen.getAllByText(gaussian.usedFor, { exact: false }).length).toBe(1);
  });
});
