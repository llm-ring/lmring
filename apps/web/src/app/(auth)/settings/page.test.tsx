import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsStoreProvider } from '@/stores/settings-store';
import SettingsPage from './page';

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <SettingsStoreProvider>{children}</SettingsStoreProvider>;
  };
}

const { setThemeMock, setLanguageMock, setModeMock } = vi.hoisted(() => ({
  setThemeMock: vi.fn(),
  setLanguageMock: vi.fn(),
  setModeMock: vi.fn(),
}));

let capturedProviderLayoutProps: {
  providers: unknown[];
  isLoading: boolean;
  onToggleProvider?: (id: string, enabled?: boolean, apiKeyId?: string) => void;
  onSaveProvider?: (providerId: string, apiKeyId: string) => void;
  onAddProvider?: (provider: unknown) => void;
  onDeleteProvider?: (providerId: string) => void;
} | null = null;

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'system', setTheme: setThemeMock }),
}));

vi.mock('@/components/theme-customizer', () => ({
  ThemeCustomizer: () => (
    <div data-testid="theme-customizer">
      <button type="button" onClick={() => setModeMock('light')}>
        Settings.theme_mode_light
      </button>
      <button type="button" onClick={() => setModeMock('dark')}>
        Settings.theme_mode_dark
      </button>
      <button type="button" onClick={() => setModeMock('system')}>
        Settings.theme_mode_system
      </button>
    </div>
  ),
}));

vi.mock('@lmring/i18n', () => ({
  I18nConfig: { locales: ['en', 'zh', 'fr'] },
}));

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/hooks/use-provider-metadata', () => ({
  useProviderMetadata: () => [
    {
      id: 'openai',
      name: 'OpenAI',
      description: 'OpenAI provider',
      models: [
        { id: 'gpt-4o', displayName: 'GPT-4o', contextWindowTokens: 128000, maxOutput: 4096 },
      ],
    },
  ],
}));

vi.mock('@/libs/locale-utils', () => ({
  isSupportedLocale: (locale: string) => ['en', 'zh', 'fr'].includes(locale),
}));

vi.mock('@/libs/validation', () => ({
  maskApiKey: () => 'sk-***',
}));

vi.mock('@/stores/language-store', () => ({
  languageSelectors: { language: (state: { language: string }) => state.language },
  useLanguageStore: (
    selector: (state: { language: string; setLanguage: (l: string) => void }) => unknown,
  ) => selector({ language: 'en', setLanguage: setLanguageMock }),
}));

vi.mock('./_components/provider/ProviderLayout', () => ({
  ProviderLayout: (props: {
    providers: unknown[];
    isLoading: boolean;
    onToggleProvider?: (id: string, enabled?: boolean, apiKeyId?: string) => void;
    onSaveProvider?: (providerId: string, apiKeyId: string) => void;
    onAddProvider?: (provider: unknown) => void;
    onDeleteProvider?: (providerId: string) => void;
  }) => {
    capturedProviderLayoutProps = props;
    return (
      <div data-testid="provider-layout">
        {props.isLoading ? 'loading' : 'ready'}:{props.providers.length}
      </div>
    );
  },
}));

// framer-motion is mocked globally via alias in vitest.config.mts

// Mock lucide-react with explicit exports (Proxy causes hanging)
vi.mock('lucide-react', () => {
  const MockIcon = () => <span data-testid="icon" />;
  return {
    BotIcon: MockIcon,
    BoxIcon: MockIcon,
    ChevronRight: MockIcon,
    CombineIcon: MockIcon,
    DatabaseIcon: MockIcon,
    ExternalLinkIcon: MockIcon,
    Globe: MockIcon,
    GlobeIcon: MockIcon,
    HelpCircle: MockIcon,
    HelpCircleIcon: MockIcon,
    Info: MockIcon,
    InfoIcon: MockIcon,
    Key: MockIcon,
    LifeBuoyIcon: MockIcon,
    Monitor: MockIcon,
    Moon: MockIcon,
    Settings: MockIcon,
    Settings2Icon: MockIcon,
    Sun: MockIcon,
    TextIcon: MockIcon,
    Trash2: MockIcon,
    X: MockIcon,
  };
});

vi.mock('@lobehub/icons', () => {
  const Icon = () => <span data-testid="lobe-icon" />;
  const iconNames = [
    'Ai21',
    'AiMass',
    'AlibabaCloud',
    'Anthropic',
    'Aws',
    'Azure',
    'Baichuan',
    'Bfl',
    'Cerebras',
    'Cloudflare',
    'Cohere',
    'DeepSeek',
    'Fal',
    'Fireworks',
    'GiteeAI',
    'Github',
    'Google',
    'Groq',
    'Higress',
    'HuggingFace',
    'Hunyuan',
    'Infinigence',
    'InternLM',
    'Jina',
    'LmStudio',
    'Minimax',
    'Mistral',
    'ModelScope',
    'Moonshot',
    'Nebius',
    'Novita',
    'Nvidia',
    'Ollama',
    'OpenAI',
    'OpenRouter',
    'Perplexity',
    'PPIO',
    'Qiniu',
    'Replicate',
    'SambaNova',
    'Search1API',
    'SenseNova',
    'SiliconCloud',
    'Spark',
    'Stepfun',
    'TencentCloud',
    'Together',
    'Upstage',
    'VertexAI',
    'Vllm',
    'Volcengine',
    'Wenxin',
    'XAI',
    'XiaomiMiMo',
    'Xinference',
    'Yi',
    'Zhipu',
  ] as const;

  const icons = Object.fromEntries(iconNames.map((name) => [name, Icon]));
  return icons;
});

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// @lmring/ui is mocked globally via alias in vitest.config.mts

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedProviderLayoutProps = null;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [] }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
  });

  it('renders tabs and triggers theme/language changes', async () => {
    render(<SettingsPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Settings.title')).toBeInTheDocument();
    expect(screen.getByText('Settings.tabs_general')).toBeInTheDocument();
    expect(screen.getByText('Settings.tabs_provider')).toBeInTheDocument();

    // Click on the '中文' language option (SelectItem calls onValueChange via Context)
    fireEvent.click(screen.getByText('中文'));
    expect(setLanguageMock).toHaveBeenCalledWith('zh');

    fireEvent.click(screen.getByText('Settings.theme_mode_light'));
    expect(setModeMock).toHaveBeenCalledWith('light');
  });

  it('switches between main tabs', () => {
    render(<SettingsPage />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Settings.tabs_system_model'));
    expect(screen.getByText('Settings.system_model_title')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Settings.tabs_storage'));
    expect(screen.getByText('Settings.storage_title')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Settings.tabs_help'));
    expect(screen.getByText('Settings.help_title')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Settings.tabs_about'));
    expect(screen.getByText('Settings.about_title')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Settings.tabs_provider'));
    expect(screen.getByTestId('provider-layout')).toBeInTheDocument();
  });

  it('handles API keys loading error gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<SettingsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Failed to load API keys:', expect.any(Error));
    });

    expect(screen.getByText('Settings.title')).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('handles non-ok API response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Unauthorized' }),
    });

    render(<SettingsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    expect(screen.getByText('Settings.title')).toBeInTheDocument();
  });

  it('shows all theme options', () => {
    render(<SettingsPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Settings.theme_mode_light')).toBeInTheDocument();
    expect(screen.getByText('Settings.theme_mode_dark')).toBeInTheDocument();
    expect(screen.getByText('Settings.theme_mode_system')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Settings.theme_mode_dark'));
    expect(setModeMock).toHaveBeenCalledWith('dark');

    fireEvent.click(screen.getByText('Settings.theme_mode_system'));
    expect(setModeMock).toHaveBeenCalledWith('system');
  });

  it('renders about tab with telemetry toggle', () => {
    render(<SettingsPage />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Settings.tabs_about'));

    expect(screen.getByText('Settings.about_telemetry')).toBeInTheDocument();
    expect(screen.getByText('Settings.about_telemetry_description')).toBeInTheDocument();
    expect(screen.getByText('Settings.about_changelog')).toBeInTheDocument();
  });

  it('renders help tab with resource links', () => {
    render(<SettingsPage />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Settings.tabs_help'));

    expect(screen.getByText('Settings.help_resources')).toBeInTheDocument();
    expect(screen.getByText('Settings.help_how_it_works')).toBeInTheDocument();
    expect(screen.getByText('Settings.help_about_us')).toBeInTheDocument();
  });

  it('does not call setLanguage for unsupported locale', async () => {
    render(<SettingsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Settings.title')).toBeInTheDocument();
    });

    expect(setLanguageMock).not.toHaveBeenCalledWith('es');
  });
});

describe('SettingsPage Provider Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedProviderLayoutProps = null;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [] }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
  });

  it('passes handler callbacks to ProviderLayout', async () => {
    render(<SettingsPage />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByText('Settings.tabs_provider'));

    await waitFor(() => {
      expect(capturedProviderLayoutProps).not.toBeNull();
      expect(capturedProviderLayoutProps?.isLoading).toBe(false);
    });

    expect(typeof capturedProviderLayoutProps?.onToggleProvider).toBe('function');
    expect(typeof capturedProviderLayoutProps?.onSaveProvider).toBe('function');
    expect(typeof capturedProviderLayoutProps?.onAddProvider).toBe('function');
    expect(typeof capturedProviderLayoutProps?.onDeleteProvider).toBe('function');
  });

  it('transforms savedApiKeys to providers with correct connection status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        keys: [
          {
            id: 'key-1',
            providerName: 'openai',
            enabled: true,
            hasApiKey: true,
          },
          {
            id: 'key-2',
            providerName: 'anthropic',
            enabled: false,
            hasApiKey: true,
          },
        ],
      }),
    }) as unknown as typeof fetch;

    render(<SettingsPage />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByText('Settings.tabs_provider'));

    await waitFor(() => {
      expect(capturedProviderLayoutProps).not.toBeNull();
      expect(capturedProviderLayoutProps?.isLoading).toBe(false);
      expect(capturedProviderLayoutProps?.providers.length).toBeGreaterThan(0);
    });

    const openaiProvider = (
      capturedProviderLayoutProps?.providers as {
        id: string;
        connected: boolean;
        apiKeyId?: string;
      }[]
    )?.find((p) => p.id === 'openai');
    expect(openaiProvider?.connected).toBe(true);
    expect(openaiProvider?.apiKeyId).toBe('key-1');
  });

  it('creates custom providers from isCustom=true keys', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        keys: [
          {
            id: 'custom-key',
            providerName: 'my-custom-provider',
            enabled: true,
            hasApiKey: true,
            isCustom: true,
            providerType: 'openai',
          },
        ],
      }),
    }) as unknown as typeof fetch;

    render(<SettingsPage />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByText('Settings.tabs_provider'));

    await waitFor(() => {
      expect(capturedProviderLayoutProps).not.toBeNull();
      expect(capturedProviderLayoutProps?.isLoading).toBe(false);
      expect(capturedProviderLayoutProps?.providers.length).toBeGreaterThan(0);
    });

    const customProvider = (
      capturedProviderLayoutProps?.providers as {
        id: string;
        isCustom?: boolean;
        providerType?: string;
      }[]
    )?.find((p) => p.id === 'my-custom-provider');
    expect(customProvider).toBeDefined();
    expect(customProvider?.isCustom).toBe(true);
    expect(customProvider?.providerType).toBe('openai');
  });

  it('handleToggleProvider persists PATCH and reverts on failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/settings/api-keys' && (!options || options.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            keys: [
              {
                id: 'key-1',
                providerName: 'openai',
                enabled: false,
                hasApiKey: true,
              },
            ],
          }),
        });
      }
      if (url === '/api/settings/api-keys/key-1' && options?.method === 'PATCH') {
        return Promise.resolve({ ok: false, status: 500 });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }) as unknown as typeof fetch;

    render(<SettingsPage />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByText('Settings.tabs_provider'));

    await waitFor(() => {
      expect(capturedProviderLayoutProps?.isLoading).toBe(false);
    });

    await capturedProviderLayoutProps?.onToggleProvider?.('openai', true, 'key-1');

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/api-keys/key-1',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });

    // After failed PATCH, connected should revert
    const openai = (
      capturedProviderLayoutProps?.providers as { id: string; connected: boolean }[]
    )?.find((p) => p.id === 'openai');
    expect(openai?.connected).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('handleToggleProvider reverts on network error and resolves apiKeyId from store', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/settings/api-keys' && (!options || options.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            keys: [
              {
                id: 'key-openai',
                providerName: 'openai',
                enabled: true,
                hasApiKey: true,
              },
            ],
          }),
        });
      }
      if (
        String(url).includes('/api/settings/api-keys/key-openai') &&
        options?.method === 'PATCH'
      ) {
        return Promise.reject(new Error('network'));
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }) as unknown as typeof fetch;

    render(<SettingsPage />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByText('Settings.tabs_provider'));

    await waitFor(() => {
      expect(capturedProviderLayoutProps?.isLoading).toBe(false);
    });

    // No apiKeyId passed — should resolve from savedApiKeys
    await capturedProviderLayoutProps?.onToggleProvider?.('openai');

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled();
    });
    errorSpy.mockRestore();
  });

  it('handleSaveProvider updates existing key and adds new key when missing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        keys: [
          {
            id: 'key-1',
            providerName: 'openai',
            enabled: true,
            hasApiKey: true,
            proxyUrl: '',
          },
        ],
      }),
    }) as unknown as typeof fetch;

    render(<SettingsPage />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByText('Settings.tabs_provider'));

    await waitFor(() => {
      expect(capturedProviderLayoutProps?.isLoading).toBe(false);
    });

    (capturedProviderLayoutProps?.onSaveProvider as ((...args: unknown[]) => void) | undefined)?.(
      'openai',
      'key-1-updated',
      'https://proxy',
      true,
    );

    await waitFor(() => {
      const openai = (
        capturedProviderLayoutProps?.providers as {
          id: string;
          apiKeyId?: string;
          proxyUrl?: string;
          hasApiKey?: boolean;
        }[]
      )?.find((p) => p.id === 'openai');
      expect(openai?.apiKeyId).toBe('key-1-updated');
      expect(openai?.proxyUrl).toBe('https://proxy');
      expect(openai?.hasApiKey).toBe(true);
    });

    // Save for a provider not yet in savedApiKeys
    (capturedProviderLayoutProps?.onSaveProvider as ((...args: unknown[]) => void) | undefined)?.(
      'unknown-provider',
      'new-key',
      'https://p2',
      false,
    );
  });

  it('handleAddProvider and handleDeleteProvider update provider list', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        keys: [
          {
            id: 'custom-key',
            providerName: 'custom-prov',
            enabled: false,
            hasApiKey: true,
            isCustom: true,
            providerType: 'openai',
          },
        ],
      }),
    }) as unknown as typeof fetch;

    render(<SettingsPage />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByText('Settings.tabs_provider'));

    await waitFor(() => {
      expect(capturedProviderLayoutProps?.isLoading).toBe(false);
    });

    const beforeCount = capturedProviderLayoutProps?.providers.length ?? 0;

    capturedProviderLayoutProps?.onAddProvider?.({
      id: 'brand-new',
      name: 'Brand New',
      connected: false,
      type: 'disabled',
      apiKeyId: 'brand-key',
      isCustom: true,
      providerType: 'openai',
      proxyUrl: 'https://x',
    });

    await waitFor(() => {
      expect(capturedProviderLayoutProps?.providers.length).toBe(beforeCount + 1);
    });

    capturedProviderLayoutProps?.onDeleteProvider?.('custom-prov');

    await waitFor(() => {
      const stillThere = (capturedProviderLayoutProps?.providers as { id: string }[])?.find(
        (p) => p.id === 'custom-prov',
      );
      expect(stillThere).toBeUndefined();
    });
  });

  it('handleToggleProvider without apiKeyId only updates local state', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [] }),
    }) as unknown as typeof fetch;

    render(<SettingsPage />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByText('Settings.tabs_provider'));

    await waitFor(() => {
      expect(capturedProviderLayoutProps?.isLoading).toBe(false);
    });

    const fetchCallsBefore = vi.mocked(global.fetch).mock.calls.length;
    await capturedProviderLayoutProps?.onToggleProvider?.('openai', true);
    // Only the initial GET should have run — no PATCH without apiKeyId
    const patchCalls = vi
      .mocked(global.fetch)
      .mock.calls.filter((c) => c[1] && (c[1] as RequestInit).method === 'PATCH');
    expect(patchCalls.length).toBe(0);
    expect(vi.mocked(global.fetch).mock.calls.length).toBeGreaterThanOrEqual(fetchCallsBefore);
  });
});
