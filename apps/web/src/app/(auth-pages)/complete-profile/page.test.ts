import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  getSession: vi.fn(),
  headers: vi.fn().mockResolvedValue(new Headers()),
  isPlaceholderEmail: vi.fn().mockReturnValue(true),
}));

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

vi.mock('@lmring/auth/placeholder-email', () => ({
  isPlaceholderEmail: mocks.isPlaceholderEmail,
}));

vi.mock('@/libs/request-locale', () => ({
  getRequestLocale: async () => 'en',
}));

vi.mock('@/libs/server-translations', () => ({
  getServerTranslations: async () => (key: string) => key,
}));

vi.mock('./CompleteProfileForm', () => ({
  CompleteProfileForm: ({ userName }: { userName: string }) =>
    React.createElement('div', { 'data-testid': 'complete-form', 'data-user-name': userName }),
}));

import CompleteProfilePage, { generateMetadata } from './page';

describe('CompleteProfile Page', () => {
  beforeEach(() => {
    mocks.redirect.mockClear();
    mocks.isPlaceholderEmail.mockReturnValue(true);
    mocks.getSession.mockResolvedValue({
      user: {
        id: 'u1',
        email: 'placeholder@users.noreply.lmring.local',
        name: 'Ada',
      },
    });
  });

  it('generateMetadata uses translations', async () => {
    const meta = await generateMetadata();
    expect(meta.title).toBe('CompleteProfile.meta_title');
    expect(meta.description).toBe('CompleteProfile.meta_description');
  });

  it('redirects to sign-in when unauthenticated', async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    await expect(CompleteProfilePage()).rejects.toThrow('REDIRECT:/sign-in');
  });

  it('redirects to arena when profile already complete', async () => {
    mocks.isPlaceholderEmail.mockReturnValueOnce(false);
    await expect(CompleteProfilePage()).rejects.toThrow('REDIRECT:/arena');
  });

  it('renders form for placeholder email users', async () => {
    const element = await CompleteProfilePage();
    const html = renderToStaticMarkup(element);
    expect(html).toContain('CompleteProfile.meta_title');
    expect(html).toContain('data-testid="complete-form"');
    expect(html).toContain('data-user-name="Ada"');
  });
});
