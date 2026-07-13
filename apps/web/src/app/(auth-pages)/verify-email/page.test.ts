import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: { NEXT_PUBLIC_EMAIL_ENABLED: 'true' },
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  getSession: vi.fn(),
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('@lmring/env', () => ({ env: mocks.env }));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('next/headers', () => ({
  headers: mocks.headers,
}));

vi.mock('@/libs/Auth', () => ({
  auth: {
    api: {
      getSession: mocks.getSession,
    },
  },
}));

vi.mock('@/libs/request-locale', () => ({
  getRequestLocale: async () => 'en',
}));

vi.mock('@/libs/server-translations', () => ({
  getServerTranslations: async () => (key: string) => key,
}));

vi.mock('./VerifyEmailForm', () => ({
  VerifyEmailForm: ({ email, callbackUrl }: { email: string; callbackUrl?: string }) =>
    React.createElement('div', {
      'data-testid': 'verify-form',
      'data-email': email,
      'data-callback-url': callbackUrl,
    }),
}));

import VerifyEmailPage, { generateMetadata } from './page';

describe('VerifyEmail Page', () => {
  beforeEach(() => {
    mocks.env.NEXT_PUBLIC_EMAIL_ENABLED = 'true';
    mocks.redirect.mockClear();
    mocks.getSession.mockResolvedValue(null);
  });

  it('generateMetadata uses translations', async () => {
    const meta = await generateMetadata();
    expect(meta.title).toBe('VerifyEmail.meta_title');
    expect(meta.description).toBe('VerifyEmail.meta_description');
  });

  it('redirects when email auth is disabled', async () => {
    mocks.env.NEXT_PUBLIC_EMAIL_ENABLED = 'false';
    await expect(
      VerifyEmailPage({ searchParams: Promise.resolve({ email: 'a@b.com' }) }),
    ).rejects.toThrow('REDIRECT:/sign-in');
  });

  it('redirects when no email is available', async () => {
    await expect(VerifyEmailPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'REDIRECT:/sign-in',
    );
  });

  it('uses session email when available', async () => {
    mocks.getSession.mockResolvedValueOnce({
      user: { email: 'session@example.com' },
    });

    const element = await VerifyEmailPage({
      searchParams: Promise.resolve({ callbackUrl: '/arena' }),
    });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('data-email="session@example.com"');
    expect(html).toContain('data-callback-url="/arena"');
  });

  it('falls back to query param email', async () => {
    const element = await VerifyEmailPage({
      searchParams: Promise.resolve({ email: 'query@example.com' }),
    });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('data-email="query@example.com"');
  });
});
