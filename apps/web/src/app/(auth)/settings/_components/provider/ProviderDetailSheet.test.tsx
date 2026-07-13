import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Provider } from './types';

vi.mock('@lmring/ui', async () => {
  const React = await import('react');
  return {
    Sheet: ({
      children,
      open,
      onOpenChange,
    }: {
      children?: React.ReactNode;
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
    }) =>
      open ? (
        <div data-testid="sheet">
          {children}
          <button type="button" onClick={() => onOpenChange?.(false)}>
            close-sheet
          </button>
        </div>
      ) : null,
    SheetContent: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="sheet-content">{children}</div>
    ),
    SheetTitle: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
      <h2 className={className}>{children}</h2>
    ),
    SheetDescription: ({
      children,
      className,
    }: {
      children?: React.ReactNode;
      className?: string;
    }) => <p className={className}>{children}</p>,
  };
});

vi.mock('./ProviderDetail', () => ({
  ProviderDetail: ({
    provider,
    onToggle,
    onSave,
    onDelete,
  }: {
    provider: Provider;
    onToggle: (id: string) => void;
    onSave?: (providerId: string, apiKeyId: string, proxyUrl: string, hasApiKey: boolean) => void;
    onDelete?: (id: string) => void;
  }) => (
    <div data-testid="provider-detail">
      <span>{provider.name}</span>
      <button type="button" onClick={() => onToggle(provider.id)}>
        toggle
      </button>
      <button type="button" onClick={() => onSave?.(provider.id, 'key', 'proxy', true)}>
        save
      </button>
      <button type="button" onClick={() => onDelete?.(provider.id)}>
        delete
      </button>
    </div>
  ),
}));

import { ProviderDetailSheet } from './ProviderDetailSheet';

const provider: Provider = {
  id: 'openai',
  name: 'OpenAI',
  connected: true,
  Icon: null,
  description: 'OpenAI provider',
  type: 'enabled',
  tags: [],
};

describe('ProviderDetailSheet', () => {
  afterEach(() => {
    cleanup();
  });

  it('returns null when provider is missing', () => {
    const { container } = render(
      <ProviderDetailSheet provider={null} open onOpenChange={vi.fn()} onToggle={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders provider detail when open with a provider', () => {
    const onToggle = vi.fn();
    const onSave = vi.fn();
    const onDelete = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ProviderDetailSheet
        provider={provider}
        open
        onOpenChange={onOpenChange}
        onToggle={onToggle}
        onSave={onSave}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByTestId('sheet')).toBeInTheDocument();
    expect(screen.getByTestId('provider-detail')).toBeInTheDocument();
    expect(screen.getAllByText('OpenAI').length).toBeGreaterThan(0);
    expect(screen.getByText('OpenAI provider configuration')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(onToggle).toHaveBeenCalledWith('openai');

    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    expect(onSave).toHaveBeenCalledWith('openai', 'key', 'proxy', true);

    fireEvent.click(screen.getByRole('button', { name: 'delete' }));
    expect(onDelete).toHaveBeenCalledWith('openai');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not render sheet content when closed', () => {
    render(
      <ProviderDetailSheet
        provider={provider}
        open={false}
        onOpenChange={vi.fn()}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('sheet')).not.toBeInTheDocument();
  });
});
