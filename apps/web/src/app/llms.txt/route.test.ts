import { describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/utils/BaseUrl', () => ({
  getBaseUrl: () => 'https://lmring.example',
}));

describe('GET /llms.txt', () => {
  it('returns plain text content with cache headers', async () => {
    const response = GET();
    const text = await response.text();

    expect(response.headers.get('Content-Type')).toContain('text/plain');
    expect(response.headers.get('Cache-Control')).toContain('max-age=86400');
    expect(text).toContain('# LMRing');
    expect(text).toContain('https://lmring.example/leaderboard');
    expect(text).toContain('https://lmring.example/arena');
  });
});
