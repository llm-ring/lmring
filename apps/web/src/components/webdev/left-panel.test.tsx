import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SandboxState } from '@/types/webdev';
import { LeftPanel } from './left-panel';

const mocks = vi.hoisted(() => ({
  webdevState: {
    phase: 'idle' as string,
    activeWorkflowId: null as string | null,
    activeIterationVersion: 0,
    sandboxes: new Map<string, SandboxState>(),
    iterations: [] as Array<{ version: number; prompt: string }>,
    submittedPrompt: '',
    setActiveWorkflowId: vi.fn(),
    setActiveIterationVersion: vi.fn(),
  },
  workflowState: {
    workflows: new Map<string, { modelId: string }>(),
    workflowOrder: [] as string[],
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { version?: number }) =>
      options?.version ? `${key}:${options.version}` : key,
  }),
}));

vi.mock('@/stores/webdev-store', () => ({
  useWebDevStore: (selector: (state: typeof mocks.webdevState) => unknown) =>
    selector(mocks.webdevState),
  useWebDevStoreShallow: (selector: (state: typeof mocks.webdevState) => unknown) =>
    selector(mocks.webdevState),
  webdevSelectors: {
    isLatestIteration: (state: typeof mocks.webdevState) => {
      if (state.activeIterationVersion === 0) return true;
      if (state.iterations.length === 0) return true;
      const maxVersion = Math.max(...state.iterations.map((it) => it.version));
      return state.activeIterationVersion > maxVersion;
    },
  },
}));

vi.mock('@/stores/workflow-store', () => ({
  useWorkflowStore: (selector: (state: typeof mocks.workflowState) => unknown) =>
    selector(mocks.workflowState),
  useWorkflowStoreShallow: (selector: (state: typeof mocks.workflowState) => unknown) =>
    selector(mocks.workflowState),
}));

vi.mock('./iteration-timeline', () => ({
  IterationTimeline: ({
    currentPrompt,
    disabled,
    onSelectVersion,
  }: {
    currentPrompt: string;
    disabled?: boolean;
    onSelectVersion: (version: number) => void;
  }) => (
    <div data-testid="iteration-timeline">
      <span>{currentPrompt}</span>
      <button type="button" disabled={disabled} onClick={() => onSelectVersion(1)}>
        select-version
      </button>
    </div>
  ),
}));

vi.mock('./option-card', () => ({
  OptionCard: ({
    modelName,
    isActive,
    showVote,
    onClick,
  }: {
    modelName: string;
    isActive: boolean;
    showVote: boolean;
    onClick: () => void;
  }) => (
    <button
      type="button"
      data-testid={`option-${modelName}`}
      data-active={isActive}
      onClick={onClick}
    >
      {modelName}
      {showVote ? ':vote' : ''}
    </button>
  ),
}));

vi.mock('./prompt-bar', () => ({
  PromptBar: ({
    onSubmit,
    isLoading,
    disabled,
    placeholder,
  }: {
    onSubmit: (prompt: string) => void;
    isLoading?: boolean;
    disabled?: boolean;
    placeholder?: string;
  }) => (
    <div data-testid="prompt-bar">
      <span data-testid="placeholder">{placeholder}</span>
      <span data-testid="loading">{String(!!isLoading)}</span>
      <span data-testid="disabled">{String(!!disabled)}</span>
      <button type="button" onClick={() => onSubmit('follow-up')}>
        submit-follow-up
      </button>
    </div>
  ),
}));

function sandbox(overrides: Partial<SandboxState> = {}): SandboxState {
  return {
    sandboxId: null,
    previewUrl: null,
    snapshotId: null,
    status: 'idle',
    files: {},
    activeFile: null,
    terminalOutput: [],
    error: null,
    expiresAt: null,
    ...overrides,
  };
}

describe('LeftPanel', () => {
  beforeEach(() => {
    mocks.webdevState.phase = 'idle';
    mocks.webdevState.activeWorkflowId = null;
    mocks.webdevState.activeIterationVersion = 0;
    mocks.webdevState.sandboxes = new Map();
    mocks.webdevState.iterations = [];
    mocks.webdevState.submittedPrompt = '';
    mocks.workflowState.workflows = new Map();
    mocks.workflowState.workflowOrder = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows enter-prompt empty state when idle with no options', () => {
    render(<LeftPanel onFollowUp={vi.fn()} className="extra" />);
    expect(screen.getByText('WebDev.enter_prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('iteration-timeline')).not.toBeInTheDocument();
    expect(screen.getByTestId('placeholder')).toHaveTextContent('WebDev.placeholder_idle');
    expect(screen.getByTestId('disabled')).toHaveTextContent('true');
  });

  it('renders iteration timeline when phase has a submitted prompt', () => {
    mocks.webdevState.phase = 'ready';
    mocks.webdevState.submittedPrompt = '  Build a site  ';
    mocks.webdevState.iterations = [{ version: 1, prompt: 'first' }];

    render(<LeftPanel onFollowUp={vi.fn()} />);
    expect(screen.getByTestId('iteration-timeline')).toBeInTheDocument();
    expect(screen.getByText('Build a site')).toBeInTheDocument();
  });

  it('renders option cards for workflow order and activates on click', () => {
    mocks.webdevState.phase = 'ready';
    mocks.webdevState.submittedPrompt = 'prompt';
    mocks.webdevState.activeWorkflowId = 'wf-1';
    mocks.webdevState.sandboxes = new Map([
      ['wf-1', sandbox()],
      ['wf-2', sandbox()],
    ]);
    mocks.workflowState.workflowOrder = ['wf-1', 'wf-2', 'wf-missing'];
    mocks.workflowState.workflows = new Map([
      ['wf-1', { modelId: 'openai:gpt-4' }],
      ['wf-2', { modelId: 'anthropic:claude' }],
    ]);

    render(<LeftPanel onFollowUp={vi.fn()} />);

    expect(screen.getByTestId('option-gpt-4')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('option-claude')).toHaveTextContent('claude:vote');
    expect(screen.queryByTestId('option-undefined')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('option-claude'));
    expect(mocks.webdevState.setActiveWorkflowId).toHaveBeenCalledWith('wf-2');
  });

  it('shows options while generating even without sandboxes', () => {
    mocks.webdevState.phase = 'generating';
    mocks.webdevState.submittedPrompt = 'prompt';
    mocks.workflowState.workflowOrder = ['wf-1'];
    mocks.workflowState.workflows = new Map([['wf-1', { modelId: 'openai:gpt-test' }]]);

    render(<LeftPanel onFollowUp={vi.fn()} isLoading />);

    expect(screen.getByTestId('option-gpt-test')).toBeInTheDocument();
    expect(screen.getByTestId('option-gpt-test')).not.toHaveTextContent(':vote');
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    expect(screen.getByTestId('disabled')).toHaveTextContent('true');
    expect(screen.getByTestId('placeholder')).toHaveTextContent('WebDev.placeholder_followup');
  });

  it('hides option cards when viewing a past iteration', () => {
    mocks.webdevState.phase = 'ready';
    mocks.webdevState.submittedPrompt = 'prompt';
    mocks.webdevState.activeIterationVersion = 1;
    mocks.webdevState.iterations = [{ version: 1, prompt: 'v1' }];
    mocks.webdevState.sandboxes = new Map([['wf-1', sandbox()]]);
    mocks.workflowState.workflowOrder = ['wf-1'];
    mocks.workflowState.workflows = new Map([['wf-1', { modelId: 'openai:gpt-4' }]]);

    render(<LeftPanel onFollowUp={vi.fn()} />);

    expect(screen.queryByTestId('option-gpt-4')).not.toBeInTheDocument();
    expect(screen.getByTestId('placeholder')).toHaveTextContent('WebDev.switch_to_latest');
    expect(screen.getByTestId('disabled')).toHaveTextContent('true');
  });

  it('disables timeline during generating and wires follow-up submit', () => {
    mocks.webdevState.phase = 'generating';
    mocks.webdevState.submittedPrompt = 'prompt';
    const onFollowUp = vi.fn();

    render(<LeftPanel onFollowUp={onFollowUp} />);
    expect(screen.getByRole('button', { name: 'select-version' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'submit-follow-up' }));
    expect(onFollowUp).toHaveBeenCalledWith('follow-up');
  });

  it('enables prompt bar when ready on latest iteration', () => {
    mocks.webdevState.phase = 'ready';
    mocks.webdevState.submittedPrompt = 'prompt';
    mocks.webdevState.activeIterationVersion = 0;

    render(<LeftPanel onFollowUp={vi.fn()} />);
    expect(screen.getByTestId('disabled')).toHaveTextContent('false');
    expect(screen.getByTestId('placeholder')).toHaveTextContent('WebDev.placeholder_followup');
  });
});
