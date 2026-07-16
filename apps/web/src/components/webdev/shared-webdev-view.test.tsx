import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SharedSandboxState } from '@/hooks/use-shared-webdev-sandbox';
import { SharedWebDevView } from './shared-webdev-view';

const mocks = vi.hoisted(() => ({
  sandboxes: new Map<string, SharedSandboxState>(),
  createSandbox: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { version?: number }) =>
      options?.version ? `${key}:${options.version}` : key,
  }),
}));

vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'dark' }) }));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

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
  FileTreeFile: ({ name }: { name: string }) => <div>{`file:${name}`}</div>,
}));

vi.mock('@/hooks/use-shared-webdev-sandbox', () => ({
  useSharedWebDevSandbox: () => ({
    sandboxes: mocks.sandboxes,
    createSandbox: mocks.createSandbox,
  }),
}));

const baseProps = {
  shareToken: 'token-1',
  session: { id: 's1', prompt: 'Build a shared site', status: 'ready' },
  responses: [
    {
      id: 'r1',
      modelId: 'openai:gpt-4',
      files: { 'src/App.tsx': 'export default 1', 'README.md': 'docs' } as Record<string, string>,
      status: 'completed',
      displayPosition: 0,
      snapshotId: 'snap-1',
      snapshotExpiresAt: null,
      content: null,
    },
    {
      id: 'r2',
      modelId: 'anthropic:claude',
      files: { 'index.html': '<html />' } as Record<string, string>,
      status: 'completed',
      displayPosition: 1,
      snapshotId: null,
      snapshotExpiresAt: null,
      content: null,
    },
  ],
  iterations: [
    { id: 'it-1', version: 1, prompt: 'Build a shared site', createdAt: '2024-01-01' },
    { id: 'it-2', version: 2, prompt: 'Polish styles', createdAt: '2024-01-02' },
  ],
  user: { name: 'Alice', avatarUrl: null },
  conversationTitle: 'Shared session',
};

describe('SharedWebDevView', () => {
  beforeEach(() => {
    mocks.sandboxes = new Map();
    mocks.createSandbox.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders iterations, model cards, and read-only notice', () => {
    render(<SharedWebDevView {...baseProps} />);

    expect(screen.getByText('SharedWebDev.iteration_label:1')).toBeInTheDocument();
    expect(screen.getByText('Polish styles')).toBeInTheDocument();
    expect(screen.getAllByText('gpt-4').length).toBeGreaterThan(0);
    expect(screen.getAllByText('claude').length).toBeGreaterThan(0);
    expect(screen.getByText('SharedWebDev.read_only_notice')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'lmring' })).toHaveAttribute('href', '/');
  });

  it('falls back to session prompt when no iterations exist', () => {
    render(<SharedWebDevView {...baseProps} iterations={[]} />);
    expect(screen.getByText('Build a shared site')).toBeInTheDocument();
  });

  it('selects responses from left cards and model tabs', () => {
    mocks.sandboxes = new Map([
      ['r1', { status: 'ready', previewUrl: 'https://one.test', sandboxId: 'sb1', error: null }],
      ['r2', { status: 'ready', previewUrl: 'https://two.test', sandboxId: 'sb2', error: null }],
    ]);

    render(<SharedWebDevView {...baseProps} />);
    const claudeCard = screen.getAllByText('claude')[0];
    if (!claudeCard) {
      throw new Error('Expected claude response card');
    }
    fireEvent.click(claudeCard);
    expect(screen.getByTitle('Preview - anthropic:claude')).toBeInTheDocument();
  });

  it('shows waiting/building preview states and switches to code view', async () => {
    mocks.sandboxes = new Map([
      ['r1', { status: 'idle', previewUrl: null, sandboxId: null, error: null }],
    ]);
    render(<SharedWebDevView {...baseProps} />);
    expect(screen.getByText('WebDev.waiting_generation')).toBeInTheDocument();

    fireEvent.click(screen.getByText('WebDev.tab_code_label'));
    expect(screen.getByTestId('file-tree')).toBeInTheDocument();
    expect(screen.getByTestId('code-block')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'select-app' }));
    expect(screen.getByTestId('code-block')).toHaveTextContent('tsx:dark:export default 1');
  });

  it('shows empty code view when active response has no files', () => {
    const firstResponse = baseProps.responses[0];
    if (!firstResponse) {
      throw new Error('Expected at least one response in baseProps');
    }
    const props = {
      ...baseProps,
      responses: [
        {
          ...firstResponse,
          files: null,
        },
      ],
    };
    render(<SharedWebDevView {...props} />);
    fireEvent.click(screen.getByText('WebDev.tab_code_label'));
    expect(screen.getByText('WebDev.no_files_yet')).toBeInTheDocument();
  });

  it('shows status indicators and building overlay', () => {
    mocks.sandboxes = new Map([
      ['r1', { status: 'creating', previewUrl: null, sandboxId: null, error: null }],
      ['r2', { status: 'error', previewUrl: null, sandboxId: null, error: 'boom' }],
    ]);

    render(<SharedWebDevView {...baseProps} />);
    expect(screen.getAllByText('WebDev.status_creating_sandbox').length).toBeGreaterThan(0);
    expect(screen.getByText('WebDev.status_error')).toBeInTheDocument();
  });

  it('shows error state with rebuild action', async () => {
    mocks.sandboxes = new Map([
      ['r1', { status: 'error', previewUrl: null, sandboxId: null, error: 'failed hard' }],
    ]);

    render(<SharedWebDevView {...baseProps} />);
    expect(screen.getByText('failed hard')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'SharedWebDev.rebuild_preview' }));
    await waitFor(() => expect(mocks.createSandbox).toHaveBeenCalledWith('r1'));
  });

  it('supports toolbar refresh, copy, and open external when ready', () => {
    mocks.sandboxes = new Map([
      [
        'r1',
        { status: 'ready', previewUrl: 'https://preview.test', sandboxId: 'sb1', error: null },
      ],
    ]);

    render(<SharedWebDevView {...baseProps} />);
    expect(screen.getByTitle('Preview - openai:gpt-4')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('WebDev.refresh_preview_label'));
    fireEvent.click(screen.getByLabelText('WebDev.copy_url'));
    fireEvent.click(screen.getByLabelText('WebDev.open_new_tab'));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://preview.test');
    expect(window.open).toHaveBeenCalledWith(
      'https://preview.test',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('disables preview actions when not ready', () => {
    mocks.sandboxes = new Map([
      ['r1', { status: 'idle', previewUrl: null, sandboxId: null, error: null }],
    ]);
    render(<SharedWebDevView {...baseProps} />);

    expect(screen.getByLabelText('WebDev.refresh_preview_label')).toBeDisabled();
    expect(screen.getByLabelText('WebDev.copy_url')).toBeDisabled();
    expect(screen.getByLabelText('WebDev.open_new_tab')).toBeDisabled();
  });
});
