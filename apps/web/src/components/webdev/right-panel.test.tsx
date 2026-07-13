import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IterationSnapshot, SandboxState } from '@/types/webdev';
import { RightPanel } from './right-panel';

const mocks = vi.hoisted(() => ({
  webdevState: {
    sandboxes: new Map<string, SandboxState>(),
    activeWorkflowId: null as string | null,
    phase: 'idle' as string,
    iterations: [] as IterationSnapshot[],
    activeIterationVersion: 0,
  },
  workflowState: {
    workflows: new Map<
      string,
      { status?: string; error?: string; modelId?: string; messages?: unknown[] }
    >(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));

vi.mock('@/components/ai-elements/code-block', () => ({
  CodeBlockContent: ({
    code,
    language,
    theme,
  }: {
    code: string;
    language: string;
    theme: string;
  }) => <pre data-testid="code-block">{`${language}:${theme}:${code}`}</pre>,
}));

vi.mock('@/components/ai-elements/file-tree', () => ({
  FileTree: ({
    children,
    onSelect,
  }: {
    children?: ReactNode;
    onSelect?: (path: string) => void;
  }) => (
    <div data-testid="file-tree">
      {children}
      <button type="button" onClick={() => onSelect?.('src/App.tsx')}>
        select-app
      </button>
    </div>
  ),
  FileTreeFolder: ({ name, children }: { name: string; children?: ReactNode }) => (
    <div>
      {`folder:${name}`}
      {children}
    </div>
  ),
  FileTreeFile: ({ name }: { name: string }) => <div>{`file:${name}`}</div>,
}));

vi.mock('@/stores/webdev-store', () => ({
  useWebDevStoreShallow: (selector: (state: typeof mocks.webdevState) => unknown) =>
    selector(mocks.webdevState),
}));

vi.mock('@/stores/workflow-store', () => ({
  useWorkflowStore: (
    selector: (state: typeof mocks.workflowState & { workflows: Map<string, unknown> }) => unknown,
  ) =>
    selector(
      mocks.workflowState as typeof mocks.workflowState & { workflows: Map<string, unknown> },
    ),
}));

vi.mock('./building-overlay', () => ({
  BuildingOverlay: () => <div data-testid="building-overlay">Building...</div>,
}));

vi.mock('./code-view', () => ({
  CodeView: () => <div data-testid="code-view">CodeView</div>,
}));

vi.mock('./error-state', () => ({
  ErrorState: ({ message }: { message?: string }) => (
    <div data-testid="error-state">{message ?? 'error'}</div>
  ),
}));

vi.mock('./model-tab-bar', () => ({
  ModelTabBar: () => <div data-testid="model-tab-bar">ModelTabBar</div>,
}));

vi.mock('./preview-view', () => ({
  PreviewView: () => <div data-testid="preview-view">PreviewView</div>,
}));

vi.mock('./streaming-code-view', () => ({
  StreamingCodeView: () => <div data-testid="streaming-code-view">Streaming</div>,
}));

vi.mock('./toolbar', () => ({
  Toolbar: ({
    viewMode,
    onViewModeChange,
    onRefresh,
  }: {
    viewMode: string;
    onViewModeChange: (mode: 'preview' | 'code') => void;
    onRefresh: () => void;
  }) => (
    <div data-testid="toolbar">
      <span data-testid="view-mode">{viewMode}</span>
      <button type="button" onClick={() => onViewModeChange('code')}>
        to-code
      </button>
      <button type="button" onClick={() => onViewModeChange('preview')}>
        to-preview
      </button>
      <button type="button" onClick={onRefresh}>
        refresh
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

describe('RightPanel', () => {
  beforeEach(() => {
    mocks.webdevState.sandboxes = new Map();
    mocks.webdevState.activeWorkflowId = null;
    mocks.webdevState.phase = 'idle';
    mocks.webdevState.iterations = [];
    mocks.webdevState.activeIterationVersion = 0;
    mocks.workflowState.workflows = new Map();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows ModelTabBar when multiple sandboxes exist', () => {
    mocks.webdevState.sandboxes = new Map([
      ['wf-1', sandbox()],
      ['wf-2', sandbox()],
    ]);
    render(<RightPanel className="custom" />);
    expect(screen.getByTestId('model-tab-bar')).toBeInTheDocument();
    expect(screen.getByTestId('preview-view')).toBeInTheDocument();
  });

  it('shows streaming view while generating', () => {
    mocks.webdevState.phase = 'generating';
    mocks.webdevState.activeWorkflowId = 'wf-1';
    mocks.webdevState.sandboxes = new Map([['wf-1', sandbox()]]);
    mocks.workflowState.workflows = new Map([['wf-1', { status: 'running' }]]);

    render(<RightPanel />);
    expect(screen.getByTestId('streaming-code-view')).toBeInTheDocument();
  });

  it('shows error state on phase error using workflow or sandbox error', () => {
    mocks.webdevState.phase = 'error';
    mocks.webdevState.activeWorkflowId = 'wf-1';
    mocks.webdevState.sandboxes = new Map([['wf-1', sandbox({ error: 'sandbox boom' })]]);
    mocks.workflowState.workflows = new Map([['wf-1', { status: 'failed', error: 'wf boom' }]]);

    const { rerender } = render(<RightPanel />);
    expect(screen.getByTestId('error-state')).toHaveTextContent('wf boom');

    mocks.workflowState.workflows = new Map([['wf-1', { status: 'failed' }]]);
    rerender(<RightPanel />);
    expect(screen.getByTestId('error-state')).toHaveTextContent('sandbox boom');
  });

  it('shows error state when generating and active workflow failed', () => {
    mocks.webdevState.phase = 'generating';
    mocks.webdevState.activeWorkflowId = 'wf-1';
    mocks.webdevState.sandboxes = new Map([['wf-1', sandbox()]]);
    mocks.workflowState.workflows = new Map([
      ['wf-1', { status: 'failed', error: 'generation failed' }],
    ]);

    render(<RightPanel />);
    expect(screen.getByTestId('error-state')).toHaveTextContent('generation failed');
  });

  it('switches between preview and code views', () => {
    mocks.webdevState.phase = 'ready';
    mocks.webdevState.activeWorkflowId = 'wf-1';
    mocks.webdevState.sandboxes = new Map([['wf-1', sandbox({ status: 'ready' })]]);

    render(<RightPanel />);
    expect(screen.getByTestId('preview-view')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'to-code' }));
    expect(screen.getByTestId('code-view')).toBeInTheDocument();
    expect(screen.queryByTestId('preview-view')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'to-preview' }));
    expect(screen.getByTestId('preview-view')).toBeInTheDocument();
  });

  it('shows building overlay for creating/installing/starting sandboxes', () => {
    mocks.webdevState.phase = 'ready';
    mocks.webdevState.activeWorkflowId = 'wf-1';
    mocks.webdevState.sandboxes = new Map([['wf-1', sandbox({ status: 'creating' })]]);

    const { rerender } = render(<RightPanel />);
    expect(screen.getByTestId('building-overlay')).toBeInTheDocument();

    mocks.webdevState.sandboxes = new Map([['wf-1', sandbox({ status: 'installing' })]]);
    rerender(<RightPanel />);
    expect(screen.getByTestId('building-overlay')).toBeInTheDocument();

    mocks.webdevState.sandboxes = new Map([['wf-1', sandbox({ status: 'ready' })]]);
    rerender(<RightPanel />);
    expect(screen.queryByTestId('building-overlay')).not.toBeInTheDocument();
  });

  it('renders snapshot code view for past iterations without building overlay', () => {
    mocks.webdevState.phase = 'ready';
    mocks.webdevState.activeWorkflowId = 'wf-1';
    mocks.webdevState.activeIterationVersion = 1;
    mocks.webdevState.sandboxes = new Map([['wf-1', sandbox({ status: 'creating' })]]);
    mocks.webdevState.iterations = [
      {
        id: 'it-1',
        version: 1,
        prompt: 'old prompt',
        sandboxes: new Map([
          [
            'wf-1',
            {
              files: { 'src/App.tsx': 'export default 1', 'README.md': 'docs' },
              sandboxId: null,
              snapshotId: null,
              previewUrl: null,
              expiresAt: null,
            },
          ],
        ]),
        responseMap: new Map(),
      },
    ];

    render(<RightPanel />);
    expect(screen.queryByTestId('building-overlay')).not.toBeInTheDocument();
    expect(screen.getByTestId('file-tree')).toBeInTheDocument();
    expect(screen.getByText('file:App.tsx')).toBeInTheDocument();
    expect(screen.getByTestId('code-block')).toHaveTextContent('tsx:dark:export default 1');
  });

  it('shows no-files message for empty past iteration snapshot', () => {
    mocks.webdevState.activeWorkflowId = 'wf-1';
    mocks.webdevState.activeIterationVersion = 1;
    mocks.webdevState.iterations = [
      {
        id: 'it-1',
        version: 1,
        prompt: 'old',
        sandboxes: new Map([
          [
            'wf-1',
            {
              files: {},
              sandboxId: null,
              snapshotId: null,
              previewUrl: null,
              expiresAt: null,
            },
          ],
        ]),
        responseMap: new Map(),
      },
    ];

    render(<RightPanel />);
    expect(screen.getByText('WebDev.no_files_yet')).toBeInTheDocument();
  });

  it('allows selecting files in snapshot code view', () => {
    mocks.webdevState.activeWorkflowId = 'wf-1';
    mocks.webdevState.activeIterationVersion = 2;
    mocks.webdevState.iterations = [
      {
        id: 'it-2',
        version: 2,
        prompt: 'v2',
        sandboxes: new Map([
          [
            'wf-1',
            {
              files: { 'src/main.ts': 'main', 'src/App.tsx': 'app' },
              sandboxId: null,
              snapshotId: null,
              previewUrl: null,
              expiresAt: null,
            },
          ],
        ]),
        responseMap: new Map(),
      },
    ];

    render(<RightPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'select-app' }));
    expect(screen.getByTestId('code-block')).toHaveTextContent('tsx:dark:app');
  });
});
