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

import TermsOfServicePage, { generateMetadata } from './page';

describe('Terms page', () => {
  it('generateMetadata uses translations', async () => {
    const meta = await generateMetadata();
    expect(meta.title).toBe('Terms.meta_title');
    expect(meta.description).toBe('Terms.meta_description');
  });

  it('renders key sections', async () => {
    const element = await TermsOfServicePage();
    const html = renderToStaticMarkup(element);
    expect(html).toContain('Terms.title');
    expect(html).toContain('Terms.section_acceptance_title');
    expect(html).toContain('Terms.section_description_title');
  });
});
