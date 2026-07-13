import { describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

vi.mock('../sitemap-data', () => ({
  default: () => [
    {
      url: 'https://example.com/',
      lastModified: new Date('2024-01-01T00:00:00.000Z'),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: 'https://example.com/terms',
      lastModified: '2024-06-01',
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: 'https://example.com/bare',
    },
  ],
}));

describe('sitemap.xml route', () => {
  it('GET returns XML sitemap with entries', async () => {
    const response = await GET();
    const body = await response.text();

    expect(response.headers.get('Content-Type')).toBe('application/xml');
    expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(body).toContain('<loc>https://example.com/</loc>');
    expect(body).toContain('<lastmod>2024-01-01T00:00:00.000Z</lastmod>');
    expect(body).toContain('<changefreq>daily</changefreq>');
    expect(body).toContain('<priority>1</priority>');
    expect(body).toContain('<loc>https://example.com/terms</loc>');
    expect(body).toContain('<lastmod>2024-06-01</lastmod>');
    expect(body).toContain('<loc>https://example.com/bare</loc>');
  });

  it('POST returns the same XML response', async () => {
    const response = await POST();
    const body = await response.text();

    expect(response.headers.get('Content-Type')).toBe('application/xml');
    expect(body).toContain('urlset');
    expect(body).toContain('https://example.com/');
  });
});
