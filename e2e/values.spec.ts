import { expect, test } from './fixtures';
import { getStorage, setStorage } from './storage';

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

// Chromium doesn't apply the page CSP to the content script's image requests; this pins it.
test('loads image previews even when the page CSP blocks images', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/rich-csp.json'));
  await page.locator(`${viewer} .cm-url`, { hasText: 'pixel.svg' }).hover();
  await expect(page.locator(`${viewer} .cm-jv-image-info`)).toHaveText('2 × 3');
});

// Chromium does not apply the page's CSP to the content script's images, so the
// failure is simulated with an image that returns 404.
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
  await expect(page.locator(`${viewer} .jv-light-mode`)).toHaveText('Light mode', { timeout: 15_000 });
  await page.goto(server.url('/rich.json'));
  await expect(page.locator(`${viewer} .cm-jv-swatch`)).toHaveCount(1);
  await expect(page.locator(`${viewer} .jv-light-mode`)).toHaveCount(0);
});

test('the Features section switches features and saves them', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  const preview = options.locator('.opt-preview');
  await expect(preview.locator('.cm-jv-swatch').first()).toBeAttached();
  await expect(preview.getByLabel('JSONPath filter')).toBeVisible();

  await options.getByRole('switch', { name: 'Color swatches' }).uncheck();
  await options.getByRole('switch', { name: 'JSONPath filter' }).uncheck();
  await expect(preview.locator('.cm-jv-swatch')).toHaveCount(0);
  await expect(preview.getByLabel('JSONPath filter')).toHaveCount(0);

  await options.getByLabel('Light mode above (MB)').fill('5');
  await options.getByLabel('Light mode above (MB)').press('Tab');
  await expect
    .poll(() => getStorage(context, 'sync', 'settings'))
    .toMatchObject({
      features: { jsonPath: false, colorSwatches: false, dateTooltips: true, imagePreview: true },
      viewer: { lightModeThresholdMB: 5 },
    });
});

test('the options preview shows a date tooltip', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator('.opt-preview .cm-line span', { hasText: '1728691200' }).hover();
  await expect(options.locator('.opt-preview .cm-jv-date')).toContainText('2024-10-12 00:00:00 UTC');
});
