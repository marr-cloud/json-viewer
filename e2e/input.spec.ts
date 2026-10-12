import { expect, test } from './fixtures';
import { getStorage, setStorage } from './storage';

const viewer = 'json-viewer-app';

test.beforeEach(async ({ extensionId }) => {
  expect(extensionId).toMatch(/^[a-p]{32}$/);
});

test('unwraps JSONP served as JavaScript or text', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.jsonp'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name": "jsonp"');
  await expect(page.locator(`${viewer} .jv-status-info`)).toContainText('JSONP');
  await page.goto(server.url('/plain.jsonp'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name": "plain jsonp"');
});

test('leaves real scripts alone', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/script.js'));
  await page.waitForTimeout(500);
  await expect(page.locator(viewer)).toHaveCount(0);
  await expect(page.locator('body > pre')).toBeVisible();
});

test('shows NDJSON as an array, whether sent as text or as JSON', async ({ context, server }) => {
  const page = await context.newPage();
  for (const route of ['/records.jsonl', '/ndjson-as-json']) {
    await page.goto(server.url(route));
    await expect(page.locator(`${viewer} .cm-content`)).toContainText('"id": 2');
    await expect(page.locator(`${viewer} .jv-status-info`)).toContainText('NDJSON');
    await expect(page.locator(`${viewer} .jv-error`)).toHaveCount(0);
  }
});

test('skips excluded sites but not others', async ({ context, server }) => {
  await setStorage(context, 'sync', { settings: { excludedHosts: ['127.0.0.1'] } });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await page.waitForTimeout(500);
  await expect(page.locator(viewer)).toHaveCount(0);
  await expect(page.locator('body > pre')).toBeVisible();
  await page.goto(server.insecureUrl('/data.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name": "x"');
});

test('the Sites section saves host patterns and flags the rest', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  const field = options.getByLabel("Don't open the viewer on");
  await field.fill('https://API.example.com/v1\nnot a host\n*.test');
  await field.press('Tab');
  await expect(field).toHaveValue('api.example.com\n*.test');
  await expect(options.getByRole('alert')).toContainText('not a host');
  await expect.poll(() => getStorage(context, 'sync', 'settings')).toMatchObject({ excludedHosts: ['api.example.com', '*.test'] });
});
