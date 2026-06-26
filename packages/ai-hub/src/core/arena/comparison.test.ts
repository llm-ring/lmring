import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArenaError } from '../../utils/errors';
import { compareModels } from './comparison';

vi.mock('ai', () => ({
  streamText: vi.fn(),
  generateText: vi.fn(),
  wrapLanguageModel: vi.fn(({ model }) => model),
  Output: { object: vi.fn() },
}));

const createMockStreamResult = (text: string) => ({
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

const createMockGenerateResult = (text: string) => ({
  text,
  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
});

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

describe('compareModels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('streaming mode', () => {
    it('compares multiple models in parallel', async () => {
      const aiSdk = await import('ai');
      vi.mocked(aiSdk.streamText)
        .mockResolvedValueOnce(createMockStreamResult('response1') as never)
        .mockResolvedValueOnce(createMockStreamResult('response2') as never);

      const results = await compareModels(
        [
          { provider: createMockProvider('provider1'), model: 'model1' },
          { provider: createMockProvider('provider2'), model: 'model2' },
        ],
        [{ role: 'user', content: 'test' }],
        { streaming: true },
      );

      expect(results).toHaveLength(2);
      expect(results[0]?.status).toBe('success');
      expect(results[1]?.status).toBe('success');
    });

    it('calls onProgress callback', async () => {
      const aiSdk = await import('ai');
      vi.mocked(aiSdk.streamText).mockResolvedValue(createMockStreamResult('chunk') as never);

      const onProgress = vi.fn();
      await compareModels(
        [{ provider: createMockProvider('provider1'), model: 'model1' }],
        [{ role: 'user', content: 'test' }],
        { streaming: true, onProgress },
      );

      expect(onProgress).toHaveBeenCalledWith('provider1', 'model1', 'chunk');
    });

    it('handles abort signal', async () => {
      const aiSdk = await import('ai');
      const controller = new AbortController();
      controller.abort();

      vi.mocked(aiSdk.streamText).mockResolvedValue({
        textStream: {
          getReader: () => ({
            read: async () => ({ done: false, value: 'test' }),
            cancel: vi.fn(),
          }),
        },
        usage: Promise.resolve({}),
      } as never);

      const results = await compareModels(
        [{ provider: createMockProvider('provider1'), model: 'model1' }],
        [],
        { streaming: true, controller },
      );

      expect(results[0]?.status).toBe('cancelled');
    });
  });

  describe('non-streaming mode', () => {
    it('uses generateText for non-streaming', async () => {
      const aiSdk = await import('ai');
      vi.mocked(aiSdk.generateText).mockResolvedValue(
        createMockGenerateResult('response') as never,
      );

      const results = await compareModels(
        [{ provider: createMockProvider('provider1'), model: 'model1' }],
        [{ role: 'user', content: 'test' }],
        { streaming: false },
      );

      expect(aiSdk.generateText).toHaveBeenCalled();
      expect(results[0]?.status).toBe('success');
    });
  });

  describe('error handling', () => {
    it('marks failed models', async () => {
      const aiSdk = await import('ai');
      vi.mocked(aiSdk.streamText)
        .mockResolvedValueOnce(createMockStreamResult('success') as never)
        .mockRejectedValueOnce(new Error('Model failed'));

      const results = await compareModels(
        [
          { provider: createMockProvider('provider1'), model: 'model1' },
          { provider: createMockProvider('provider2'), model: 'model2' },
        ],
        [],
        { streaming: true },
      );

      expect(results[0]?.status).toBe('success');
      expect(results[1]?.status).toBe('failed');
      expect(results[1]?.error?.message).toBe('Model failed');
    });

    it('throws ArenaError when all models fail', async () => {
      const aiSdk = await import('ai');
      vi.mocked(aiSdk.streamText)
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'));

      await expect(
        compareModels(
          [
            { provider: createMockProvider('provider1'), model: 'model1' },
            { provider: createMockProvider('provider2'), model: 'model2' },
          ],
          [],
          { streaming: true },
        ),
      ).rejects.toThrow(ArenaError);
    });

    it('stops on first error when stopOnError is true', async () => {
      const aiSdk = await import('ai');
      vi.mocked(aiSdk.streamText).mockRejectedValue(new Error('Model failed'));

      await expect(
        compareModels([{ provider: createMockProvider('provider1'), model: 'model1' }], [], {
          streaming: true,
          stopOnError: true,
        }),
      ).rejects.toThrow(ArenaError);
    });
  });

  describe('metrics', () => {
    it('includes metrics in results', async () => {
      const aiSdk = await import('ai');
      vi.mocked(aiSdk.streamText).mockResolvedValue(createMockStreamResult('response') as never);

      const results = await compareModels(
        [{ provider: createMockProvider('provider1'), model: 'model1' }],
        [],
        { streaming: true },
      );

      expect(results[0]?.metrics).toBeDefined();
      expect(results[0]?.metrics?.totalTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('provider ID extraction', () => {
    it('uses providerId property', async () => {
      const aiSdk = await import('ai');
      vi.mocked(aiSdk.streamText).mockResolvedValue(createMockStreamResult('response') as never);

      const results = await compareModels(
        [
          {
            provider: { providerId: 'my-provider', languageModel: vi.fn().mockReturnValue({}) },
            model: 'm',
          },
        ],
        [],
        { streaming: true },
      );

      expect(results[0]?.provider).toBe('my-provider');
    });

    it('falls back to name property', async () => {
      const aiSdk = await import('ai');
      vi.mocked(aiSdk.streamText).mockResolvedValue(createMockStreamResult('response') as never);

      const results = await compareModels(
        [
          {
            provider: { name: 'named-provider', languageModel: vi.fn().mockReturnValue({}) },
            model: 'm',
          },
        ],
        [],
        { streaming: true },
      );

      expect(results[0]?.provider).toBe('named-provider');
    });

    it('uses unknown for invalid providers', async () => {
      const aiSdk = await import('ai');
      vi.mocked(aiSdk.streamText).mockResolvedValue(createMockStreamResult('response') as never);

      const results = await compareModels(
        [{ provider: { languageModel: vi.fn().mockReturnValue({}) } as never, model: 'm' }],
        [],
        { streaming: true },
      );

      expect(results[0]?.provider).toBe('unknown');
    });
  });
});
