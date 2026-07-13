import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { JsonLd } from './JsonLd';

vi.mock('@/utils/BaseUrl', () => ({
  getBaseUrl: () => 'https://lmring.example',
}));

describe('JsonLd', () => {
  it('renders three JSON-LD scripts with expected schema types', () => {
    const { container } = render(<JsonLd />);
    const scripts = container.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(3);

    const payloads = Array.from(scripts).map((script) => JSON.parse(script.innerHTML));
    expect(payloads.map((p) => p['@type'])).toEqual([
      'Organization',
      'WebSite',
      'SoftwareApplication',
    ]);
    expect(payloads[0].url).toBe('https://lmring.example');
    expect(payloads[1].potentialAction.target.urlTemplate).toContain('/leaderboard');
    expect(payloads[2].offers.price).toBe('0');
  });
});
