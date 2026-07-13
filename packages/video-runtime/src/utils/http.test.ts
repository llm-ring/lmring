import { afterEach, describe, expect, it, vi } from 'vitest';
import { VideoError } from './errors';
import { buildUrl, httpRequest, joinUrl, sleep } from './http';

describe('buildUrl', () => {
  it('returns base when no params', () => {
    expect(buildUrl('https://api.example.com/v1')).toBe('https://api.example.com/v1');
  });

  it('appends defined query params and skips undefined', () => {
    const url = buildUrl('https://api.example.com/v1/tasks', {
      page: 1,
      active: true,
      skip: undefined,
      label: 'a b',
    });
    expect(url).toContain('page=1');
    expect(url).toContain('active=true');
    expect(url).toContain('label=a+b');
    expect(url).not.toContain('skip');
  });
});

describe('joinUrl', () => {
  it('joins path segments and trims slashes', () => {
    expect(joinUrl('https://api.example.com/', '/v1/', '/tasks/')).toBe(
      'https://api.example.com/v1/tasks',
    );
  });

  it('ignores empty path segments', () => {
    expect(joinUrl('https://api.example.com', '', '/x')).toBe('https://api.example.com/x');
  });
});

describe('sleep', () => {
  it('resolves after delay', async () => {
    vi.useFakeTimers();
    const promise = sleep(100);
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it('rejects when aborted', async () => {
    const controller = new AbortController();
    const promise = sleep(1000, controller.signal);
    controller.abort();
    await expect(promise).rejects.toThrow('Aborted');
  });
});

describe('httpRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns JSON data on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await httpRequest<{ ok: boolean }>('https://api.example.com/v1', {
      method: 'POST',
      body: { hello: 'world' },
      headers: { Authorization: 'Bearer t' },
    });

    expect(result.status).toBe(200);
    expect(result.data).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/v1',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ hello: 'world' }),
      }),
    );
  });

  it('parses text body as JSON when content-type is missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{"value":1}', { status: 200 }),
    );

    const result = await httpRequest('https://api.example.com/v1');
    expect(result.data).toEqual({ value: 1 });
  });

  it('falls back to raw text when body is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('plain', { status: 200 }));

    const result = await httpRequest('https://api.example.com/v1');
    expect(result.data).toBe('plain');
  });

  it.each([
    [400, 'INVALID_PARAMS', false],
    [401, 'PROVIDER_ERROR', false],
    [403, 'PROVIDER_ERROR', false],
    [404, 'MODEL_NOT_FOUND', false],
    [429, 'RATE_LIMIT', true],
    [500, 'PROVIDER_ERROR', true],
    [502, 'PROVIDER_ERROR', true],
    [503, 'PROVIDER_ERROR', true],
    [504, 'PROVIDER_ERROR', true],
    [418, 'PROVIDER_ERROR', false],
  ] as const)('maps HTTP %s to %s', async (status, code, retryable) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'fail' }), {
        status,
        statusText: 'Error',
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(httpRequest('https://api.example.com/v1')).rejects.toMatchObject({
      code,
      retryable,
      message: expect.stringContaining('fail'),
    });
  });

  it('extracts nested error.message from body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'nested fail' } }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(httpRequest('https://api.example.com/v1')).rejects.toMatchObject({
      message: 'nested fail',
    });
  });

  it('extracts top-level message from body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'top level' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(httpRequest('https://api.example.com/v1')).rejects.toMatchObject({
      message: 'top level',
    });
  });

  it('rethrows existing VideoError', async () => {
    const err = VideoError.invalidParams('already');
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(err);
    await expect(httpRequest('https://api.example.com/v1')).rejects.toBe(err);
  });

  it('maps AbortError without external signal to timeout', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError);

    await expect(httpRequest('https://api.example.com/v1', { timeout: 10 })).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });

  it('maps AbortError with external abort to NETWORK_ERROR', async () => {
    const controller = new AbortController();
    controller.abort();
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError);

    await expect(
      httpRequest('https://api.example.com/v1', { signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('maps fetch TypeError to NETWORK_ERROR', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(httpRequest('https://api.example.com/v1')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      retryable: true,
    });
  });

  it('maps unknown thrown values via VideoError.from', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce('weird');

    await expect(httpRequest('https://api.example.com/v1')).rejects.toMatchObject({
      code: 'UNKNOWN',
      message: 'weird',
    });
  });
});
