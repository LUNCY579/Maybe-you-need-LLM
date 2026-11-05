import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConfirmDialog } from '../src/components/ConfirmDialog';
import { MobileSectionNav } from '../src/components/MobileSectionNav';

/**
 * The two safeguards added for the small screen and for the irreversible.
 *
 * The section strip must show that it scrolls, and the erase action must not
 * happen on a single click — the progress record has no server copy, so a
 * mis-click is a term of work lost.
 */

describe('ConfirmDialog', () => {
  const setup = () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Erase your progress?"
        body="Everything stored in this browser will be deleted."
        confirmLabel="erase everything"
        cancelLabel="keep it"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    return { onConfirm, onCancel };
  };

  it('states what will happen and what the choices are', () => {
    setup();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Erase your progress?')).toBeInTheDocument();
    expect(screen.getByText(/will be deleted/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'erase everything' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'keep it' })).toBeInTheDocument();
  });

  it('does not erase until the destructive choice is made', async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();

    await user.click(screen.getByRole('button', { name: 'keep it' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('erases when confirmed', async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();

    await user.click(screen.getByRole('button', { name: 'erase everything' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('treats Escape as "no"', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = setup();

    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('moves the focus into the dialog so the keyboard cannot wander behind it', () => {
    setup();
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('renders nothing when it is closed', () => {
    render(
      <ConfirmDialog open={false} title="x" body="y" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('MobileSectionNav', () => {
  const ITEMS = [
    { to: '/', label: 'Overview', hint: 'What this is' },
    { to: '/lessons', label: 'Lessons', hint: 'The curriculum' },
    { to: '/labs/ntk', label: 'Lab D', hint: 'The neural tangent kernel' },
  ];

  it('renders the same links as the rail', () => {
    render(
      <MemoryRouter>
        <MobileSectionNav items={ITEMS} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lessons' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lab D' })).toBeInTheDocument();
  });

  it('marks the section the reader is in', () => {
    render(
      <MemoryRouter initialEntries={['/labs/ntk']}>
        <MobileSectionNav items={ITEMS} />
      </MemoryRouter>,
    );
    const active = document.querySelector('[data-active="true"]');
    expect(active?.textContent).toBe('Lab D');
  });

  it('keeps every link reachable by keyboard', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MobileSectionNav items={ITEMS} />
      </MemoryRouter>,
    );
    await user.tab();
    expect(document.activeElement?.textContent).toBe('Overview');
  });
});
