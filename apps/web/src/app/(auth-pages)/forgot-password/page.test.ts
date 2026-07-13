import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: { NEXT_PUBLIC_EMAIL_ENABLED: 'true' },
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock('@lmring/env', () => ({ env: mocks.env }));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/libs/request-locale', () => ({
  getRequestLocale: async () => 'en',
}));

vi.mock('@/libs/server-translations', () => ({
  getServerTranslations: async () => (key: string) => key,
}));

vi.mock('./ForgotPasswordForm', () => ({
  ForgotPasswordForm: () => React.createElement('div', { 'data-testid': 'forgot-form' }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href }, children),
}));

import ForgotPasswordPage, { generateMetadata } from './page';

describe('ForgotPassword Page', () => {
  beforeEach(() => {
    mocks.env.NEXT_PUBLIC_EMAIL_ENABLED = 'true';
    mocks.redirect.mockClear();
  });

  it('generateMetadata uses translations', async () => {
    const meta = await generateMetadata();
    expect(meta.title).toBe('ForgotPassword.meta_title');
    expect(meta.description).toBe('ForgotPassword.meta_description');
  });

  it('redirects to sign-in when email is disabled', async () => {
    mocks.env.NEXT_PUBLIC_EMAIL_ENABLED = 'false';
    await expect(ForgotPasswordPage()).rejects.toThrow('REDIRECT:/sign-in');
  });

  it('renders form when email is enabled', async () => {
    const element = await ForgotPasswordPage();
    const html = renderToStaticMarkup(element);
    expect(html).toContain('ForgotPassword.meta_title');
    expect(html).toContain('data-testid="forgot-form"');
    expect(html).toContain('href="/sign-in"');
  });
});
