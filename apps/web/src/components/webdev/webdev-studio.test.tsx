import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  webdevState: {
    phase: 'idle' as string,
    featureConfig: null as { enabled: boolean; provider: string } | null,
    sessionId: null as string | null,
    checkConfig: vi.fn(),
    setSessionId: vi.fn(),
    setConversationId: vi.fn(),
    setPhase: vi.fn(),
    setPrompt: vi.fn(),
    setSubmittedPrompt: vi.fn(),
    initSandbox: vi.fn(),
    setSandboxFiles: vi.fn(),
    setSandboxReady: vi.fn(),
    updateSandboxStatus: vi.fn(),
    setActiveWorkflowId: vi.fn(),
    setSnapshotId: vi.fn(),
    addIteration: vi.fn(),
    setActiveIterationVersion: vi.fn(),
  },
  workflowState: {
    createWorkflow: vi.fn((modelId: string) => `wf-${modelId}`),
    updateWorkflow: vi.fn(),
    setWorkflowStatus: vi.fn(),
  },
  startGeneration: vi.fn().mockResolvedValue(undefined),
  handleFollowUp: vi.fn().mockResolvedValue(undefined),
  getResponseId: vi.fn(),
  resetProcessed: vi.fn(),
  rebuildSandboxFromFiles: vi.fn(),
  cancelAllSandboxes: vi.fn(),
  invalidateQueries: vi.fn(),
  matchMediaMatches: true,
  matchMediaListeners: [] as Array<(e: MediaQueryListEvent | MediaQueryList) => void>,
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock('@/hooks/use-webdev-cleanup', () => ({
  useWebDevCleanup: vi.fn(),
}));

vi.mock('@/hooks/use-webdev-generation', () => ({
  useWebDevGeneration: () => ({
    startGeneration: mocks.startGeneration,
    handleFollowUp: mocks.handleFollowUp,
    getResponseId: mocks.getResponseId,
  }),
}));

vi.mock('@/hooks/use-webdev-sandbox', () => ({
  useWebDevSandbox: () => ({
    resetProcessed: mocks.resetProcessed,
    rebuildSandboxFromFiles: mocks.rebuildSandboxFromFiles,
    cancelAllSandboxes: mocks.cancelAllSandboxes,
  }),
}));

vi.mock('@/stores/webdev-store', () => ({
  useWebDevStore: (selector: (state: typeof mocks.webdevState) => unknown) =>
    selector(mocks.webdevState),
  useWebDevStoreShallow: (selector: (state: typeof mocks.webdevState) => unknown) =>
    selector(mocks.webdevState),
  WebDevStoreProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/stores/workflow-store', () => ({
  useWorkflowStore: (selector: (state: typeof mocks.workflowState) => unknown) =>
    selector(mocks.workflowState),
  WorkflowStoreProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./config-modal', () => ({
  ConfigModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="config-modal">config</div> : null,
}));

vi.mock('./left-panel', () => ({
  LeftPanel: ({ onFollowUp }: { onFollowUp: (prompt: string) => void }) => (
    <div data-testid="left-panel">
      <button type="button" onClick={() => onFollowUp('improve it')}>
        follow-up
      </button>
    </div>
  ),
}));

vi.mock('./right-panel', () => ({
  RightPanel: () => <div data-testid="right-panel">right</div>,
}));

vi.mock('./welcome-state', () => ({
  WelcomeState: ({ onSelectPrompt }: { onSelectPrompt: (prompt: string) => void }) => (
    <div data-testid="welcome-state">
      <button type="button" onClick={() => onSelectPrompt('example prompt')}>
        select-example
      </button>
    </div>
  ),
}));

import { WebDevStudio } from './webdev-studio';

function setupMatchMedia(matches: boolean) {
  mocks.matchMediaMatches = matches;
  mocks.matchMediaListeners = [];
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: mocks.matchMediaMatches,
      media: query,
      onchange: null,
      addEventListener: (
        _type: string,
        listener: (e: MediaQueryListEvent | MediaQueryList) => void,
      ) => {
        mocks.matchMediaListeners.push(listener);
      },
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe('WebDevStudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.webdevState.phase = 'idle';
    mocks.webdevState.featureConfig = null;
    mocks.webdevState.sessionId = null;
    mocks.workflowState.createWorkflow.mockImplementation((modelId: string) => `wf-${modelId}`);
    sessionStorage.clear();
    setupMatchMedia(true);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    );
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: { replaceState: vi.fn() },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('shows mobile placeholder when viewport is below desktop breakpoint', async () => {
    setupMatchMedia(false);
    render(<WebDevStudio />);
    await waitFor(() => {
      expect(screen.getByText(/mobile layout coming soon/i)).toBeInTheDocument();
    });
  });

  it('renders welcome state when idle without session', async () => {
    render(<WebDevStudio />);
    await waitFor(() => {
      expect(screen.getByTestId('welcome-state')).toBeInTheDocument();
    });
    expect(screen.getByTestId('left-panel')).toBeInTheDocument();
    expect(mocks.webdevState.checkConfig).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'select-example' }));
    expect(mocks.webdevState.setPrompt).toHaveBeenCalledWith('example prompt');
  });

  it('renders right panel when not idle or session exists', async () => {
    mocks.webdevState.phase = 'ready';
    mocks.webdevState.sessionId = 'session-1';
    render(<WebDevStudio />);
    await waitFor(() => {
      expect(screen.getByTestId('right-panel')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('welcome-state')).not.toBeInTheDocument();
  });

  it('opens config modal when feature is disabled', async () => {
    mocks.webdevState.featureConfig = { enabled: false, provider: 'vercel-sandbox' };
    render(<WebDevStudio />);
    await waitFor(() => {
      expect(screen.getByTestId('config-modal')).toBeInTheDocument();
    });
  });

  it('handles follow-up from left panel', async () => {
    mocks.webdevState.phase = 'ready';
    mocks.webdevState.sessionId = 's1';
    render(<WebDevStudio />);
    await waitFor(() => expect(screen.getByTestId('left-panel')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'follow-up' }));
    expect(mocks.webdevState.setSubmittedPrompt).toHaveBeenCalledWith('improve it');
    expect(mocks.webdevState.setPrompt).toHaveBeenCalledWith('');
    expect(mocks.cancelAllSandboxes).toHaveBeenCalled();
    expect(mocks.resetProcessed).toHaveBeenCalled();
    expect(mocks.handleFollowUp).toHaveBeenCalledWith('improve it');
  });

  it('sets session id from initialSessionId prop', async () => {
    mocks.webdevState.sessionId = null;
    render(<WebDevStudio initialSessionId="session-abc" />);
    await waitFor(() => {
      expect(mocks.webdevState.setSessionId).toHaveBeenCalledWith('session-abc');
    });
  });

  it('loads existing session from API and rebuilds sandboxes', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          session: {
            id: 'session-1',
            conversationId: 'conv-1',
            prompt: 'Build landing page',
            status: 'ready',
          },
          iterations: [
            { id: 'it-1', prompt: 'Build landing page', version: 1, createdAt: past },
            { id: 'it-2', prompt: 'Add footer', version: 2, createdAt: future },
          ],
          responses: [
            {
              id: 'r-old',
              modelId: 'openai:gpt-4',
              keyId: 'k1',
              status: 'completed',
              files: { 'index.html': 'old' },
              sandboxId: null,
              previewUrl: null,
              expiresAt: null,
              snapshotId: null,
              snapshotExpiresAt: null,
              iterationId: 'it-1',
              displayPosition: 0,
              content: 'old content',
            },
            {
              id: 'r-new',
              modelId: 'openai:gpt-4',
              keyId: 'k1',
              status: 'completed',
              files: { 'index.html': 'new' },
              sandboxId: 'sb-1',
              previewUrl: 'https://preview.test',
              expiresAt: future,
              snapshotId: null,
              snapshotExpiresAt: null,
              iterationId: 'it-2',
              displayPosition: 0,
              content: 'new content',
            },
            {
              id: 'r-snap',
              modelId: 'anthropic:claude',
              keyId: 'k2',
              status: 'completed',
              files: { 'app.tsx': 'x' },
              sandboxId: null,
              previewUrl: null,
              expiresAt: null,
              snapshotId: 'snap-1',
              snapshotExpiresAt: future,
              iterationId: 'it-2',
              displayPosition: 1,
              content: 'snap content',
            },
          ],
        }),
      }),
    );

    render(<WebDevStudio initialSessionId="session-1" />);

    await waitFor(() => {
      expect(mocks.webdevState.setPhase).toHaveBeenCalledWith('building');
    });
    expect(mocks.webdevState.setConversationId).toHaveBeenCalledWith('conv-1');
    expect(mocks.webdevState.setSubmittedPrompt).toHaveBeenCalledWith('Build landing page');
    expect(mocks.webdevState.addIteration).toHaveBeenCalled();
    expect(mocks.webdevState.setActiveIterationVersion).toHaveBeenCalledWith(0);
    expect(mocks.rebuildSandboxFromFiles).toHaveBeenCalled();
    expect(mocks.webdevState.setSandboxReady).toHaveBeenCalledWith(
      'wf-openai:gpt-4',
      'sb-1',
      'https://preview.test',
      future,
    );
  });

  it('sets error phase when session fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    );

    render(<WebDevStudio initialSessionId="bad-session" />);
    await waitFor(() => {
      expect(mocks.webdevState.setPhase).toHaveBeenCalledWith('error');
    });
  });

  it('creates session from webdev_init storage and starts generation', async () => {
    sessionStorage.setItem(
      'webdev_init',
      JSON.stringify({
        prompt: 'Make a todo app',
        models: [{ modelId: 'openai:gpt-4', keyId: 'key-1' }],
        conversationId: 'conv-new',
      }),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          sessionId: 'session-new',
          iteration: { id: 'it-1', version: 1, prompt: 'Make a todo app' },
          responses: [{ id: 'r1', modelId: 'openai:gpt-4', displayPosition: 0 }],
        }),
      }),
    );

    render(<WebDevStudio />);

    await waitFor(() => {
      expect(mocks.startGeneration).toHaveBeenCalled();
    });
    expect(mocks.webdevState.setConversationId).toHaveBeenCalledWith('conv-new');
    expect(mocks.webdevState.setPhase).toHaveBeenCalledWith('generating');
    expect(mocks.webdevState.setSessionId).toHaveBeenCalledWith('session-new');
    expect(mocks.invalidateQueries).toHaveBeenCalled();
    expect(sessionStorage.getItem('webdev_init')).toBeNull();
  });

  it('sets error phase when create session API fails', async () => {
    sessionStorage.setItem(
      'webdev_init',
      JSON.stringify({
        prompt: 'fail me',
        models: [{ modelId: 'openai:gpt-4', keyId: 'key-1' }],
      }),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    );

    render(<WebDevStudio />);
    await waitFor(() => {
      expect(mocks.webdevState.setPhase).toHaveBeenCalledWith('error');
    });
  });
});
