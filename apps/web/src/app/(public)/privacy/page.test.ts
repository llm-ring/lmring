import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/libs/request-locale', () => ({
  getRequestLocale: async () => 'en',
}));

vi.mock('@/libs/server-translations', () => ({
  getServerTranslations: async () => (key: string) => key,
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href }, children),
}));

import PrivacyPolicyPage, { generateMetadata } from './page';

describe('Privacy page', () => {
  it('generateMetadata uses translations', async () => {
    const meta = await generateMetadata();
    expect(meta.title).toBe('Privacy.meta_title');
    expect(meta.description).toBe('Privacy.meta_description');
  });

  it('renders key sections', async () => {
    const element = await PrivacyPolicyPage();
    const html = renderToStaticMarkup(element);
    expect(html).toContain('Privacy.title');
    expect(html).toContain('Privacy.last_updated');
  });
});
