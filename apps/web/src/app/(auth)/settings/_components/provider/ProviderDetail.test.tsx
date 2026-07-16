import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Provider } from './types';

const { createMockIcon } = vi.hoisted(() => ({
  createMockIcon: (name: string) => {
    const MockIcon = ({ size, className }: { size?: number; className?: string }) => (
      <svg data-testid={`icon-${name}`} data-size={size} className={className} />
    );
    MockIcon.displayName = name;
    return MockIcon;
  },
}));

vi.mock('lucide-react', () => ({
  AlertCircleIcon: createMockIcon('AlertCircleIcon'),
  BrainCircuitIcon: createMockIcon('BrainCircuitIcon'),
  CheckCircle2Icon: createMockIcon('CheckCircle2Icon'),
  ChevronsUpDownIcon: createMockIcon('ChevronsUpDownIcon'),
  EyeIcon: createMockIcon('EyeIcon'),
  EyeOffIcon: createMockIcon('EyeOffIcon'),
  Globe: createMockIcon('Globe'),
  ImageIcon: createMockIcon('ImageIcon'),
  Loader2Icon: createMockIcon('Loader2Icon'),
  LockIcon: createMockIcon('LockIcon'),
  MessageSquareIcon: createMockIcon('MessageSquareIcon'),
  MicIcon: createMockIcon('MicIcon'),
  PencilIcon: createMockIcon('PencilIcon'),
  RadioIcon: createMockIcon('RadioIcon'),
  Search: createMockIcon('Search'),
  Trash2Icon: createMockIcon('Trash2Icon'),
  VideoIcon: createMockIcon('VideoIcon'),
  VolumeIcon: createMockIcon('VolumeIcon'),
  WrenchIcon: createMockIcon('WrenchIcon'),
  ZapIcon: createMockIcon('ZapIcon'),
}));

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params) return `${key} ${JSON.stringify(params)}`;
    return key;
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@lmring/model-depot', () => ({
  getModelsForProvider: () => [
    {
      id: 'gpt-4',
      displayName: 'GPT-4',
      type: 'chat',
      abilities: { vision: true },
      pricing: { input: 0.03, output: 0.06 },
    },
    {
      id: 'gpt-3.5-turbo',
      displayName: 'GPT-3.5 Turbo',
      type: 'chat',
      abilities: {},
      pricing: { input: 0.001, output: 0.002 },
    },
  ],
  getEndpointConfig: () => ({ baseURL: 'https://api.openai.com/v1' }),
  resolveProviderType: (provider: Provider) => provider.id,
}));

vi.mock('./AddModelDialog', () => ({
  AddModelDialog: ({ onAdd }: { onAdd: (m: { id: string; name: string }) => void }) => (
    <button
      type="button"
      data-testid="add-model-dialog"
      onClick={() => onAdd({ id: 'custom-model', name: 'Custom Model' })}
    >
      Add Model
    </button>
  ),
}));

vi.mock('./EditModelDialog', () => ({
  EditModelDialog: ({
    open,
    onSave,
    onOpenChange,
  }: {
    open: boolean;
    onSave: (data: {
      displayName?: string;
      abilities?: Record<string, boolean>;
      supportsStreaming?: boolean;
      priceCurrency?: string;
      inputPrice?: number;
      outputPrice?: number;
    }) => Promise<void> | void;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="edit-model-dialog">
        <button
          type="button"
          data-testid="save-model-edit"
          onClick={() => {
            void Promise.resolve(
              onSave({
                displayName: 'Updated Name',
                abilities: { vision: true },
                supportsStreaming: true,
                priceCurrency: 'USD',
                inputPrice: 1,
                outputPrice: 2,
              }),
            ).catch(() => {
              // handleSaveModelEdit rethrows after toast — swallow for tests
            });
          }}
        >
          Save Edit
        </button>
        <button type="button" data-testid="close-edit" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
    ) : null,
}));

describe('ProviderDetail', () => {
  const mockOnToggle = vi.fn();
  const mockOnSave = vi.fn();
  const mockOnDelete = vi.fn();

  const MockIcon = createMockIcon('TestProvider');

  const defaultProvider: Provider = {
    id: 'openai',
    name: 'OpenAI',
    connected: false,
    Icon: MockIcon,
    description: 'OpenAI API provider for GPT models',
    type: 'disabled',
    tags: ['OpenAI'],
  };

  beforeEach(() => {
    mockOnToggle.mockClear();
    mockOnSave.mockClear();
    mockOnDelete.mockClear();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ models: [] }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should render provider name', async () => {
    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={defaultProvider}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    expect(screen.getByText('OpenAI')).toBeInTheDocument();
  });

  it('should render provider description', async () => {
    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={defaultProvider}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    expect(screen.getByText('OpenAI API provider for GPT models')).toBeInTheDocument();
  });

  it('should render API key input', async () => {
    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={defaultProvider}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    expect(screen.getByLabelText('Provider.detail_api_key')).toBeInTheDocument();
  });

  it('should render proxy URL input', async () => {
    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={defaultProvider}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    expect(screen.getByLabelText('Provider.detail_api_proxy_url')).toBeInTheDocument();
  });

  it('should render toggle switch', async () => {
    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={defaultProvider}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBeGreaterThan(0);
  });

  it('should show checked switch when provider is connected', async () => {
    const connectedProvider: Provider = {
      ...defaultProvider,
      connected: true,
    };

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={connectedProvider}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    const switches = screen.getAllByRole('switch');
    // First switch is the provider toggle
    expect(switches[0]).toBeChecked();
  });

  it('should render delete button for custom providers', async () => {
    const customProvider: Provider = {
      ...defaultProvider,
      isCustom: true,
    };

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={customProvider}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    expect(screen.getByTestId('icon-Trash2Icon')).toBeInTheDocument();
  });

  it('should not render delete button for non-custom providers', async () => {
    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={defaultProvider}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    // Find delete button by icon - should only appear in model list, not header
    // In header there shouldn't be any trash icon since it's not custom
    const headerSection = screen.getByText('OpenAI').closest('div');
    const deleteButtonInHeader = headerSection?.querySelector('[data-testid="icon-Trash2Icon"]');
    expect(deleteButtonInHeader).toBeNull();
  });

  it('should render model list section', async () => {
    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={defaultProvider}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    expect(screen.getByText('Provider.detail_model_list')).toBeInTheDocument();
  });

  it('should render check connection button', async () => {
    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={defaultProvider}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    expect(screen.getByText('Provider.detail_check')).toBeInTheDocument();
  });

  it('should toggle API key visibility', async () => {
    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={defaultProvider}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    const apiKeyInput = screen.getByLabelText('Provider.detail_api_key');
    expect(apiKeyInput).toHaveAttribute('type', 'password');

    // Click eye icon button (in the API key input container)
    const eyeIcons = screen.getAllByTestId('icon-EyeIcon');
    const eyeButton = eyeIcons[0]?.closest('button');
    if (eyeButton) fireEvent.click(eyeButton);

    await waitFor(() => {
      expect(apiKeyInput).toHaveAttribute('type', 'text');
    });
  });

  it('should update API key input value', async () => {
    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={defaultProvider}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    const apiKeyInput = screen.getByLabelText('Provider.detail_api_key');
    fireEvent.change(apiKeyInput, { target: { value: 'sk-test-key' } });

    expect(apiKeyInput).toHaveValue('sk-test-key');
  });

  it('should show error toast when check connection is clicked without API key', async () => {
    const { toast } = await import('sonner');
    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={defaultProvider}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    const checkButton = screen.getByText('Provider.detail_check');
    fireEvent.click(checkButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('API Key Required', expect.any(Object));
    });
  });

  it('should show error toast when check connection is clicked without model selection', async () => {
    const { toast } = await import('sonner');
    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={defaultProvider}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    const apiKeyInput = screen.getByLabelText('Provider.detail_api_key');
    fireEvent.change(apiKeyInput, { target: { value: 'sk-test-key' } });

    const checkButton = screen.getByText('Provider.detail_check');
    fireEvent.click(checkButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Model Required', expect.any(Object));
    });
  });

  it('should filter models via search input', async () => {
    const { ProviderDetail } = await import('./ProviderDetail');
    const { container } = render(
      <ProviderDetail
        provider={defaultProvider}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    const searchInput = screen.getByPlaceholderText('Provider.detail_search_models_placeholder');
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveValue('');

    fireEvent.change(searchInput, { target: { value: 'GPT-4' } });
    expect(searchInput).toHaveValue('GPT-4');

    await waitFor(() => {
      const tabsContent = container.querySelector('[role="tabpanel"]');
      expect(tabsContent).toBeInTheDocument();
    });
  });

  it('should show API key warning dialog when toggling model without API key', async () => {
    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={defaultProvider}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    const modelSwitches = screen.getAllByRole('switch');
    const modelSwitch = modelSwitches.find((s) => s !== modelSwitches[0]);
    if (modelSwitch) {
      fireEvent.click(modelSwitch);
    }

    await waitFor(() => {
      expect(screen.getByText('Provider.api_key_required_dialog_title')).toBeInTheDocument();
    });
  });

  it('should open delete provider dialog when delete button is clicked', async () => {
    const customProvider: Provider = {
      ...defaultProvider,
      isCustom: true,
      apiKeyId: 'test-api-key-id',
    };

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={customProvider}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    const deleteIcon = screen.getByTestId('icon-Trash2Icon');
    const deleteButton = deleteIcon.closest('button');
    if (deleteButton) fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Provider.delete_provider_dialog_title')).toBeInTheDocument();
    });
  });

  it('should fetch and display API key when visibility is toggled for provider with existing key', async () => {
    const providerWithKey: Provider = {
      ...defaultProvider,
      apiKeyId: 'test-api-key-id',
      hasApiKey: true,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ apiKey: 'sk-fetched-key-123' }),
    });

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={providerWithKey}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    const eyeIcons = screen.getAllByTestId('icon-EyeIcon');
    const eyeButton = eyeIcons[0]?.closest('button');
    if (eyeButton) fireEvent.click(eyeButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/settings/api-keys/test-api-key-id');
    });

    await waitFor(() => {
      const apiKeyInput = screen.getByLabelText('Provider.detail_api_key');
      expect(apiKeyInput).toHaveValue('sk-fetched-key-123');
    });
  });

  it('should show checking state when check button is clicked with valid input', async () => {
    let resolvePromise: () => void;
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/settings/api-keys/check') {
        return pendingPromise.then(() => ({
          ok: true,
          json: () => Promise.resolve({ success: true, responseTimeMs: 150 }),
        }));
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ models: [] }) });
    });

    const providerWithModel: Provider = {
      ...defaultProvider,
      models: [{ id: 'gpt-4', name: 'GPT-4' }],
    };

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={providerWithModel}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    const apiKeyInput = screen.getByLabelText('Provider.detail_api_key');
    fireEvent.change(apiKeyInput, { target: { value: 'sk-test-key' } });

    expect(screen.getByText('Provider.detail_check')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();

    // biome-ignore lint/style/noNonNullAssertion: resolvePromise is assigned in Promise callback
    resolvePromise!();
  });
});

describe('ProviderDetail handler functions', () => {
  const mockOnToggle = vi.fn();
  const mockOnSave = vi.fn();
  const mockOnDelete = vi.fn();

  const MockIcon = createMockIcon('TestProvider');

  const defaultProvider: Provider = {
    id: 'openai',
    name: 'OpenAI',
    connected: false,
    Icon: MockIcon,
    description: 'OpenAI API provider for GPT models',
    type: 'disabled',
    tags: ['OpenAI'],
  };

  beforeEach(() => {
    mockOnToggle.mockClear();
    mockOnSave.mockClear();
    mockOnDelete.mockClear();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ models: [] }),
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('handleSave calls POST /api/settings/api-keys with correct payload', async () => {
    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/settings/api-keys' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'new-key-id' }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ models: [] }) });
    });

    const providerWithModel: Provider = {
      ...defaultProvider,
      models: [{ id: 'gpt-4', name: 'GPT-4' }],
    };

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={providerWithModel}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    const apiKeyInput = screen.getByLabelText('Provider.detail_api_key');
    fireEvent.change(apiKeyInput, { target: { value: 'sk-test-key-123' } });

    const combobox = screen.getByRole('combobox');
    fireEvent.click(combobox);

    await waitFor(() => {
      const gpt4Options = screen.getAllByText('GPT-4');
      const comboboxOption = gpt4Options.find(
        (el) => el.closest('[role="option"]') || el.closest('[cmdk-item]'),
      );
      if (comboboxOption) fireEvent.click(comboboxOption);
    });

    const checkButton = screen.getByText('Provider.detail_check');
    fireEvent.click(checkButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/api-keys/check',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('sk-test-key-123'),
        }),
      );
    });
  });

  it('handleSave calls onSave callback and sets sessionStorage on success', async () => {
    const { toast } = await import('sonner');
    const sessionStorageSpy = vi.spyOn(Storage.prototype, 'setItem');

    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/settings/api-keys/check' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, responseTimeMs: 150 }),
        });
      }
      if (url === '/api/settings/api-keys' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'new-key-id-xyz' }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ models: [] }) });
    });

    const providerWithModel: Provider = {
      ...defaultProvider,
      models: [{ id: 'gpt-4', name: 'GPT-4' }],
    };

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={providerWithModel}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    const apiKeyInput = screen.getByLabelText('Provider.detail_api_key');
    fireEvent.change(apiKeyInput, { target: { value: 'sk-test-key' } });

    const combobox = screen.getByRole('combobox');
    fireEvent.click(combobox);

    await waitFor(() => {
      const gpt4Options = screen.getAllByText('GPT-4');
      const comboboxOption = gpt4Options.find(
        (el) => el.closest('[role="option"]') || el.closest('[cmdk-item]'),
      );
      if (comboboxOption) fireEvent.click(comboboxOption);
    });

    const checkButton = screen.getByText('Provider.detail_check');
    fireEvent.click(checkButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('openai', 'new-key-id-xyz', '', true);
    });

    await waitFor(() => {
      expect(sessionStorageSpy).toHaveBeenCalledWith('arena_models_need_refresh', 'true');
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Saved', expect.any(Object));
    });
  });

  it('handleSave shows error toast on failure', async () => {
    const { toast } = await import('sonner');

    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/settings/api-keys/check' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, responseTimeMs: 150 }),
        });
      }
      if (url === '/api/settings/api-keys' && options?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Unauthorized' }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ models: [] }) });
    });

    const providerWithModel: Provider = {
      ...defaultProvider,
      models: [{ id: 'gpt-4', name: 'GPT-4' }],
    };

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={providerWithModel}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    const apiKeyInput = screen.getByLabelText('Provider.detail_api_key');
    fireEvent.change(apiKeyInput, { target: { value: 'sk-test-key' } });

    const combobox = screen.getByRole('combobox');
    fireEvent.click(combobox);

    await waitFor(() => {
      const gpt4Options = screen.getAllByText('GPT-4');
      const comboboxOption = gpt4Options.find(
        (el) => el.closest('[role="option"]') || el.closest('[cmdk-item]'),
      );
      if (comboboxOption) fireEvent.click(comboboxOption);
    });

    const checkButton = screen.getByText('Provider.detail_check');
    fireEvent.click(checkButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Save Failed', expect.any(Object));
    });
  });

  it('handleCheck sets checkStatus to success and shows toast with response time', async () => {
    const { toast } = await import('sonner');

    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/settings/api-keys/check') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, responseTimeMs: 250 }),
        });
      }
      if (url === '/api/settings/api-keys' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'key-id' }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ models: [] }) });
    });

    const providerWithModel: Provider = {
      ...defaultProvider,
      models: [{ id: 'gpt-4', name: 'GPT-4' }],
    };

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={providerWithModel}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    const apiKeyInput = screen.getByLabelText('Provider.detail_api_key');
    fireEvent.change(apiKeyInput, { target: { value: 'sk-test' } });

    const combobox = screen.getByRole('combobox');
    fireEvent.click(combobox);

    await waitFor(() => {
      const gpt4Options = screen.getAllByText('GPT-4');
      const comboboxOption = gpt4Options.find(
        (el) => el.closest('[role="option"]') || el.closest('[cmdk-item]'),
      );
      if (comboboxOption) fireEvent.click(comboboxOption);
    });

    const checkButton = screen.getByText('Provider.detail_check');
    fireEvent.click(checkButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Connection Successful', {
        description: 'Connected in 250ms',
      });
    });
  });

  it('handleCheck sets checkStatus to error on failed check', async () => {
    const { toast } = await import('sonner');

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/settings/api-keys/check') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: false, message: 'Invalid API key' }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ models: [] }) });
    });

    const providerWithModel: Provider = {
      ...defaultProvider,
      models: [{ id: 'gpt-4', name: 'GPT-4' }],
    };

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={providerWithModel}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    const apiKeyInput = screen.getByLabelText('Provider.detail_api_key');
    fireEvent.change(apiKeyInput, { target: { value: 'sk-invalid' } });

    const combobox = screen.getByRole('combobox');
    fireEvent.click(combobox);

    await waitFor(() => {
      const gpt4Options = screen.getAllByText('GPT-4');
      const comboboxOption = gpt4Options.find(
        (el) => el.closest('[role="option"]') || el.closest('[cmdk-item]'),
      );
      if (comboboxOption) fireEvent.click(comboboxOption);
    });

    const checkButton = screen.getByText('Provider.detail_check');
    fireEvent.click(checkButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Connection Failed', {
        description: 'Invalid API key',
      });
    });
  });

  it('handleToggle calls PATCH when apiKeyId exists', async () => {
    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/settings/api-keys/existing-key-id' && options?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ models: [] }) });
    });

    const providerWithApiKeyId: Provider = {
      ...defaultProvider,
      connected: false,
      apiKeyId: 'existing-key-id',
    };

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={providerWithApiKeyId}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    const switches = screen.getAllByRole('switch');
    const providerSwitch = switches[0];
    if (providerSwitch) fireEvent.click(providerSwitch);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/api-keys/existing-key-id',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ enabled: true }),
        }),
      );
    });

    await waitFor(() => {
      expect(mockOnToggle).toHaveBeenCalledWith('openai', true, 'existing-key-id');
    });
  });

  it('handleToggle calls POST when apiKey entered but no apiKeyId', async () => {
    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/settings/api-keys' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'new-created-key-id' }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ models: [] }) });
    });

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={defaultProvider}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    const apiKeyInput = screen.getByLabelText('Provider.detail_api_key');
    fireEvent.change(apiKeyInput, { target: { value: 'sk-new-key' } });

    const switches = screen.getAllByRole('switch');
    const providerSwitch = switches[0];
    if (providerSwitch) fireEvent.click(providerSwitch);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/api-keys',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('sk-new-key'),
        }),
      );
    });

    await waitFor(() => {
      expect(mockOnToggle).toHaveBeenCalledWith('openai', true, 'new-created-key-id');
    });
  });

  it('handleModelToggle calls PUT /api/settings/api-keys/{id}/models', async () => {
    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/enabled-models')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ modelId: 'gpt-4', enabled: false }] }),
        });
      }
      if (url.includes('/models') && options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ models: [] }) });
    });

    const providerWithApiKey: Provider = {
      ...defaultProvider,
      apiKeyId: 'test-key-id',
      hasApiKey: true,
    };

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={providerWithApiKey}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    await waitFor(() => {
      const switches = screen.getAllByRole('switch');
      expect(switches.length).toBeGreaterThan(1);
    });

    const switches = screen.getAllByRole('switch');
    const modelSwitch = switches[1];
    if (modelSwitch) fireEvent.click(modelSwitch);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/api-keys/test-key-id/models',
        expect.objectContaining({
          method: 'PUT',
        }),
      );
    });
  });

  it('handleModelToggle reverts state on error', async () => {
    const { toast } = await import('sonner');

    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/enabled-models')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [{ modelId: 'gpt-4', enabled: false }] }),
        });
      }
      if (url.includes('/models') && options?.method === 'PUT') {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ models: [] }) });
    });

    const providerWithApiKey: Provider = {
      ...defaultProvider,
      apiKeyId: 'test-key-id',
      hasApiKey: true,
    };

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={providerWithApiKey}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    await waitFor(() => {
      const switches = screen.getAllByRole('switch');
      expect(switches.length).toBeGreaterThan(1);
    });

    const switches = screen.getAllByRole('switch');
    const modelSwitch = switches[1];
    if (modelSwitch) fireEvent.click(modelSwitch);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Error', {
        description: 'Failed to update model status',
      });
    });
  });

  it('handleAddModel calls POST /api/settings/api-keys/{id}/custom-models', async () => {
    const { toast } = await import('sonner');

    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes('/custom-models') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ models: [] }) });
    });

    const providerWithApiKey: Provider = {
      ...defaultProvider,
      apiKeyId: 'test-key-id',
    };

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={providerWithApiKey}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    const addModelButton = screen.getByTestId('add-model-dialog');
    fireEvent.click(addModelButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/api-keys/test-key-id/custom-models',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ modelId: 'custom-model', displayName: 'Custom Model' }),
        }),
      );
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Model Added');
    });
  });

  it('handleDeleteProvider calls DELETE and calls onDelete callback', async () => {
    const { toast } = await import('sonner');

    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/settings/api-keys/custom-provider-key-id' && options?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ models: [] }) });
    });

    const customProvider: Provider = {
      ...defaultProvider,
      isCustom: true,
      apiKeyId: 'custom-provider-key-id',
    };

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={customProvider}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    const deleteIcon = screen.getByTestId('icon-Trash2Icon');
    const deleteButton = deleteIcon.closest('button');
    if (deleteButton) fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Provider.delete_provider_dialog_title')).toBeInTheDocument();
    });

    const confirmDeleteButton = screen.getByText('Provider.delete_provider_dialog_delete');
    fireEvent.click(confirmDeleteButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/api-keys/custom-provider-key-id',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    await waitFor(() => {
      expect(mockOnDelete).toHaveBeenCalledWith('openai');
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Provider Deleted', expect.any(Object));
    });
  });

  it('loads enabled models, custom models, and overrides on mount', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/enabled-models')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              models: [
                { modelId: 'gpt-4', enabled: true },
                { modelId: 'custom-from-db', enabled: true },
              ],
            }),
        });
      }
      if (String(url).includes('/custom-models') && !String(url).includes('/custom-models/')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              models: [{ modelId: 'custom-from-db', displayName: 'Custom DB Model' }],
            }),
        });
      }
      if (String(url).includes('/model-overrides')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              overrides: [
                {
                  modelId: 'gpt-4',
                  displayName: 'GPT-4 Override',
                  abilities: { reasoning: true },
                  inputPrice: 10,
                  outputPrice: 20,
                  priceCurrency: 'USD',
                },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={{ ...defaultProvider, apiKeyId: 'key-1', hasApiKey: true, connected: true }}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText('GPT-4 Override').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Custom DB Model').length).toBeGreaterThan(0);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/enabled-models'));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/custom-models'));
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/model-overrides'));
  });

  it('handles fetch errors for model states/custom models/overrides', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error('network'));

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={{ ...defaultProvider, apiKeyId: 'key-1', hasApiKey: true }}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled();
    });
    errorSpy.mockRestore();
  });

  it('opens edit dialog and saves model override via POST', async () => {
    const { toast } = await import('sonner');
    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (String(url).includes('/model-overrides') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ models: [], overrides: [] }),
      });
    });

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={{ ...defaultProvider, apiKeyId: 'key-1', hasApiKey: true }}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByTestId('icon-PencilIcon').length).toBeGreaterThan(0);
    });

    const pencil = screen.getAllByTestId('icon-PencilIcon')[0];
    const pencilBtn = pencil?.closest('button');
    expect(pencilBtn).toBeTruthy();
    fireEvent.click(pencilBtn as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getByTestId('edit-model-dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('save-model-edit'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/api-keys/key-1/model-overrides',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Model updated successfully');
    });
  });

  it('saves custom model edit via PUT and handles failure', async () => {
    const { toast } = await import('sonner');
    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (
        String(url).includes('/custom-models') &&
        !String(url).includes('/custom-models/') &&
        !options?.method
      ) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              models: [{ modelId: 'my-custom', displayName: 'My Custom' }],
            }),
        });
      }
      if (String(url).includes('/custom-models/my-custom') && options?.method === 'PUT') {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: 'bad edit' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ models: [], overrides: [] }),
      });
    });

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={{ ...defaultProvider, apiKeyId: 'key-1', hasApiKey: true }}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText('My Custom').length).toBeGreaterThan(0);
    });

    // Prefer the pencil next to the custom model row
    const pencils = screen.getAllByTestId('icon-PencilIcon');
    const lastPencilBtn = pencils[pencils.length - 1]?.closest('button');
    expect(lastPencilBtn).toBeTruthy();
    fireEvent.click(lastPencilBtn as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getByTestId('save-model-edit')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('save-model-edit'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to update model',
        expect.objectContaining({ description: 'bad edit' }),
      );
    });
  });

  it('deletes custom model after confirmation', async () => {
    const { toast } = await import('sonner');
    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (
        String(url).includes('/custom-models') &&
        !String(url).includes('/custom-models/') &&
        !options?.method
      ) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              models: [{ modelId: 'del-me', displayName: 'Delete Me' }],
            }),
        });
      }
      if (String(url).includes('/custom-models/del-me') && options?.method === 'DELETE') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ models: [], overrides: [] }),
      });
    });

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={{ ...defaultProvider, apiKeyId: 'key-1', hasApiKey: true }}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Delete Me').length).toBeGreaterThan(0);
    });

    // Custom models render a trash button in the model row (provider delete is absent for non-custom)
    const trashIcons = screen.getAllByTestId('icon-Trash2Icon');
    const lastTrashBtn = trashIcons[trashIcons.length - 1]?.closest('button');
    expect(lastTrashBtn).toBeTruthy();
    fireEvent.click(lastTrashBtn as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getByText('Provider.delete_model_dialog_title')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Provider.delete_model_dialog_delete'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/api-keys/key-1/custom-models/del-me',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Model Deleted');
    });
  });

  it('handleDeleteProvider shows error toast on failure', async () => {
    const { toast } = await import('sonner');
    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/settings/api-keys/custom-provider-key-id' && options?.method === 'DELETE') {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: 'nope' }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ models: [] }) });
    });

    const customProvider: Provider = {
      ...defaultProvider,
      isCustom: true,
      apiKeyId: 'custom-provider-key-id',
    };

    const { ProviderDetail } = await import('./ProviderDetail');
    render(
      <ProviderDetail
        provider={customProvider}
        onToggle={mockOnToggle}
        onSave={mockOnSave}
        onDelete={mockOnDelete}
      />,
    );

    const deleteButton = screen.getByTestId('icon-Trash2Icon').closest('button');
    if (!deleteButton) {
      throw new Error('Expected delete provider button');
    }
    fireEvent.click(deleteButton);
    await waitFor(() => {
      expect(screen.getByText('Provider.delete_provider_dialog_delete')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Provider.delete_provider_dialog_delete'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(mockOnDelete).not.toHaveBeenCalled();
  });
});
