import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { GuidedExercise } from '../src/components/GuidedExercise';
import { PresetBanner } from '../src/components/PresetBanner';
import { EquationBlock, Rich, Tex } from '../src/components/Math';
import { Badge, Callout, Panel, Results, Stat } from '../src/components/ui';
import { EXPERIMENT_BY_ID } from '../src/content/experiments';
import type { Exercise } from '../src/content/types';

/**
 * Component-level tests.
 *
 * The numerical core is tested exhaustively elsewhere; these tests check the
 * parts of the application that a learner touches directly — that the guided
 * exercise really checks the learner's value against the computed one, that
 * KaTeX renders the equations, and that the shell components render what they
 * are given.
 */

const EXERCISE: Exercise = {
  kind: 'numerical',
  prompt: 'Compute the critical C_W for the ReLU.',
  answer: 'ReLU: A² = 1/2, so C_W = 2.',
  computed: 'relu-critical-cw',
};

describe('GuidedExercise', () => {
  it('states the method and the tolerance before anything is typed', () => {
    render(<GuidedExercise exercise={EXERCISE} />);
    expect(screen.getByText(/Computed here by the app:/)).toBeInTheDocument();
    expect(screen.getByText(/Accepted tolerance/)).toBeInTheDocument();
    expect(screen.queryByText(/^Correct\.$/)).not.toBeInTheDocument();
  });

  it('accepts a correct value and reports it', async () => {
    const user = userEvent.setup();
    const onSolved = vi.fn();
    render(<GuidedExercise exercise={EXERCISE} onSolved={onSolved} />);

    await user.type(screen.getByLabelText(/your answer for/i), '2');
    await user.click(screen.getByRole('button', { name: 'check' }));

    expect(screen.getByText(/^Correct\.$/)).toBeInTheDocument();
    expect(screen.getByText(/matches the computed/)).toBeInTheDocument();
    expect(onSolved).toHaveBeenCalledWith(true);
  });

  it('rejects a wrong value and shows the computed one', async () => {
    const user = userEvent.setup();
    const onSolved = vi.fn();
    render(<GuidedExercise exercise={EXERCISE} onSolved={onSolved} />);

    await user.type(screen.getByLabelText(/your answer for/i), '1.5');
    await user.click(screen.getByRole('button', { name: 'check' }));

    expect(screen.getByText(/^Not yet\.$/)).toBeInTheDocument();
    expect(screen.getByText(/the app computes/)).toBeInTheDocument();
    expect(onSolved).toHaveBeenCalledWith(false);
  });

  it('accepts a value inside the tolerance', async () => {
    const user = userEvent.setup();
    render(<GuidedExercise exercise={EXERCISE} />);
    await user.type(screen.getByLabelText(/your answer for/i), '2.0005');
    await user.click(screen.getByRole('button', { name: 'check' }));
    expect(screen.getByText(/^Correct\.$/)).toBeInTheDocument();
  });

  it('clears the verdict when the value is edited', async () => {
    const user = userEvent.setup();
    render(<GuidedExercise exercise={EXERCISE} />);
    await user.type(screen.getByLabelText(/your answer for/i), '1');
    await user.click(screen.getByRole('button', { name: 'check' }));
    expect(screen.getByText(/^Not yet\.$/)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/your answer for/i), '2');
    expect(screen.queryByText(/^Not yet\.$/)).not.toBeInTheDocument();
  });

  it('says so when an exercise has no computed answer', () => {
    render(<GuidedExercise exercise={{ kind: 'conceptual', prompt: 'Why?', answer: 'Because.' }} />);
    expect(screen.getByText(/no computed answer/i)).toBeInTheDocument();
  });
});

describe('PresetBanner', () => {
  it('shows the hypothesis, the expected outcome and the seed', () => {
    const preset = EXPERIMENT_BY_ID['relu-kaiming'];
    render(
      <MemoryRouter>
        <PresetBanner preset={preset} labLabel="Laboratory A" />
      </MemoryRouter>,
    );
    expect(screen.getByText('Gallery preset loaded')).toBeInTheDocument();
    expect(screen.getByText(preset.name)).toBeInTheDocument();
    expect(screen.getByText(/Hypothesis:/)).toBeInTheDocument();
    expect(screen.getByText(/Expected:/)).toBeInTheDocument();
    expect(screen.getByText(/seed 2/)).toBeInTheDocument();
  });
});

describe('clickable terms', () => {
  it('opens the definition on click and closes it on Escape', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Rich text="the [[chi-parallel]] susceptibility" />
      </MemoryRouter>,
    );
    const button = screen.getByRole('button');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(button);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/parallel susceptibility/);
    expect(dialog).toHaveTextContent(/eq\.\s*\(5\.50\)/);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('leaves an unknown term as plain text', () => {
    render(<Rich text="an [[not-a-term]] reference" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/an/)).toBeInTheDocument();
  });
});

describe('the mathematics components', () => {  it('renders a KaTeX expression', () => {
    const { container } = render(<Tex tex="K^{(\ell+1)} = C_b + C_W g(K^{(\ell)})" />);
    expect(container.querySelector('.katex')).not.toBeNull();
    expect(container.textContent).toContain('K');
  });

  it('renders inline math inside prose and escapes the rest', () => {
    const { container } = render(<Rich text="the kernel $K^{(\ell)}$ is **flat** here" />);
    expect(container.querySelectorAll('.katex').length).toBe(1);
    expect(container.querySelector('strong')?.textContent).toBe('flat');
  });

  it('does not inject markup from the text', () => {
    const { container } = render(<Rich text="<script>alert(1)</script> and $x$" />);
    expect(container.querySelector('script')).toBeNull();
  });

  it('renders an equation with a caption and a reference', () => {
    render(<EquationBlock tex="C_W = 1/A^2" caption="Kaiming" refLabel="eq. (5.67)" />);
    expect(screen.getByText('Kaiming')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'eq. (5.67)' })).toBeInTheDocument();
  });

  it('renders something safe when the expression cannot be parsed', () => {
    // KaTeX is configured with throwOnError: false, so a bad expression is
    // marked up rather than thrown; the component must still render.
    const { container } = render(<Tex tex={'\\begin{unknownenv} x'} />);
    const code = container.querySelector('code');
    const error = container.querySelector('.katex-error');
    expect(code ?? error).not.toBeNull();
    expect(container.textContent).toContain('x');
  });
});

describe('the shell components', () => {
  it('Panel renders its title, subtitle and children', () => {
    render(
      <Panel title="Kernel profiles" subtitle="measured against the recursion">
        <span>panel body</span>
      </Panel>,
    );
    expect(screen.getByRole('heading', { name: 'Kernel profiles' })).toBeInTheDocument();
    expect(screen.getByText('measured against the recursion')).toBeInTheDocument();
    expect(screen.getByText('panel body')).toBeInTheDocument();
  });

  it('Stat renders a label, a value and a hint', () => {
    render(<Stat label="Critical C_W" value="2.000" hint="at K* = 0" tone="good" />);
    expect(screen.getByText('Critical C_W')).toBeInTheDocument();
    expect(screen.getByText('2.000')).toBeInTheDocument();
    expect(screen.getByText('at K* = 0')).toBeInTheDocument();
  });

  it('Badge and Callout render their content', () => {
    render(
      <>
        <Badge tone="warn">advanced</Badge>
        <Callout tone="limitation" title="Scope">
          Not the full theory.
        </Callout>
      </>,
    );
    expect(screen.getByText('advanced')).toBeInTheDocument();
    expect(screen.getByText('Scope')).toBeInTheDocument();
    expect(screen.getByText('Not the full theory.')).toBeInTheDocument();
  });

  it('Results says when the numbers on screen are from the previous settings', () => {
    const { rerender } = render(
      <Results stale>
        <span>0.08329</span>
      </Results>,
    );
    expect(screen.getByText(/numbers of the previous settings/)).toBeInTheDocument();
    // and the numbers are visibly dimmed, so they are not read as current
    expect(screen.getByText('0.08329').parentElement?.className).toContain('opacity-50');

    rerender(
      <Results stale={false}>
        <span>0.08329</span>
      </Results>,
    );
    expect(screen.queryByText(/numbers of the previous settings/)).not.toBeInTheDocument();
  });
});
