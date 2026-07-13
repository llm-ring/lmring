import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createHighlighter = vi.hoisted(() =>
  vi.fn(async () => ({
    getLoadedLanguages: () => ['typescript', 'text'],
    codeToTokens: (code: string) => ({
      bg: '#fff',
      fg: '#000',
      tokens: [
        [
          { content: code.split('\n')[0] ?? '', color: '#111', fontStyle: 7 },
          { content: '', color: '#222' },
        ],
        [],
      ],
    }),
  })),
);

vi.mock('shiki', () => ({
  createHighlighter,
}));

import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockLanguageSelector,
  CodeBlockLanguageSelectorContent,
  CodeBlockLanguageSelectorItem,
  CodeBlockLanguageSelectorTrigger,
  CodeBlockLanguageSelectorValue,
  CodeBlockTitle,
  highlightCode,
} from './code-block';

describe('highlightCode', () => {
  beforeEach(() => {
    createHighlighter.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null initially and notifies callback when ready', async () => {
    const uniqueCode = `const a = ${Math.random()}`;
    const callback = vi.fn();
    const first = highlightCode(uniqueCode, 'typescript', callback);
    expect(first).toBeNull();

    await waitFor(() => expect(callback).toHaveBeenCalled());
    const cached = highlightCode(uniqueCode, 'typescript');
    expect(cached).not.toBeNull();
    expect(cached?.tokens.length).toBeGreaterThan(0);
  });

  it('supports theme overload and caches dual/theme keys separately', async () => {
    const uniqueCode = `theme-${Math.random()}`;
    const cb = vi.fn();
    expect(highlightCode(uniqueCode, 'typescript', 'dark', cb)).toBeNull();
    await waitFor(() => expect(cb).toHaveBeenCalled());
    expect(highlightCode(uniqueCode, 'typescript', 'dark')).not.toBeNull();
  });

  it('handles highlighter failures', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    createHighlighter.mockRejectedValueOnce(new Error('shiki fail'));
    const cb = vi.fn();
    // unique language avoids the successful highlighter cache from earlier tests
    highlightCode(`fail-${Math.random()}`, 'python' as never, cb);
    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('CodeBlock components', () => {
  it('renders CodeBlock with header pieces and body', async () => {
    render(
      <CodeBlock code={'const x = 1\n'} language="typescript" showLineNumbers>
        <CodeBlockHeader>
          <CodeBlockTitle>
            <CodeBlockFilename>app.ts</CodeBlockFilename>
          </CodeBlockTitle>
          <CodeBlockActions>
            <span>actions</span>
          </CodeBlockActions>
        </CodeBlockHeader>
      </CodeBlock>,
    );

    expect(screen.getByText('app.ts')).toBeTruthy();
    expect(document.querySelector('[data-language="typescript"]')).toBeTruthy();
  });

  it('CodeBlockContent renders code body', async () => {
    const unique = `let y = ${Math.random()}`;
    render(<CodeBlockContent code={unique} language="typescript" showLineNumbers theme="light" />);
    await waitFor(() => {
      expect(document.querySelector('pre')?.textContent).toContain('let y');
    });
  });

  it('CodeBlockCopyButton copies code and handles missing clipboard', async () => {
    const onCopy = vi.fn();
    const onError = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText },
    });

    render(
      <CodeBlock code="copy-me" language="typescript">
        <CodeBlockHeader>
          <CodeBlockActions>
            <CodeBlockCopyButton onCopy={onCopy} onError={onError} timeout={10} />
          </CodeBlockActions>
        </CodeBlockHeader>
      </CodeBlock>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    expect(writeText).toHaveBeenCalledWith('copy-me');
    expect(onCopy).toHaveBeenCalled();

    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: undefined,
    });
    render(
      <CodeBlock code="x" language="typescript">
        <CodeBlockCopyButton onError={onError} />
      </CodeBlock>,
    );
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button').at(-1)!);
    });
    expect(onError).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('renders language selector pieces', () => {
    render(
      <CodeBlockLanguageSelector defaultValue="ts">
        <CodeBlockLanguageSelectorTrigger>
          <CodeBlockLanguageSelectorValue />
        </CodeBlockLanguageSelectorTrigger>
        <CodeBlockLanguageSelectorContent>
          <CodeBlockLanguageSelectorItem value="ts">TypeScript</CodeBlockLanguageSelectorItem>
        </CodeBlockLanguageSelectorContent>
      </CodeBlockLanguageSelector>,
    );
    expect(screen.getByText('TypeScript')).toBeTruthy();
  });

  it('renders empty lines and long code cache keys', async () => {
    const longCode = `${'x'.repeat(120)}\n\n${'y'.repeat(120)}`;
    const cb = vi.fn();
    expect(highlightCode(longCode, 'typescript', cb)).toBeNull();
    await waitFor(() => expect(cb).toHaveBeenCalled());
    expect(highlightCode(longCode, 'typescript')).not.toBeNull();

    render(<CodeBlock code={longCode} language="typescript" showLineNumbers className="extra" />);
    expect(document.querySelector('[data-language="typescript"]')).toBeTruthy();
  });

  it('falls back to text language when highlighter lacks requested lang', async () => {
    const uniqueLang = `lang-${Math.random().toString(36).slice(2)}` as never;
    createHighlighter.mockImplementationOnce(async () => ({
      getLoadedLanguages: () => ['text'],
      codeToTokens: (code: string, _opts?: { lang?: string; theme?: string }) => ({
        bg: '#eee',
        fg: '#111',
        tokens: [[{ content: `text:${code}`, color: '#000', fontStyle: 0 }]],
      }),
    }));

    const uniqueCode = `fallback-lang-${Math.random().toString(36).slice(2)}`;
    const cb = vi.fn();
    highlightCode(uniqueCode, uniqueLang, 'light', cb);
    await waitFor(() => expect(cb).toHaveBeenCalled());
    const result = cb.mock.calls[0]?.[0] as {
      bg: string;
      fg: string;
      tokens: { content: string }[][];
    };
    expect(result.bg).toBe('#eee');
    expect(result.fg).toBe('#111');
    expect(result.tokens[0]?.[0]?.content).toContain('text:');
  });

  it('CodeBlockCopyButton reports clipboard write errors', async () => {
    const onError = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('denied')),
      },
    });

    render(
      <CodeBlock code="secret" language="typescript">
        <CodeBlockCopyButton onError={onError} />
      </CodeBlock>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('CodeBlockContent re-renders when code prop changes', async () => {
    const { rerender } = render(
      <CodeBlockContent code="first" language="typescript" theme="dark" />,
    );
    await waitFor(() => expect(createHighlighter).toHaveBeenCalled());
    rerender(<CodeBlockContent code="second" language="typescript" theme="dark" />);
    expect(document.querySelector('pre')).toBeTruthy();
  });

  it('does not re-copy while already in copied state', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <CodeBlock code="once" language="typescript">
        <CodeBlockCopyButton timeout={5000} />
      </CodeBlock>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    expect(writeText).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    expect(writeText).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    vi.useRealTimers();
  });
});
