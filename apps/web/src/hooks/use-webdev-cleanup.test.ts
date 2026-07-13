import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storeState = vi.hoisted(() => {
  const sandboxes = new Map<
    string,
    { sandboxId: string | null; status: string; previewUrl: string | null }
  >();
  const destroyAllSandboxes = vi.fn().mockResolvedValue(undefined);
  return { sandboxes, destroyAllSandboxes };
});

vi.mock('@/stores/webdev-store', () => ({
  useWebDevStore: (selector: (s: typeof storeState) => unknown) => selector(storeState),
}));

import { useWebDevCleanup } from './use-webdev-cleanup';

describe('useWebDevCleanup', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let sendBeaconSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    storeState.sandboxes.clear();
    storeState.destroyAllSandboxes.mockClear();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);
    sendBeaconSpy = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: sendBeaconSpy,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('registers beforeunload and cleans up on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useWebDevCleanup());

    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    expect(storeState.destroyAllSandboxes).toHaveBeenCalled();
  });

  it('sendBeacon with sandbox ids on beforeunload', () => {
    storeState.sandboxes.set('wf-1', {
      sandboxId: 'sb-1',
      status: 'ready',
      previewUrl: 'https://x',
    });
    storeState.sandboxes.set('wf-2', {
      sandboxId: null,
      status: 'idle',
      previewUrl: null,
    });

    renderHook(() => useWebDevCleanup());

    window.dispatchEvent(new Event('beforeunload'));

    expect(sendBeaconSpy).toHaveBeenCalledWith('/api/webdev/sandbox/cleanup', expect.any(Blob));
  });

  it('falls back to fetch keepalive when sendBeacon fails', () => {
    sendBeaconSpy.mockReturnValue(false);
    storeState.sandboxes.set('wf-1', {
      sandboxId: 'sb-1',
      status: 'ready',
      previewUrl: null,
    });

    renderHook(() => useWebDevCleanup());
    window.dispatchEvent(new Event('beforeunload'));

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/webdev/sandbox/cleanup',
      expect.objectContaining({
        method: 'POST',
        keepalive: true,
        body: JSON.stringify({ sandboxIds: ['sb-1'] }),
      }),
    );
  });

  it('does not beacon when no sandbox ids', () => {
    storeState.sandboxes.set('wf-1', {
      sandboxId: null,
      status: 'idle',
      previewUrl: null,
    });

    renderHook(() => useWebDevCleanup());
    window.dispatchEvent(new Event('beforeunload'));

    expect(sendBeaconSpy).not.toHaveBeenCalled();
  });

  it('heartbeats ready sandboxes on interval', async () => {
    storeState.sandboxes.set('wf-1', {
      sandboxId: 'sb-ready',
      status: 'ready',
      previewUrl: 'https://x',
    });
    storeState.sandboxes.set('wf-2', {
      sandboxId: 'sb-creating',
      status: 'creating',
      previewUrl: null,
    });

    renderHook(() => useWebDevCleanup());

    await act(async () => {
      vi.advanceTimersByTime(4 * 60 * 1000);
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/webdev/sandbox/heartbeat',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ sandboxId: 'sb-ready' }),
      }),
    );
    // should not heartbeat non-ready
    expect(fetchSpy).not.toHaveBeenCalledWith(
      '/api/webdev/sandbox/heartbeat',
      expect.objectContaining({
        body: JSON.stringify({ sandboxId: 'sb-creating' }),
      }),
    );
  });
});
