import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GlobalError from './global-error';

vi.mock('@lmring/i18n', () => ({
  I18nConfig: {
    defaultLocale: 'en',
  },
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

vi.mock('next/error', () => ({
  default: ({ statusCode }: { statusCode: number }) => (
    <div data-testid="next-error">Error {statusCode}</div>
  ),
}));

describe('GlobalError', () => {
  it('should render NextError component with statusCode 0', () => {
    const error = new Error('Test error');
    render(<GlobalError error={error} />);

    expect(screen.getByTestId('next-error')).toBeInTheDocument();
    expect(screen.getByText('Error 0')).toBeInTheDocument();
  });

  it('should capture exception to Sentry', async () => {
    const Sentry = await import('@sentry/nextjs');
    const error = new Error('Test error');

    render(<GlobalError error={error} />);

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('should handle error with digest', async () => {
    const Sentry = await import('@sentry/nextjs');
    const error = Object.assign(new Error('Test error'), { digest: 'test-digest' });

    render(<GlobalError error={error} />);

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
});
