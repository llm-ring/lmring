import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSharedWebDevSandbox } from './use-shared-webdev-sandbox';

function sseResponse(events: Array<Record<string, unknown> | string>): Response {
  const chunks = events.map((e) =>
    typeof e === 'string' ? `data: ${e}\n\n` : `data: ${JSON.stringify(e)}\n\n`,
  );
  const encoder = new TextEncoder();
  let i = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]));
        i += 1;
      } else {
        controller.close();
      }
    },
  });
  return new Response(stream, { status: 200 });
}

describe('useSharedWebDevSandbox', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes sandbox state and auto-creates on mount', async () => {
    fetchSpy.mockResolvedValue(
      sseResponse([
        { type: 'sandbox-creating' },
        { type: 'sandbox-installing' },
        { type: 'sandbox-starting' },
        {
          type: 'sandbox-ready',
          sandboxId: 'sb-1',
          previewUrl: 'https://preview.example.com',
        },
        ' [DONE]'.trim(),
      ]),
    );

    const { result } = renderHook(() =>
      useSharedWebDevSandbox('token-1', [{ id: 'r1', snapshotId: null }]),
    );

    expect(result.current.sandboxes.get('r1')?.status).toBe('idle');

    await waitFor(() => {
      expect(result.current.sandboxes.get('r1')?.status).toBe('ready');
    });

    expect(result.current.sandboxes.get('r1')).toMatchObject({
      sandboxId: 'sb-1',
      previewUrl: 'https://preview.example.com',
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/webdev/sandbox/shared',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          shareToken: 'token-1',
          responseId: 'r1',
        }),
      }),
    );
  });

  it('includes snapshotId when available', async () => {
    fetchSpy.mockResolvedValue(
      sseResponse([
        { type: 'sandbox-ready', sandboxId: 'sb-2', previewUrl: 'https://p' },
        '[DONE]',
      ]),
    );

    renderHook(() => useSharedWebDevSandbox('token-1', [{ id: 'r1', snapshotId: 'snap-1' }]));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/webdev/sandbox/shared',
        expect.objectContaining({
          body: JSON.stringify({
            shareToken: 'token-1',
            responseId: 'r1',
            snapshotId: 'snap-1',
          }),
        }),
      );
    });
  });

  it('sets error when API returns non-ok', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Rate limit exceeded' }),
    } as Response);

    const { result } = renderHook(() =>
      useSharedWebDevSandbox('token-1', [{ id: 'r1', snapshotId: null }]),
    );

    await waitFor(() => {
      expect(result.current.sandboxes.get('r1')?.status).toBe('error');
    });
    expect(result.current.sandboxes.get('r1')?.error).toBe('Rate limit exceeded');
  });

  it('sets error from SSE error event', async () => {
    fetchSpy.mockResolvedValue(
      sseResponse([{ type: 'error', message: 'install failed' }, '[DONE]']),
    );

    const { result } = renderHook(() =>
      useSharedWebDevSandbox('token-1', [{ id: 'r1', snapshotId: null }]),
    );

    await waitFor(() => {
      expect(result.current.sandboxes.get('r1')?.status).toBe('error');
    });
    expect(result.current.sandboxes.get('r1')?.error).toBe('install failed');
  });

  it('handles network errors', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() =>
      useSharedWebDevSandbox('token-1', [{ id: 'r1', snapshotId: null }]),
    );

    await waitFor(() => {
      expect(result.current.sandboxes.get('r1')?.status).toBe('error');
    });
    expect(result.current.sandboxes.get('r1')?.error).toBe('network down');
  });

  it('exposes isAnyLoading while creating', async () => {
    let resolveFetch!: (value: Response) => void;
    fetchSpy.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useSharedWebDevSandbox('token-1', [{ id: 'r1', snapshotId: null }]),
    );

    await waitFor(() => {
      expect(result.current.sandboxes.get('r1')?.status).toBe('creating');
    });
    expect(result.current.isAnyLoading).toBe(true);

    await act(async () => {
      resolveFetch(
        sseResponse([
          { type: 'sandbox-ready', sandboxId: 'sb', previewUrl: 'https://p' },
          '[DONE]',
        ]),
      );
    });

    await waitFor(() => {
      expect(result.current.sandboxes.get('r1')?.status).toBe('ready');
    });
    expect(result.current.isAnyLoading).toBe(false);
  });

  it('aborts in-flight requests on unmount', async () => {
    const abortSpy = vi.fn();
    fetchSpy.mockImplementation((_url: RequestInfo | URL, init?: RequestInit) => {
      const signal = (init as RequestInit | undefined)?.signal;
      if (signal) {
        signal.addEventListener('abort', abortSpy);
      }
      return new Promise(() => {}); // never resolves
    });

    const { unmount } = renderHook(() =>
      useSharedWebDevSandbox('token-1', [{ id: 'r1', snapshotId: null }]),
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    unmount();
    expect(abortSpy).toHaveBeenCalled();
  });
});
