import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArenaError } from '../../utils/errors';
import { raceModels } from './race';

vi.mock('ai', () => ({
  streamText: vi.fn(),
  generateText: vi.fn(),
  wrapLanguageModel: vi.fn(({ model }) => model),
  Output: { object: vi.fn() },
}));

const createMockStreamResult = (text: string, delay = 0) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        textStream: {
          getReader: () => {
            let done = false;
            return {
              read: async () => {
                if (done) return { done: true, value: undefined };
                done = true;
                return { done: false, value: text };
              },
              cancel: vi.fn(),
            };
          },
        },
        usage: Promise.resolve({ inputTokens: 10, outputTokens: 20, totalTokens: 30 }),
      });
    }, delay);
  });
};

const createMockGenerateResult = (text: string, delay = 0) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        text,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
    }, delay);
  });
};

const createMockProvider = (providerId: string) => ({
  providerId,
  languageModel: vi.fn().mockReturnValue({
    specificationVersion: 'v4',
    provider: providerId,
    modelId: 'test-model',
    supportedUrls: {},
    doGenerate: vi.fn(),
    doStream: vi.fn(),
  }),
});

describe('raceModels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('streaming mode', () => {
    it('returns first successful result', async () => {
      const aiSdk = await import('ai');
      vi.mocked(aiSdk.streamText)
        .mockImplementationOnce(() => createMockStreamResult('fast', 10) as never)
        .mockImplementationOnce(() => createMockStreamResult('slow', 100) as never);

      const resultPromise = raceModels(
        [
          { provider: createMockProvider('fast-provider'), model: 'model1' },
          { provider: createMockProvider('slow-provider'), model: 'model2' },
        ],
        [{ role: 'user', content: 'test' }],
        { streaming: true },
      );

      await vi.advanceTimersByTimeAsync(150);
      const result = await resultPromise;

      expect(result.status).toBe('success');
      expect(result.provider).toBe('fast-provider');
    });

    it('includes metrics in result', async () => {
      const aiSdk = await import('ai');
      vi.mocked(aiSdk.streamText).mockImplementation(
        () => createMockStreamResult('response', 0) as never,
      );

      const resultPromise = raceModels(
        [{ provider: createMockProvider('provider1'), model: 'model1' }],
        [],
        { streaming: true },
      );

      await vi.advanceTimersByTimeAsync(10);
      const result = await resultPromise;

      expect(result.metrics).toBeDefined();
      expect(result.metrics?.totalTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('non-streaming mode', () => {
    it('uses generateText for non-streaming', async () => {
      const aiSdk = await import('ai');
      vi.mocked(aiSdk.generateText).mockImplementation(
        () => createMockGenerateResult('response', 0) as never,
      );

      const resultPromise = raceModels(
        [{ provider: createMockProvider('provider1'), model: 'model1' }],
        [{ role: 'user', content: 'test' }],
        { streaming: false },
      );

      await vi.advanceTimersByTimeAsync(10);
      const result = await resultPromise;

      expect(aiSdk.generateText).toHaveBeenCalled();
      expect(result.status).toBe('success');
    });
  });

  describe('error handling', () => {
    it('falls back to next successful result if first fails', async () => {
      const aiSdk = await import('ai');
      vi.mocked(aiSdk.streamText)
        .mockRejectedValueOnce(new Error('Fast failure'))
        .mockImplementationOnce(() => createMockStreamResult('slow success', 50) as never);

      const resultPromise = raceModels(
        [
          { provider: createMockProvider('failing-provider'), model: 'model1' },
          { provider: createMockProvider('slow-provider'), model: 'model2' },
        ],
        [],
        { streaming: true },
      );

      await vi.advanceTimersByTimeAsync(100);
      const result = await resultPromise;

      expect(result.status).toBe('success');
      expect(result.provider).toBe('slow-provider');
    });

    it('throws ArenaError when all models fail', async () => {
      const aiSdk = await import('ai');
      vi.mocked(aiSdk.streamText)
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'));

      await expect(
        raceModels(
          [
            { provider: createMockProvider('provider1'), model: 'model1' },
            { provider: createMockProvider('provider2'), model: 'model2' },
          ],
          [],
          { streaming: true },
        ),
      ).rejects.toThrow('All models failed in race');
    });

    it('collects all errors in ArenaError', async () => {
      const aiSdk = await import('ai');
      vi.mocked(aiSdk.streamText)
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'));

      try {
        await raceModels(
          [
            { provider: createMockProvider('provider1'), model: 'model1' },
            { provider: createMockProvider('provider2'), model: 'model2' },
          ],
          [],
          { streaming: true },
        );
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ArenaError);
        expect((e as ArenaError).failures).toHaveLength(2);
      }
    });
  });

  describe('provider ID extraction', () => {
    it('uses providerId property', async () => {
      const aiSdk = await import('ai');
      vi.mocked(aiSdk.streamText).mockImplementation(
        () => createMockStreamResult('response', 0) as never,
      );

      const resultPromise = raceModels(
        [
          {
            provider: { providerId: 'my-provider', languageModel: vi.fn().mockReturnValue({}) },
            model: 'm',
          },
        ],
        [],
        { streaming: true },
      );

      await vi.advanceTimersByTimeAsync(10);
      const result = await resultPromise;

      expect(result.provider).toBe('my-provider');
    });

    it('falls back to name property', async () => {
      const aiSdk = await import('ai');
      vi.mocked(aiSdk.streamText).mockImplementation(
        () => createMockStreamResult('response', 0) as never,
      );

      const resultPromise = raceModels(
        [
          {
            provider: { name: 'named-provider', languageModel: vi.fn().mockReturnValue({}) },
            model: 'm',
          },
        ],
        [],
        { streaming: true },
      );

      await vi.advanceTimersByTimeAsync(10);
      const result = await resultPromise;

      expect(result.provider).toBe('named-provider');
    });
  });

  describe('defaults', () => {
    it('defaults to streaming mode', async () => {
      const aiSdk = await import('ai');
      vi.mocked(aiSdk.streamText).mockImplementation(
        () => createMockStreamResult('response', 0) as never,
      );

      const resultPromise = raceModels(
        [{ provider: createMockProvider('provider1'), model: 'model1' }],
        [],
      );

      await vi.advanceTimersByTimeAsync(10);
      await resultPromise;

      expect(aiSdk.streamText).toHaveBeenCalled();
    });
  });
});
