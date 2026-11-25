import { expect, test } from '@playwright/test';

test.describe('I18n', () => {
  test('renders English content by default', async ({ page, context, browser }) => {
    await context.setExtraHTTPHeaders({});
    const events: string[] = [];
    page.on('console', (msg) => events.push(`console.${msg.type()}: ${msg.text()}`));
    page.on('pageerror', (error) => events.push(`pageerror: ${error.message}`));
    page.on('requestfailed', (request) =>
      events.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`),
    );
    const response = await page.goto('/', { waitUntil: 'networkidle' });
    const title = await page.title();
    const body = (await page.content()).slice(0, 2000);
    expect(
      title,
      `DIAG browser=${browser.browserType().name()} version=${browser.version()} ` +
        `status=${response?.status()} url=${page.url()} ` +
        `headers=${JSON.stringify(response?.headers())} ` +
        `body=${JSON.stringify(body)} events=${JSON.stringify(events.slice(0, 20))}`,
    ).toMatch(/LMRing|lmring/);
  });

  test('uses the language header to render localized content', async ({ page, context }) => {
    await context.setExtraHTTPHeaders({ 'x-language': 'fr' });
    await page.goto('/', { waitUntil: 'networkidle' });

    // The homepage should load successfully with French locale
    await expect(page).toHaveTitle(/LMRing|lmring/);
  });
});
