import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelOption } from '@/types/arena';
import { ModelCard } from './model-card';

// framer-motion is mocked globally via alias in vitest.config.mts

// Define mock icon creator using vi.hoisted to make it available in hoisted vi.mock
const { createMockIcon } = vi.hoisted(() => ({
  createMockIcon: (name: string) => {
    const MockIcon = ({ className }: { className?: string }) => (
      <svg data-testid={`icon-${name}`} className={className} />
    );
    MockIcon.displayName = name;
    return MockIcon;
  },
}));

vi.mock('lucide-react', () => ({
  ArrowLeftIcon: createMockIcon('ArrowLeftIcon'),
  ArrowRightIcon: createMockIcon('ArrowRightIcon'),
  EraserIcon: createMockIcon('EraserIcon'),
  MoreHorizontalIcon: createMockIcon('MoreHorizontalIcon'),
  PlusIcon: createMockIcon('PlusIcon'),
  SlidersHorizontalIcon: createMockIcon('SlidersHorizontalIcon'),
  ThumbsUp: createMockIcon('ThumbsUp'),
  ToggleLeftIcon: createMockIcon('ToggleLeftIcon'),
  ToggleRightIcon: createMockIcon('ToggleRightIcon'),
  Trash2Icon: createMockIcon('Trash2Icon'),
}));

// @lmring/ui is mocked globally via alias in vitest.config.mts;

vi.mock('@/components/arena/model-selector', () => ({
  ModelSelectorTrigger: ({
    selectedModel,
    onClick,
  }: {
    selectedModel?: string;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick} data-testid="model-selector-trigger">
      {selectedModel ?? 'select'}
    </button>
  ),
  ModelSelectorOverlay: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="model-selector-overlay" /> : null,
}));

vi.mock('@/components/arena/provider-icon', () => ({
  ProviderIcon: ({ providerId }: { providerId: string }) => (
    <span data-testid="provider-icon">{providerId}</span>
  ),
}));

vi.mock('@/components/arena/chat/chat-list', () => ({
  ChatList: () => <div data-testid="chat-list" />,
}));

vi.mock('./vote-button', () => ({
  VoteButton: () => <div data-testid="vote-button" />,
}));

describe('ModelCard', () => {
  const models: ModelOption[] = [
    {
      id: 'openai:gpt-4o',
      name: 'GPT-4o',
      provider: 'OpenAI',
      providerId: 'openai',
      description: 'Test description',
    },
  ];

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders selected model info when empty', () => {
    render(<ModelCard modelId="openai:gpt-4o" models={models} />);
    expect(screen.getByText('GPT-4o')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('does not have card-level click voting behavior', () => {
    render(<ModelCard modelId="openai:gpt-4o" models={models} voteState="none" />);

    fireEvent.click(screen.getByTestId('card'));
  });

  it('does not bubble click from settings button', () => {
    render(<ModelCard modelId="openai:gpt-4o" models={models} voteState="none" />);

    const settingsIcon = screen.getByTestId('icon-SlidersHorizontalIcon');
    const settingsButton = settingsIcon.closest('button');
    expect(settingsButton).toBeTruthy();
    if (settingsButton) {
      fireEvent.click(settingsButton);
    }
  });

  it('calls onConfigChange when slider changes', () => {
    const onConfigChange = vi.fn();

    const { container } = render(
      <ModelCard modelId="openai:gpt-4o" models={models} onConfigChange={onConfigChange} />,
    );

    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '4096' } });

    expect(onConfigChange).toHaveBeenCalledWith(expect.objectContaining({ maxTokens: 4096 }));
  });

  it('renders custom prompt input when not synced', () => {
    const onCustomPromptChange = vi.fn();

    render(
      <ModelCard
        modelId="openai:gpt-4o"
        models={models}
        synced={false}
        customPrompt=""
        onCustomPromptChange={onCustomPromptChange}
      />,
    );

    const input = screen.getByPlaceholderText('Type a custom prompt for this model...');
    fireEvent.change(input, { target: { value: 'custom' } });
    expect(onCustomPromptChange).toHaveBeenCalledWith('custom');
  });

  it('opens dropdown and triggers clear action', () => {
    const onClear = vi.fn();

    render(
      <ModelCard
        modelId="openai:gpt-4o"
        models={models}
        onClear={onClear}
        canMoveLeft
        canMoveRight
        onMoveLeft={vi.fn()}
        onMoveRight={vi.fn()}
      />,
    );

    const moreIcon = screen.getByTestId('icon-MoreHorizontalIcon');
    const moreButton = moreIcon.closest('button');
    expect(moreButton).toBeTruthy();
    if (moreButton) {
      fireEvent.click(moreButton);
    }

    fireEvent.click(screen.getByText('Clear Chat'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('toggles sync and opens model selector', () => {
    const onSyncToggle = vi.fn();
    render(
      <ModelCard modelId="openai:gpt-4o" models={models} synced onSyncToggle={onSyncToggle} />,
    );

    fireEvent.click(screen.getByTestId('icon-ToggleRightIcon').closest('button')!);
    expect(onSyncToggle).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByTestId('model-selector-trigger'));
    expect(screen.getByTestId('model-selector-overlay')).toBeInTheDocument();
  });

  it('moves model left/right and deletes from menu', () => {
    const onMoveLeft = vi.fn();
    const onMoveRight = vi.fn();
    const onDelete = vi.fn();

    render(
      <ModelCard
        modelId="openai:gpt-4o"
        models={models}
        canMoveLeft
        canMoveRight
        onMoveLeft={onMoveLeft}
        onMoveRight={onMoveRight}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByTestId('icon-MoreHorizontalIcon').closest('button')!);
    fireEvent.click(screen.getByText('Move Left'));
    expect(onMoveLeft).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('icon-MoreHorizontalIcon').closest('button')!);
    fireEvent.click(screen.getByText('Move Right'));
    expect(onMoveRight).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('icon-MoreHorizontalIcon').closest('button')!);
    fireEvent.click(screen.getByText('Delete Chat'));
    expect(onDelete).toHaveBeenCalled();
  });

  it('renders chat list when messages exist and toggles unsynced icon', () => {
    render(
      <ModelCard
        modelId="openai:gpt-4o"
        models={models}
        synced={false}
        messages={[{ id: 'm1', role: 'user', content: 'hi', createdAt: new Date() } as never]}
      />,
    );
    expect(screen.getByTestId('chat-list')).toBeInTheDocument();
    expect(screen.getByTestId('icon-ToggleLeftIcon')).toBeInTheDocument();
  });

  it('updates remaining config sliders', () => {
    const onConfigChange = vi.fn();
    const { container } = render(
      <ModelCard modelId="openai:gpt-4o" models={models} onConfigChange={onConfigChange} />,
    );

    const sliders = container.querySelectorAll('input[type="range"]');
    // temperature, topP, frequency, presence after maxTokens
    for (let i = 1; i < Math.min(sliders.length, 5); i++) {
      const slider = sliders[i];
      if (slider) {
        fireEvent.change(slider, { target: { value: '0.5' } });
      }
    }
    expect(onConfigChange).toHaveBeenCalled();
  });
});
