import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockGetVote: vi.fn(),
  mockSetHoveredVote: vi.fn(),
  mockSubmitVote: vi.fn(),
  mockT: vi.fn((_key: string, defaultValue: string) => defaultValue),
  isSubmitting: false,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mocks.mockT }),
}));

vi.mock('@/stores/vote-store', () => ({
  useVoteStore: () => ({
    getVote: mocks.mockGetVote,
    setHoveredVote: mocks.mockSetHoveredVote,
    submitVote: mocks.mockSubmitVote,
    get isSubmitting() {
      return mocks.isSubmitting;
    },
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      onAnimationComplete,
      ...props
    }: {
      children?: React.ReactNode;
      onAnimationComplete?: () => void;
      className?: string;
    }) => (
      <button
        type="button"
        className={props.className}
        data-testid="motion-div"
        onClick={() => onAnimationComplete?.()}
      >
        {children}
      </button>
    ),
  },
}));

import { toast } from 'sonner';
import { VoteBar } from './vote-bar';

const defaultProps = {
  messageId: 'msg-1',
  modelResponses: [
    { id: 'resp-1', modelName: 'GPT-4', providerName: 'OpenAI' },
    { id: 'resp-2', modelName: 'Claude', providerName: 'Anthropic' },
  ],
  comparisonType: 'text' as const,
};

describe('VoteBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetVote.mockReturnValue(null);
    mocks.mockSubmitVote.mockResolvedValue(true);
    mocks.isSubmitting = false;
  });

  afterEach(() => {
    cleanup();
  });

  it('should render tie and all bad buttons when not disabled', () => {
    const { container } = render(<VoteBar {...defaultProps} />);
    expect(container.firstChild).not.toBeNull();
    expect(screen.getByText('Tie')).toBeInTheDocument();
    expect(screen.getByText('All Bad')).toBeInTheDocument();
  });

  it('should hide buttons when disabled', () => {
    const { container } = render(<VoteBar {...defaultProps} disabled />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('opacity-0');
    expect(wrapper).toHaveClass('pointer-events-none');
  });

  it('should return null when vote exists', () => {
    mocks.mockGetVote.mockReturnValue({ voteType: 'tie' });
    const { container } = render(<VoteBar {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('submits tie vote and shows success toast', async () => {
    render(<VoteBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Tie'));

    await waitFor(() => {
      expect(mocks.mockSubmitVote).toHaveBeenCalledWith({
        messageId: 'msg-1',
        voteType: 'tie',
        winnerId: undefined,
        comparisonType: 'text',
        participantIds: ['resp-1', 'resp-2'],
      });
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it('submits all_bad vote and shows error toast on failure', async () => {
    mocks.mockSubmitVote.mockResolvedValueOnce(false);
    render(<VoteBar {...defaultProps} />);
    fireEvent.click(screen.getByText('All Bad'));

    await waitFor(() => {
      expect(mocks.mockSubmitVote).toHaveBeenCalledWith(
        expect.objectContaining({ voteType: 'all_bad' }),
      );
    });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('sets hover state for tie and all bad buttons', () => {
    render(<VoteBar {...defaultProps} />);
    fireEvent.mouseEnter(screen.getByText('Tie'));
    expect(mocks.mockSetHoveredVote).toHaveBeenCalledWith({
      messageId: 'msg-1',
      voteType: 'tie',
    });

    fireEvent.mouseEnter(screen.getByText('All Bad'));
    expect(mocks.mockSetHoveredVote).toHaveBeenCalledWith({
      messageId: 'msg-1',
      voteType: 'all_bad',
    });

    fireEvent.mouseLeave(screen.getByText('Tie'));
    expect(mocks.mockSetHoveredVote).toHaveBeenCalledWith(null);
  });

  it('ignores clicks while submitting', () => {
    mocks.isSubmitting = true;
    render(<VoteBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Tie'));
    fireEvent.click(screen.getByText('All Bad'));
    expect(mocks.mockSubmitVote).not.toHaveBeenCalled();
  });

  it('clears animation state when motion completes', async () => {
    render(<VoteBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Tie'));
    await waitFor(() => {
      expect(screen.getAllByTestId('motion-div').length).toBeGreaterThan(0);
    });
    const motionEl = screen.getAllByTestId('motion-div')[0];
    expect(motionEl).toBeTruthy();
    fireEvent.click(motionEl as HTMLElement);
  });
});
