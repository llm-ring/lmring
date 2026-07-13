import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storageMocks = vi.hoisted(() => ({
  fetchThemeConfigFromServer: vi.fn(),
  isServerSnapshotNewer: vi.fn(),
  loadLocalThemeSnapshot: vi.fn(),
  saveThemeConfigToServer: vi.fn(),
  themePersistStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  THEME_STORAGE_KEY: 'lmring-theme-config',
}));

vi.mock('@/libs/theme-storage', () => storageMocks);

import { themeSelectors, useThemeStore } from './theme-store';

describe('theme-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.fetchThemeConfigFromServer.mockResolvedValue(null);
    storageMocks.isServerSnapshotNewer.mockReturnValue(false);
    storageMocks.loadLocalThemeSnapshot.mockReturnValue(null);
    storageMocks.saveThemeConfigToServer.mockResolvedValue(null);

    useThemeStore.setState({
      mode: 'system',
      seedColor: { l: 0.55, c: 0.18, h: 255 },
      presetName: 'ocean-blue',
      palette: useThemeStore.getState().palette,
      hydrated: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes default ocean-blue preset state', () => {
    const state = useThemeStore.getState();
    expect(state.mode).toBe('system');
    expect(state.presetName).toBe('ocean-blue');
    expect(state.hydrated).toBe(false);
    expect(state.seedColor.h).toBe(255);
  });

  it('setMode updates mode and syncs to server', () => {
    useThemeStore.getState().setMode('dark');
    expect(useThemeStore.getState().mode).toBe('dark');
    expect(storageMocks.saveThemeConfigToServer).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'dark', presetName: 'ocean-blue' }),
    );
  });

  it('setSeedColor clears preset and regenerates palette', () => {
    const next = { l: 0.6, c: 0.2, h: 120 };
    useThemeStore.getState().setSeedColor(next);
    const state = useThemeStore.getState();
    expect(state.seedColor).toEqual(next);
    expect(state.presetName).toBeNull();
    expect(state.palette).toBeTruthy();
    expect(storageMocks.saveThemeConfigToServer).toHaveBeenCalled();
  });

  it('setPreset applies known preset and ignores unknown names', () => {
    useThemeStore.getState().setPreset('violet');
    expect(useThemeStore.getState().presetName).toBe('violet');
    expect(useThemeStore.getState().seedColor.h).toBe(280);

    const before = useThemeStore.getState();
    useThemeStore.getState().setPreset('does-not-exist');
    expect(useThemeStore.getState().presetName).toBe(before.presetName);
    expect(useThemeStore.getState().seedColor).toEqual(before.seedColor);
  });

  it('resetTheme restores defaults while preserving hydrated flag', () => {
    useThemeStore.setState({
      mode: 'dark',
      seedColor: { l: 0.1, c: 0.1, h: 10 },
      presetName: null,
      hydrated: true,
    });

    useThemeStore.getState().resetTheme();
    const state = useThemeStore.getState();
    expect(state.mode).toBe('system');
    expect(state.presetName).toBe('ocean-blue');
    expect(state.hydrated).toBe(true);
    expect(storageMocks.saveThemeConfigToServer).toHaveBeenCalled();
  });

  it('hydrateFromLocal marks hydrated when persist already hydrated', async () => {
    const hasHydrated = vi.spyOn(useThemeStore.persist, 'hasHydrated').mockReturnValue(true);
    const rehydrate = vi.spyOn(useThemeStore.persist, 'rehydrate').mockResolvedValue(undefined);

    useThemeStore.getState().hydrateFromLocal();
    expect(useThemeStore.getState().hydrated).toBe(true);
    expect(rehydrate).not.toHaveBeenCalled();
    hasHydrated.mockRestore();
    rehydrate.mockRestore();
  });

  it('hydrateFromLocal rehydrates when not yet hydrated', () => {
    const hasHydrated = vi.spyOn(useThemeStore.persist, 'hasHydrated').mockReturnValue(false);
    const rehydrate = vi.spyOn(useThemeStore.persist, 'rehydrate').mockResolvedValue(undefined);

    useThemeStore.setState({ hydrated: false });
    useThemeStore.getState().hydrateFromLocal();
    expect(rehydrate).toHaveBeenCalled();
    hasHydrated.mockRestore();
    rehydrate.mockRestore();
  });

  it('hydrateFromLocal applies newer server snapshot', async () => {
    const hasHydrated = vi.spyOn(useThemeStore.persist, 'hasHydrated').mockReturnValue(true);
    storageMocks.fetchThemeConfigFromServer.mockResolvedValue({
      config: {
        mode: 'light',
        seedColor: { l: 0.7, c: 0.1, h: 155 },
        presetName: 'emerald',
      },
      updatedAt: '2025-01-01T00:00:00.000Z',
    });
    storageMocks.isServerSnapshotNewer.mockReturnValue(true);
    storageMocks.loadLocalThemeSnapshot.mockReturnValue({
      config: { mode: 'dark', seedColor: { l: 0.5, c: 0.1, h: 1 }, presetName: null },
      updatedAt: '2020-01-01T00:00:00.000Z',
    });

    useThemeStore.getState().hydrateFromLocal();
    await vi.waitFor(() => {
      expect(useThemeStore.getState().mode).toBe('light');
    });
    expect(useThemeStore.getState().presetName).toBe('emerald');
    expect(useThemeStore.getState().hydrated).toBe(true);
    hasHydrated.mockRestore();
  });

  it('hydrateFromLocal ignores older or missing server snapshot', async () => {
    const hasHydrated = vi.spyOn(useThemeStore.persist, 'hasHydrated').mockReturnValue(true);
    storageMocks.fetchThemeConfigFromServer.mockResolvedValue({
      config: {
        mode: 'dark',
        seedColor: { l: 0.2, c: 0.1, h: 10 },
        presetName: null,
      },
      updatedAt: '2020-01-01T00:00:00.000Z',
    });
    storageMocks.isServerSnapshotNewer.mockReturnValue(false);

    useThemeStore.setState({ mode: 'system', hydrated: true });
    useThemeStore.getState().hydrateFromLocal();
    await Promise.resolve();
    expect(useThemeStore.getState().mode).toBe('system');

    storageMocks.fetchThemeConfigFromServer.mockResolvedValue(null);
    useThemeStore.getState().hydrateFromLocal();
    await Promise.resolve();
    expect(useThemeStore.getState().mode).toBe('system');
    hasHydrated.mockRestore();
  });

  it('themeSelectors return corresponding slices and actions', () => {
    const state = useThemeStore.getState();
    expect(themeSelectors.mode(state)).toBe(state.mode);
    expect(themeSelectors.seedColor(state)).toBe(state.seedColor);
    expect(themeSelectors.presetName(state)).toBe(state.presetName);
    expect(themeSelectors.palette(state)).toBe(state.palette);
    expect(themeSelectors.hydrated(state)).toBe(state.hydrated);
    expect(themeSelectors.setMode(state)).toBe(state.setMode);
    expect(themeSelectors.setSeedColor(state)).toBe(state.setSeedColor);
    expect(themeSelectors.setPreset(state)).toBe(state.setPreset);
    expect(themeSelectors.hydrateFromLocal(state)).toBe(state.hydrateFromLocal);
    expect(themeSelectors.resetTheme(state)).toBe(state.resetTheme);
  });
});
