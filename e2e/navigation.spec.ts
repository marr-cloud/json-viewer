import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { setStorage } from './storage';

const viewer = 'json-viewer-app';

test.beforeEach(async ({ context, extensionId }) => {
  expect(extensionId).toMatch(/^[a-p]{32}$/);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

/** Reads the clipboard from a page on a secure origin. */
function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

test('folds from the configured level on open', async ({ context, server }) => {
  await setStorage(context, 'sync', { settings: { viewer: { foldFromLevel: 2 } } });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const content = page.locator(`${viewer} .cm-content`);
  await expect(content).toContainText('"nested": {');
  await expect(content).not.toContainText('"list"');
  await expect(page.locator(`${viewer} .cm-foldPlaceholder`)).toHaveCount(1);
});

test('the options preview folds on open when the setting changes', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(options.locator('.opt-preview .cm-content')).toContainText('"maintainers"');
  await options.getByLabel('Fold on open').selectOption({ label: 'Show 1 level' });
  await expect(options.locator('.opt-preview .cm-content')).not.toContainText('"roles"');
});

test('shows the cursor path, size, lines and format', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .jv-status-info`)).toHaveText(/95 B.*12 lines.*JSON/);
  await page.locator(`${viewer} .cm-line`, { hasText: '"list"' }).click();
  await expect(page.locator(`${viewer} .jv-path`)).toHaveText('$.nested.list');
});

test('copies the cursor path on click', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await page.locator(`${viewer} .cm-line`, { hasText: '"list"' }).click();
  await page.locator(`${viewer} .jv-path`).click();
  await expect(page.locator(`${viewer} .jv-status-message`)).toHaveText('Copied path');
  expect(await readClipboard(page)).toBe('$.nested.list');
});

test('copies the path on a page without the async Clipboard API', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.insecureUrl('/data.json'));
  expect(await page.evaluate(() => window.isSecureContext)).toBe(false);
  await page.locator(`${viewer} .cm-line`, { hasText: '"list"' }).click();
  await page.locator(`${viewer} .jv-path`).click();
  await expect(page.locator(`${viewer} .jv-status-message`)).toHaveText('Copied path');
  const reader = await context.newPage();
  await reader.goto(server.url('/page.html'));
  expect(await readClipboard(reader)).toBe('$.nested.list');
});
