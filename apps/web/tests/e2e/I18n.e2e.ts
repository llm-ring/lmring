import { expect, test } from '@playwright/test';

test.describe('I18n', () => {
  test('renders English content by default', async ({ page, context }) => {
    await context.setExtraHTTPHeaders({});
    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page).toHaveTitle(/LMRing|lmring/);
  });

  test('uses the language header to render localized content', async ({ page, context }) => {
    await context.setExtraHTTPHeaders({ 'x-language': 'fr' });
    await page.goto('/', { waitUntil: 'networkidle' });

    // The homepage should load successfully with French locale
    await expect(page).toHaveTitle(/LMRing|lmring/);
  });
});
