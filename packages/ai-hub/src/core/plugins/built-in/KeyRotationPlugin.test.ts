import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PluginContext } from '../../../types/plugin';
import { KeyRotationPlugin } from './KeyRotationPlugin';

describe('KeyRotationPlugin', () => {
  let context: PluginContext;

  beforeEach(() => {
    context = {
      providerId: 'test',
      modelId: 'model',
      method: 'generateText',
      attempt: 0,
      metadata: {},
    };
  });

  describe('constructor', () => {
    it('requires at least one key', () => {
      expect(() => new KeyRotationPlugin({ keys: [] })).toThrow('At least one API key is required');
    });

    it('accepts keys array', () => {
      const plugin = new KeyRotationPlugin({ keys: ['key1', 'key2'] });
      expect(plugin.name).toBe('key-rotation');
    });

    it('uses round-robin strategy by default', async () => {
      const plugin = new KeyRotationPlugin({ keys: ['key1', 'key2'] });

      const result1 = await plugin.transformParams({}, context);
      const result2 = await plugin.transformParams({}, { ...context, metadata: {} });

      expect(result1.apiKey).toBe('key1');
      expect(result2.apiKey).toBe('key2');
    });
  });

  describe('round-robin strategy', () => {
    it('rotates through keys', async () => {
      const plugin = new KeyRotationPlugin({
        keys: ['key1', 'key2', 'key3'],
        strategy: 'round-robin',
      });

      const keys: string[] = [];
      for (let i = 0; i < 6; i++) {
        const result = await plugin.transformParams({}, { ...context, metadata: {} });
        keys.push(result.apiKey as string);
      }

      expect(keys).toEqual(['key1', 'key2', 'key3', 'key1', 'key2', 'key3']);
    });
  });

  describe('least-used strategy', () => {
    it('selects least used key', async () => {
      const plugin = new KeyRotationPlugin({
        keys: ['key1', 'key2'],
        strategy: 'least-used',
      });

      const result1 = await plugin.transformParams({}, { ...context, metadata: {} });
      expect(result1.apiKey).toBe('key1');

      const result2 = await plugin.transformParams({}, { ...context, metadata: {} });
      expect(result2.apiKey).toBe('key2');

      const result3 = await plugin.transformParams({}, { ...context, metadata: {} });
      expect(['key1', 'key2']).toContain(result3.apiKey);
    });
  });

  describe('least-errors strategy', () => {
    it('selects key with lowest error rate', async () => {
      const plugin = new KeyRotationPlugin({
        keys: ['key1', 'key2'],
        strategy: 'least-errors',
      });

      await plugin.transformParams({}, { ...context, metadata: {} });
      context.metadata.selectedApiKey = 'key1';
      await plugin.onError(new Error('test'), context);

      await plugin.transformParams({}, { ...context, metadata: {} });
      const result = await plugin.transformParams({}, { ...context, metadata: {} });

      expect(result.apiKey).toBe('key2');
    });
  });

  describe('error tracking', () => {
    it('tracks errors per key', async () => {
      const plugin = new KeyRotationPlugin({ keys: ['key1'] });

      await plugin.transformParams({}, context);
      await plugin.onError(new Error('test'), context);

      const stats = plugin.getStats();
      const key1Stats = stats.get('key1');
      expect(key1Stats?.errors).toBe(1);
      expect(key1Stats?.errorRate).toBe(1);
    });

    it('ignores errors without selected key', async () => {
      const plugin = new KeyRotationPlugin({ keys: ['key1'] });
      await plugin.onError(new Error('test'), context);

      const stats = plugin.getStats();
      expect(stats.get('key1')?.errors).toBe(0);
    });
  });

  describe('maxErrorRate', () => {
    it('disables keys with high error rate', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const plugin = new KeyRotationPlugin({
        keys: ['key1', 'key2'],
        maxErrorRate: 0.5,
      });

      for (let i = 0; i < 5; i++) {
        const ctx = { ...context, metadata: {} };
        await plugin.transformParams({}, ctx);
        if ((ctx.metadata as Record<string, unknown>).selectedApiKey === 'key1') {
          await plugin.onError(new Error('test'), ctx);
        }
      }

      const stats = plugin.getStats();
      const key1Stats = stats.get('key1');
      expect(key1Stats).toBeDefined();

      consoleSpy.mockRestore();
    });
  });

  describe('cooldownPeriod', () => {
    it('re-enables keys after cooldown', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.useFakeTimers();
      const plugin = new KeyRotationPlugin({
        keys: ['key1'],
        maxErrorRate: 0.3,
        cooldownPeriod: 1000,
      });

      for (let i = 0; i < 5; i++) {
        const ctx = { ...context, metadata: {} };
        await plugin.transformParams({}, ctx);
        await plugin.onError(new Error('test'), ctx);
      }

      vi.advanceTimersByTime(1500);

      const ctx = { ...context, metadata: {} };
      const result = await plugin.transformParams({}, ctx);
      expect(result.apiKey).toBe('key1');

      consoleSpy.mockRestore();
      vi.useRealTimers();
    });
  });

  describe('getStats', () => {
    it('returns copy of stats', async () => {
      const plugin = new KeyRotationPlugin({ keys: ['key1'] });
      await plugin.transformParams({}, context);

      const stats = plugin.getStats();
      expect(stats).toBeInstanceOf(Map);
      expect(stats.get('key1')?.uses).toBe(1);
    });
  });

  describe('resetStats', () => {
    it('resets all stats', async () => {
      const plugin = new KeyRotationPlugin({ keys: ['key1'] });
      await plugin.transformParams({}, context);
      await plugin.onError(new Error('test'), context);

      plugin.resetStats();

      const stats = plugin.getStats();
      expect(stats.get('key1')?.uses).toBe(0);
      expect(stats.get('key1')?.errors).toBe(0);
    });
  });

  describe('addKey', () => {
    it('adds a new key', async () => {
      const plugin = new KeyRotationPlugin({ keys: ['key1'] });
      plugin.addKey('key2');

      const stats = plugin.getStats();
      expect(stats.has('key2')).toBe(true);
    });

    it('does not add duplicate keys', () => {
      const plugin = new KeyRotationPlugin({ keys: ['key1'] });
      plugin.addKey('key1');

      const stats = plugin.getStats();
      expect(stats.size).toBe(1);
    });
  });

  describe('removeKey', () => {
    it('removes a key', () => {
      const plugin = new KeyRotationPlugin({ keys: ['key1', 'key2'] });
      plugin.removeKey('key1');

      const stats = plugin.getStats();
      expect(stats.has('key1')).toBe(false);
      expect(stats.has('key2')).toBe(true);
    });

    it('does nothing for non-existent key', () => {
      const plugin = new KeyRotationPlugin({ keys: ['key1'] });
      expect(() => plugin.removeKey('unknown')).not.toThrow();
    });
  });

  describe('no available keys', () => {
    it('throws when all keys are disabled', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.useFakeTimers();
      const plugin = new KeyRotationPlugin({
        keys: ['key1'],
        maxErrorRate: 0.3,
        cooldownPeriod: 60000,
      });

      for (let i = 0; i < 5; i++) {
        const ctx = { ...context, metadata: {} };
        await plugin.transformParams({}, ctx);
        await plugin.onError(new Error('test'), ctx);
      }

      vi.advanceTimersByTime(100);
      const ctx = { ...context, metadata: {} };
      await expect(plugin.transformParams({}, ctx)).rejects.toThrow('No available API keys');

      consoleSpy.mockRestore();
      vi.useRealTimers();
    });
  });

  describe('transformParams', () => {
    it('adds apiKey to params', async () => {
      const plugin = new KeyRotationPlugin({ keys: ['test-key'] });
      const result = await plugin.transformParams({ model: 'gpt-4' }, context);

      expect(result.apiKey).toBe('test-key');
      expect(result.model).toBe('gpt-4');
    });

    it('stores selected key in context', async () => {
      const plugin = new KeyRotationPlugin({ keys: ['test-key'] });
      await plugin.transformParams({}, context);

      expect(context.metadata.selectedApiKey).toBe('test-key');
    });
  });
});
