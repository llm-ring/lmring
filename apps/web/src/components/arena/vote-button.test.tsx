import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VoteButton } from './vote-button';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe('VoteButton', () => {
  it('renders winner, loser, tie, and all_bad states as disabled', () => {
    const { rerender } = render(
      <VoteButton voteState="winner" isVotable isSubmitting={false} onClick={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /Winner/i })).toBeDisabled();

    rerender(<VoteButton voteState="loser" isVotable isSubmitting={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Not selected/i })).toBeDisabled();

    rerender(<VoteButton voteState="tie" isVotable isSubmitting={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /tie/i })).toBeDisabled();

    rerender(<VoteButton voteState="all_bad" isVotable isSubmitting={false} onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /All Bad/i })).toBeDisabled();
  });

  it('returns null when not votable and state is none', () => {
    const { container } = render(
      <VoteButton voteState="none" isVotable={false} isSubmitting={false} onClick={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('invokes click and hover handlers when votable', () => {
    const onClick = vi.fn();
    const onMouseEnter = vi.fn();
    const onMouseLeave = vi.fn();

    render(
      <VoteButton
        voteState="none"
        isVotable
        isSubmitting={false}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />,
    );

    const button = screen.getByRole('button', { name: /Vote for this/i });
    fireEvent.mouseEnter(button);
    fireEvent.mouseLeave(button);
    fireEvent.click(button);

    expect(onMouseEnter).toHaveBeenCalled();
    expect(onMouseLeave).toHaveBeenCalled();
    expect(onClick).toHaveBeenCalled();
  });

  it('disables vote button while submitting', () => {
    render(<VoteButton voteState="none" isVotable isSubmitting onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Vote for this/i })).toBeDisabled();
  });
});
