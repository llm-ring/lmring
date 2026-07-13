import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const themeMocks = vi.hoisted(() => ({
  mode: 'system' as 'light' | 'dark' | 'system',
  seedColor: { l: 0.55, c: 0.18, h: 255 },
  presetName: 'ocean-blue' as string | null,
  setMode: vi.fn(),
  setSeedColor: vi.fn(),
  setPreset: vi.fn(),
  resetTheme: vi.fn(),
}));

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/stores/theme-store', () => ({
  useThemeStore: (selector: (state: typeof themeMocks) => unknown) => selector(themeMocks),
  themeSelectors: {
    mode: (s: typeof themeMocks) => s.mode,
    seedColor: (s: typeof themeMocks) => s.seedColor,
    presetName: (s: typeof themeMocks) => s.presetName,
    setMode: (s: typeof themeMocks) => s.setMode,
    setSeedColor: (s: typeof themeMocks) => s.setSeedColor,
    setPreset: (s: typeof themeMocks) => s.setPreset,
    resetTheme: (s: typeof themeMocks) => s.resetTheme,
  },
}));

import { ThemeCustomizer } from './theme-customizer';

describe('ThemeCustomizer', () => {
  beforeEach(() => {
    themeMocks.mode = 'system';
    themeMocks.seedColor = { l: 0.55, c: 0.18, h: 255 };
    themeMocks.presetName = 'ocean-blue';
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders mode controls and switches modes', () => {
    render(<ThemeCustomizer />);

    fireEvent.click(screen.getByRole('button', { name: 'Settings.theme_mode_light' }));
    expect(themeMocks.setMode).toHaveBeenCalledWith('light');

    fireEvent.click(screen.getByRole('button', { name: 'Settings.theme_mode_dark' }));
    expect(themeMocks.setMode).toHaveBeenCalledWith('dark');

    fireEvent.click(screen.getByRole('button', { name: 'Settings.theme_mode_system' }));
    expect(themeMocks.setMode).toHaveBeenCalledWith('system');
  });

  it('renders presets and applies a selected preset', () => {
    render(<ThemeCustomizer />);
    fireEvent.click(screen.getByText('Settings.theme_preset_violet'));
    expect(themeMocks.setPreset).toHaveBeenCalledWith('violet');
  });

  it('applies valid hex colors from text input and color picker', () => {
    render(<ThemeCustomizer />);

    const hexInput = screen.getByPlaceholderText('#3b82f6');
    fireEvent.change(hexInput, { target: { value: 'ff0000' } });
    fireEvent.blur(hexInput);
    expect(themeMocks.setSeedColor).toHaveBeenCalledWith({ l: 0.5, c: 0.15, h: 240 });

    fireEvent.change(hexInput, { target: { value: '#00ff00' } });
    fireEvent.keyDown(hexInput, { key: 'Enter' });
    expect(themeMocks.setSeedColor).toHaveBeenCalledTimes(2);

    fireEvent.change(hexInput, { target: { value: 'not-a-color' } });
    fireEvent.blur(hexInput);
    expect(themeMocks.setSeedColor).toHaveBeenCalledTimes(2);

    const colorPicker = screen.getByLabelText('Settings.theme_custom_color');
    fireEvent.change(colorPicker, { target: { value: '#abcdef' } });
    expect(themeMocks.setSeedColor).toHaveBeenCalledTimes(3);
  });

  it('resets theme and shows preview section', () => {
    render(<ThemeCustomizer />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings.theme_reset' }));
    expect(themeMocks.resetTheme).toHaveBeenCalled();
    expect(screen.getByText('Settings.theme_preview_title')).toBeInTheDocument();
    expect(screen.getByText('Settings.theme_preview_button_primary')).toBeInTheDocument();
  });
});
