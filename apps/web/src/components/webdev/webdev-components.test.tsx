import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SandboxState, SandboxStatus } from '@/types/webdev';
import { ActivityLog } from './activity-log';
import { BuildingOverlay } from './building-overlay';
import { CodeView } from './code-view';
import { ConfigModal } from './config-modal';
import { ErrorState } from './error-state';
import { IterationTimeline } from './iteration-timeline';
import { ModelTabBar } from './model-tab-bar';
import { OptionCard } from './option-card';
import { PreviewView } from './preview-view';
import { PromptBar } from './prompt-bar';
import { StreamingCodeView } from './streaming-code-view';
import { Toolbar } from './toolbar';
import { WelcomeState } from './welcome-state';

const mocks = vi.hoisted(() => ({
  webdevState: {
    activeWorkflowId: null as string | null,
    prompt: '',
    submittedPrompt: '',
    sandboxes: new Map<string, SandboxState>(),
    setPrompt: vi.fn(),
    setActiveFile: vi.fn(),
    setActiveWorkflowId: vi.fn(),
  },
  workflowState: {
    workflows: new Map<
      string,
      {
        modelId: string;
        status?: string;
        error?: string;
        pendingResponse?: { content: string };
        messages: Array<{ role: string; content: string }>;
      }
    >(),
  },
  downloadFilesAsZip: vi.fn(),
  promptToFilename: vi.fn(() => 'generated-site'),
  toastError: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { version?: number; count?: number }) =>
      options?.version
        ? `${key}:${options.version}`
        : options?.count
          ? `${key}:${options.count}`
          : key,
  }),
}));

vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));

vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));

vi.mock('@/components/arena/provider-icon', () => ({
  ProviderIcon: ({ providerId }: { providerId: string }) => <span>{`provider:${providerId}`}</span>,
}));

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
  FileTreeFile: ({ name, children }: { name: string; children?: ReactNode }) => (
    <div>
      {`file:${name}`}
      {children}
    </div>
  ),
}));

vi.mock('@/stores/webdev-store', () => ({
  useWebDevStore: (selector: (state: typeof mocks.webdevState) => unknown) =>
    selector(mocks.webdevState),
  useWebDevStoreShallow: (selector: (state: typeof mocks.webdevState) => unknown) =>
    selector(mocks.webdevState),
}));

vi.mock('@/stores/workflow-store', () => ({
  useWorkflowStore: (selector: (state: typeof mocks.workflowState) => unknown) =>
    selector(mocks.workflowState),
}));

vi.mock('@/utils/download-zip', () => ({
  downloadFilesAsZip: mocks.downloadFilesAsZip,
  promptToFilename: mocks.promptToFilename,
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

describe('WebDev presentational components', () => {
  beforeEach(() => {
    mocks.webdevState.activeWorkflowId = null;
    mocks.webdevState.prompt = '';
    mocks.webdevState.submittedPrompt = '';
    mocks.webdevState.sandboxes = new Map();
    mocks.workflowState.workflows = new Map();
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    vi.spyOn(window, 'open').mockImplementation(() => null);
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders all activity icon variants and hides an empty log', () => {
    const { container, rerender } = render(<ActivityLog items={[]} />);
    expect(container).toBeEmptyDOMElement();

    rerender(
      <ActivityLog
        className="custom"
        items={[
          { id: '1', icon: 'folder', text: 'folder' },
          { id: '2', icon: 'file-plus', text: 'file' },
          { id: '3', icon: 'pencil', text: 'edit' },
          { id: '4', icon: 'eye', text: 'preview' },
          { id: '5', icon: 'circle-check', text: 'done' },
          { id: '6', icon: 'circle-x', text: 'failed' },
        ]}
      />,
    );

    expect(screen.getByText('folder')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('custom');
  });

  it('supports single and multi-version iteration navigation', () => {
    const onSelectVersion = vi.fn();
    const { rerender } = render(
      <IterationTimeline
        iterations={[]}
        currentPrompt="current prompt"
        currentVersion={1}
        activeVersion={1}
        onSelectVersion={onSelectVersion}
      />,
    );
    expect(screen.getByText('current prompt')).toBeInTheDocument();

    rerender(
      <IterationTimeline
        iterations={[{ version: 1, prompt: 'first prompt' }]}
        currentPrompt="second prompt"
        currentVersion={2}
        activeVersion={1}
        onSelectVersion={onSelectVersion}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /WebDev.iteration_v:2/ }));
    expect(onSelectVersion).toHaveBeenCalledWith(0);
    expect(screen.getByRole('button', { name: /WebDev.iteration_v:1/ })).toBeDisabled();

    rerender(
      <IterationTimeline
        iterations={[{ version: 1, prompt: 'first prompt' }]}
        currentPrompt="second prompt"
        currentVersion={2}
        activeVersion={2}
        onSelectVersion={onSelectVersion}
        disabled
      />,
    );
    expect(screen.getAllByRole('button')).toSatisfy((buttons: HTMLElement[]) =>
      buttons.every((button) => button.hasAttribute('disabled')),
    );
  });

  it('offers translated example prompts', () => {
    const onSelectPrompt = vi.fn();
    render(<WelcomeState onSelectPrompt={onSelectPrompt} className="welcome" />);

    fireEvent.click(screen.getByRole('button', { name: 'WebDev.example_prompt_2' }));
    expect(onSelectPrompt).toHaveBeenCalledWith('WebDev.example_prompt_2');
    expect(screen.getByText('WebDev.welcome_title')).toBeInTheDocument();
  });

  it('submits trimmed prompts by click and Enter while respecting composition and disabled state', () => {
    mocks.webdevState.prompt = '  improve this  ';
    const onSubmit = vi.fn();
    const { rerender } = render(<PromptBar onSubmit={onSubmit} placeholder="Follow up" />);
    const input = screen.getByPlaceholderText('Follow up');

    fireEvent.change(input, { target: { value: 'new prompt' } });
    expect(mocks.webdevState.setPrompt).toHaveBeenCalledWith('new prompt');
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenLastCalledWith('improve this');

    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(2);
    fireEvent.compositionEnd(input);

    rerender(<PromptBar onSubmit={onSubmit} disabled />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('renders option status and activity branches for the complete sandbox lifecycle', () => {
    const cases: Array<[SandboxStatus, string]> = [
      ['idle', 'WebDev.status_waiting'],
      ['creating', 'WebDev.status_creating_sandbox'],
      ['installing', 'WebDev.status_installing_deps'],
      ['starting', 'WebDev.status_starting_server'],
      ['ready', 'WebDev.status_ready'],
      ['snapshotting', 'WebDev.status_snapshotting'],
      ['restoring', 'WebDev.status_restoring'],
      ['error', 'WebDev.status_error'],
      ['expired', 'WebDev.status_expired'],
      ['stopped', 'WebDev.status_stopped'],
    ];

    for (const [index, [status, key]] of cases.entries()) {
      const workflowId = `wf-${index}`;
      mocks.webdevState.sandboxes = new Map([
        [
          workflowId,
          sandbox({
            status,
            files: status === 'idle' ? {} : { 'src/App.tsx': 'app', 'src/main.ts': 'main' },
            error: status === 'error' ? 'rate limit exceeded' : null,
          }),
        ],
      ]);
      mocks.workflowState.workflows = new Map([
        [
          workflowId,
          {
            modelId: 'openai:gpt-test',
            status: status === 'idle' ? 'running' : 'completed',
            messages: [],
          },
        ],
      ]);
      const onClick = vi.fn();
      render(
        <OptionCard
          workflowId={workflowId}
          index={index}
          modelName="GPT Test"
          isActive={index === 0}
          showVote
          onClick={onClick}
        />,
      );

      expect(screen.getAllByText(key).length).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalled();
      cleanup();
    }
  });

  it('renders empty and populated code views and selects a file', () => {
    mocks.webdevState.activeWorkflowId = 'wf-1';
    mocks.webdevState.sandboxes = new Map([['wf-1', sandbox()]]);
    const { rerender } = render(<CodeView />);
    expect(screen.getByText('WebDev.no_files_yet')).toBeInTheDocument();

    mocks.webdevState.sandboxes = new Map([
      ['wf-1', sandbox({ files: { 'src/App.tsx': 'export default App', 'README.md': 'readme' } })],
    ]);
    rerender(<CodeView />);
    expect(screen.getByText('WebDev.select_file')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'select-app' }));
    expect(mocks.webdevState.setActiveFile).toHaveBeenCalledWith('wf-1', 'src/App.tsx');

    mocks.webdevState.sandboxes = new Map([
      [
        'wf-1',
        sandbox({
          files: { 'src/App.tsx': 'export default App' },
          activeFile: 'src/App.tsx',
        }),
      ],
    ]);
    rerender(<CodeView />);
    expect(screen.getByTestId('code-block')).toHaveTextContent('tsx:dark:export default App');
  });

  it('mounts previews lazily and tracks iframe refs across active tabs', async () => {
    const iframeRefs = { current: new Map<string, HTMLIFrameElement>() };
    const { rerender } = render(<PreviewView iframeRefs={iframeRefs} />);
    expect(screen.getByText('WebDev.no_preview')).toBeInTheDocument();

    mocks.webdevState.activeWorkflowId = 'wf-1';
    mocks.webdevState.sandboxes = new Map([
      ['wf-1', sandbox({ status: 'idle' })],
      ['wf-2', sandbox({ status: 'creating' })],
    ]);
    rerender(<PreviewView iframeRefs={iframeRefs} />);
    expect(screen.getByText('WebDev.waiting_generation')).toBeInTheDocument();

    mocks.webdevState.sandboxes = new Map([
      ['wf-1', sandbox({ status: 'ready', previewUrl: 'https://one.test' })],
      ['wf-2', sandbox({ status: 'ready', previewUrl: 'https://two.test' })],
    ]);
    rerender(<PreviewView iframeRefs={iframeRefs} />);
    await waitFor(() => expect(screen.getByTitle('Preview - wf-1')).toBeInTheDocument());
    expect(iframeRefs.current.has('wf-1')).toBe(true);

    mocks.webdevState.activeWorkflowId = 'wf-2';
    rerender(<PreviewView iframeRefs={iframeRefs} />);
    await waitFor(() => expect(screen.getByTitle('Preview - wf-2')).toBeInTheDocument());
    expect(screen.getByTitle('Preview - wf-1')).toHaveStyle({ visibility: 'hidden' });
  });

  it('switches model tabs and renders active, ready, error, and idle status dots', () => {
    const statuses: SandboxStatus[] = ['creating', 'ready', 'error', 'idle'];
    mocks.webdevState.activeWorkflowId = 'wf-0';
    mocks.webdevState.sandboxes = new Map(
      statuses.map((status, index) => [`wf-${index}`, sandbox({ status })]),
    );
    mocks.workflowState.workflows = new Map(
      statuses.map((_, index) => [
        `wf-${index}`,
        { modelId: `provider-${index}:model-${index}`, messages: [] },
      ]),
    );
    render(<ModelTabBar />);

    fireEvent.click(screen.getByRole('button', { name: /model-2/ }));
    expect(mocks.webdevState.setActiveWorkflowId).toHaveBeenCalledWith('wf-2');
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('supports toolbar preview actions, refresh animation, download, and download errors', async () => {
    mocks.webdevState.activeWorkflowId = 'wf-1';
    mocks.webdevState.submittedPrompt = 'Build a dashboard';
    mocks.webdevState.sandboxes = new Map([
      [
        'wf-1',
        sandbox({
          status: 'ready',
          previewUrl: 'https://preview.test',
          files: { 'src/App.tsx': 'app' },
        }),
      ],
    ]);
    const onViewModeChange = vi.fn();
    const onRefresh = vi.fn();
    render(
      <Toolbar viewMode="preview" onViewModeChange={onViewModeChange} onRefresh={onRefresh} />,
    );

    fireEvent.click(screen.getByText('WebDev.tab_code_label'));
    fireEvent.click(screen.getByLabelText('WebDev.refresh_preview_label'));
    fireEvent.click(screen.getByLabelText('WebDev.copy_url'));
    fireEvent.click(screen.getByLabelText('WebDev.open_new_tab'));
    fireEvent.click(screen.getByText('WebDev.download_label'));

    expect(onViewModeChange).toHaveBeenCalledWith('code');
    expect(onRefresh).toHaveBeenCalled();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://preview.test');
    expect(window.open).toHaveBeenCalledWith(
      'https://preview.test',
      '_blank',
      'noopener,noreferrer',
    );
    await waitFor(() =>
      expect(mocks.downloadFilesAsZip).toHaveBeenCalledWith(
        { 'src/App.tsx': 'app' },
        'generated-site.zip',
      ),
    );
  });

  it('reports unavailable and failed downloads', async () => {
    mocks.webdevState.activeWorkflowId = 'wf-1';
    mocks.webdevState.sandboxes = new Map([['wf-1', sandbox({ status: 'ready' })]]);
    const { rerender } = render(
      <Toolbar viewMode="code" onViewModeChange={vi.fn()} onRefresh={vi.fn()} />,
    );
    fireEvent.click(screen.getByText('WebDev.download_label'));
    expect(mocks.toastError).toHaveBeenCalledWith('WebDev.no_files_to_download');

    mocks.downloadFilesAsZip.mockImplementationOnce(() => {
      throw new Error('zip failed');
    });
    mocks.webdevState.sandboxes = new Map([
      ['wf-1', sandbox({ status: 'ready', files: { 'index.html': '<main />' } })],
    ]);
    rerender(<Toolbar viewMode="code" onViewModeChange={vi.fn()} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByText('WebDev.download_label'));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('WebDev.download_failed'));
  });

  it('renders raw, completed, and currently streaming generated files', () => {
    mocks.webdevState.activeWorkflowId = 'wf-1';
    mocks.workflowState.workflows = new Map([
      [
        'wf-1',
        {
          modelId: 'openai:gpt-test',
          status: 'running',
          pendingResponse: { content: 'thinking about files' },
          messages: [],
        },
      ],
    ]);
    const { rerender } = render(<StreamingCodeView />);
    expect(screen.getByText('thinking about files')).toBeInTheDocument();

    mocks.workflowState.workflows = new Map([
      [
        'wf-1',
        {
          modelId: 'openai:gpt-test',
          status: 'running',
          pendingResponse: {
            content:
              '---FILE: src/App.tsx ---\ncompleted---END FILE---\n---FILE: src/main.ts ---\nstreaming',
          },
          messages: [],
        },
      ],
    ]);
    rerender(<StreamingCodeView />);
    expect(screen.getByText('streaming')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'select-app' }));
    expect(screen.getByTestId('code-block')).toHaveTextContent('completed');

    mocks.workflowState.workflows = new Map([
      [
        'wf-1',
        {
          modelId: 'openai:gpt-test',
          status: 'completed',
          messages: [
            { role: 'user', content: 'prompt' },
            { role: 'assistant', content: '---FILE: index.html ---\nhello---END FILE---' },
          ],
        },
      ],
    ]);
    rerender(<StreamingCodeView />);
    expect(screen.getByTestId('code-block')).toHaveTextContent('html:dark:hello');
  });

  it('renders building, configuration, and retryable error states', () => {
    const retry = vi.fn();
    const { rerender } = render(<BuildingOverlay />);
    expect(screen.getByText('Building...')).toBeInTheDocument();

    rerender(<ConfigModal open onOpenChange={vi.fn()} />);
    expect(screen.getByText('WebDev.config_title')).toBeInTheDocument();
    expect(screen.getByText('WebDev.config_option_access_token')).toBeInTheDocument();

    rerender(
      <ErrorState
        message={JSON.stringify({
          detail: 'Too many requests',
          statusCode: 429,
          isRetryable: true,
        })}
        onRetry={retry}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'WebDev.retry' }));
    expect(retry).toHaveBeenCalled();
    expect(screen.getByText('This error may be temporary. Try again.')).toBeInTheDocument();
  });
});
