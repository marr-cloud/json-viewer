import { expect, test } from './fixtures';
import { setStorage } from './storage';

const viewer = 'json-viewer-app';

test.beforeEach(async ({ extensionId }) => {
  expect(extensionId).toMatch(/^[a-p]{32}$/);
});

test('shows color swatches next to color values', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/rich.json'));
  const swatch = page.locator(`${viewer} .cm-jv-swatch`);
  await expect(swatch).toHaveCount(1);
  await expect(swatch).toHaveCSS('background-color', 'rgb(255, 85, 0)');
});

test('shows dates in local time and UTC on hover', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/rich.json'));
  await page.locator(`${viewer} .cm-line span`, { hasText: '1728691200' }).hover();
  const tooltip = page.locator(`${viewer} .cm-jv-date`);
  await expect(tooltip).toContainText('2024-10-12 00:00:00 UTC');
  await expect(tooltip).toContainText('Unix time in seconds');
});

test('previews images on hover', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/rich.json'));
  await page.locator(`${viewer} .cm-url`, { hasText: 'pixel.svg' }).hover();
  await expect(page.locator(`${viewer} .cm-jv-image img`)).toBeVisible();
  await expect(page.locator(`${viewer} .cm-jv-image-info`)).toHaveText('2 × 3');
});

// The page's CSP (`/rich-csp.json`) does not reach the content script's image requests,
// so the failure is simulated with an image that does not exist.
test('says when the image cannot be loaded', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/rich-broken.json'));
  await page.locator(`${viewer} .cm-url`, { hasText: 'missing.svg' }).hover();
  await expect(page.locator(`${viewer} .cm-jv-image-info`)).toHaveText('The image could not be loaded.');
});

test('turns features off from the settings', async ({ context, server }) => {
  await setStorage(context, 'sync', { settings: { features: { colorSwatches: false, jsonPath: false } } });
  const page = await context.newPage();
  await page.goto(server.url('/rich.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"accent"');
  await expect(page.locator(`${viewer} .cm-jv-swatch`)).toHaveCount(0);
  await expect(page.getByLabel('JSONPath filter')).toHaveCount(0);
});

test('uses light mode above the threshold', async ({ context, server }) => {
  await setStorage(context, 'sync', { settings: { viewer: { lightModeThresholdMB: 1 } } });
  const page = await context.newPage();
  await page.goto(server.url('/big.json'));
  await expect(page.locator(`${viewer} .jv-light`)).toHaveText('Light mode', { timeout: 15_000 });
  await page.goto(server.url('/rich.json'));
  await expect(page.locator(`${viewer} .cm-jv-swatch`)).toHaveCount(1);
  await expect(page.locator(`${viewer} .jv-light`)).toHaveCount(0);
});
