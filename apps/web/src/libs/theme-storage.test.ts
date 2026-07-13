import type { PersistedThemeConfig } from '@lmring/theme';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearFromLocal,
  fetchThemeConfigFromServer,
  isServerSnapshotNewer,
  loadFromLocal,
  loadLocalThemeSnapshot,
  saveThemeConfigToServer,
  saveToLocal,
  THEME_STORAGE_KEY,
  themePersistStorage,
} from './theme-storage';

const validConfig: PersistedThemeConfig = {
  mode: 'dark',
  seedColor: { l: 0.6, c: 0.15, h: 250 },
  presetName: 'ocean',
};

describe('theme-storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  describe('isServerSnapshotNewer', () => {
    it('returns true when local snapshot is null', () => {
      expect(
        isServerSnapshotNewer(null, { config: validConfig, updatedAt: '2024-01-01T00:00:00.000Z' }),
      ).toBe(true);
    });

    it('compares timestamps', () => {
      const local = { config: validConfig, updatedAt: '2024-01-01T00:00:00.000Z' };
      const serverOlder = { config: validConfig, updatedAt: '2023-01-01T00:00:00.000Z' };
      const serverNewer = { config: validConfig, updatedAt: '2025-01-01T00:00:00.000Z' };

      expect(isServerSnapshotNewer(local, serverOlder)).toBe(false);
      expect(isServerSnapshotNewer(local, serverNewer)).toBe(true);
    });

    it('treats missing local timestamp as older', () => {
      const local = { config: validConfig, updatedAt: null };
      const server = { config: validConfig, updatedAt: '2024-01-01T00:00:00.000Z' };
      expect(isServerSnapshotNewer(local, server)).toBe(true);
    });
  });

  describe('themePersistStorage / local helpers', () => {
    it('saves and loads via persist storage', () => {
      themePersistStorage.setItem(THEME_STORAGE_KEY, { state: validConfig, version: 2 });

      const value = themePersistStorage.getItem(THEME_STORAGE_KEY);
      expect(value).toEqual({ state: validConfig, version: 2 });

      const loaded = loadFromLocal();
      expect(loaded).toEqual(validConfig);

      const snapshot = loadLocalThemeSnapshot();
      expect(snapshot?.config).toEqual(validConfig);
      expect(snapshot?.updatedAt).toBeTruthy();
    });

    it('saveToLocal writes config with optional updatedAt', () => {
      saveToLocal(validConfig, '2024-05-01T00:00:00.000Z');
      const snapshot = loadLocalThemeSnapshot();
      expect(snapshot).toEqual({
        config: validConfig,
        updatedAt: '2024-05-01T00:00:00.000Z',
      });
    });

    it('clearFromLocal removes the key', () => {
      saveToLocal(validConfig);
      clearFromLocal();
      expect(loadFromLocal()).toBeNull();
      expect(themePersistStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    });

    it('returns null for missing storage', () => {
      expect(themePersistStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
      expect(loadLocalThemeSnapshot()).toBeNull();
    });

    it('supports legacy raw serialized config', () => {
      window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(validConfig));
      const snapshot = loadLocalThemeSnapshot();
      expect(snapshot).toEqual({
        config: validConfig,
        updatedAt: null,
      });
    });

    it('returns null for invalid envelope', () => {
      window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ state: 1, version: 'x' }));
      // parseRawEnvelope fails, then deserialize of whole object fails
      expect(loadLocalThemeSnapshot()).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      window.localStorage.setItem(THEME_STORAGE_KEY, '{not-json');
      expect(themePersistStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    });

    it('handles localStorage getItem throwing', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('quota');
      });
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(themePersistStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
      spy.mockRestore();
      err.mockRestore();
    });

    it('handles localStorage setItem throwing', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota');
      });
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() =>
        themePersistStorage.setItem(THEME_STORAGE_KEY, { state: validConfig, version: 0 }),
      ).not.toThrow();
      spy.mockRestore();
      err.mockRestore();
    });

    it('handles localStorage removeItem throwing', () => {
      const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => themePersistStorage.removeItem(THEME_STORAGE_KEY)).not.toThrow();
      spy.mockRestore();
      err.mockRestore();
    });
  });

  describe('fetchThemeConfigFromServer', () => {
    it('returns null when response is not ok', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
      } as Response);

      await expect(fetchThemeConfigFromServer()).resolves.toBeNull();
    });

    it('returns snapshot from API', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          themeConfig: validConfig,
          updatedAt: '2024-02-01T00:00:00.000Z',
        }),
      } as Response);

      await expect(fetchThemeConfigFromServer()).resolves.toEqual({
        config: validConfig,
        updatedAt: '2024-02-01T00:00:00.000Z',
      });
    });

    it('returns null when themeConfig is invalid', async () => {
      // @lmring/theme is aliased to a vitest stub that accepts objects with `mode`
      // and rejects payloads without it.
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ themeConfig: { seedColor: { l: 0.5, c: 0.1, h: 100 } } }),
      } as Response);

      await expect(fetchThemeConfigFromServer()).resolves.toBeNull();
    });

    it('returns null on fetch error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network'));
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      await expect(fetchThemeConfigFromServer()).resolves.toBeNull();
      err.mockRestore();
    });
  });

  describe('saveThemeConfigToServer', () => {
    it('returns null when response not ok', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false } as Response);
      await expect(saveThemeConfigToServer(validConfig)).resolves.toBeNull();
    });

    it('saves response to local storage on success', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          themeConfig: validConfig,
          updatedAt: '2024-03-01T00:00:00.000Z',
        }),
      } as Response);

      const snapshot = await saveThemeConfigToServer(validConfig);
      expect(snapshot).toEqual({
        config: validConfig,
        updatedAt: '2024-03-01T00:00:00.000Z',
      });
      expect(loadLocalThemeSnapshot()?.updatedAt).toBe('2024-03-01T00:00:00.000Z');
    });

    it('falls back to input config when API omits themeConfig', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      const snapshot = await saveThemeConfigToServer(validConfig);
      expect(snapshot).toEqual({ config: validConfig, updatedAt: null });
    });

    it('returns null on fetch error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network'));
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      await expect(saveThemeConfigToServer(validConfig)).resolves.toBeNull();
      err.mockRestore();
    });
  });
});
