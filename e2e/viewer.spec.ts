import { expect, test } from './fixtures';

const viewer = 'json-viewer-app';

test.beforeEach(async ({ extensionId }) => {
  // Requesting the fixture makes sure the extension's service worker is up.
  expect(extensionId).toMatch(/^[a-p]{32}$/);
});

test('renders application/json responses formatted', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const content = page.locator(`${viewer} .cm-content`);
  await expect(content).toContainText('"name": "x"');
  await expect(content).toContainText('12345678901234567890');
  await expect(page.locator('body > pre')).toBeHidden();
});

test('renders +json and JSON served as text/plain', async ({ context, server }) => {
  const page = await context.newPage();
  for (const route of ['/ld', '/plain-json']) {
    await page.goto(server.url(route));
    await expect(page.locator(`${viewer} .cm-content`)).toBeVisible();
  }
});

test('leaves HTML pages and plain-text logs alone', async ({ context, server }) => {
  const page = await context.newPage();
  for (const route of ['/page.html', '/plain-log']) {
    await page.goto(server.url(route));
    await page.waitForTimeout(500);
    await expect(page.locator(viewer)).toHaveCount(0);
    await expect(page.locator('body > pre')).toBeVisible();
  }
});

test('renders a ~4 MB document', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/big.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"item 0"', { timeout: 15_000 });
});
