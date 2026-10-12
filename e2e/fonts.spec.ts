import { expect, test } from './fixtures';
import { hasLoadedFace, seedTestFont, TEST_FONT } from './fonts';
import { setStorage } from './storage';

const viewer = 'json-viewer-app';
const googleFont = { settings: { font: { source: 'google', family: TEST_FONT } } };

test('renders with a downloaded Google font under a strict CSP', async ({ context }) => {
  await seedTestFont(context);
  await setStorage(context, 'sync', googleFont);
  const page = await context.newPage();
  await page.route('http://csp.test/data.json', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json', 'content-security-policy': "default-src 'none'" },
      body: '{"name":"x","list":[1,2,3]}',
    }),
  );
  await page.goto('http://csp.test/data.json');
  await expect(page.locator(`${viewer} .cm-line`).first()).toBeVisible();
  await expect.poll(() => hasLoadedFace(page, TEST_FONT)).toBe(true);
  const family = await page.locator(`${viewer} .cm-scroller`).evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).toMatch(/^"Share Tech Mono"/);
});

test('picks up a font downloaded while the tab is open', async ({ context, server }) => {
  await setStorage(context, 'sync', googleFont);
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .cm-line`).first()).toBeVisible();
  expect(await hasLoadedFace(page, TEST_FONT)).toBe(false);
  await seedTestFont(context);
  await expect.poll(() => hasLoadedFace(page, TEST_FONT)).toBe(true);
});

test('switching to the Google source loads the stored font live', async ({ context, server }) => {
  await seedTestFont(context);
  await setStorage(context, 'sync', { settings: { font: { source: 'system', family: TEST_FONT } } });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .cm-line`).first()).toBeVisible();
  expect(await hasLoadedFace(page, TEST_FONT)).toBe(false);
  await setStorage(context, 'sync', googleFont);
  await expect.poll(() => hasLoadedFace(page, TEST_FONT)).toBe(true);
});

test('the options preview uses a downloaded font', async ({ context, extensionId }) => {
  await seedTestFont(context);
  await setStorage(context, 'sync', googleFont);
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(options.locator('.opt-preview .cm-line').first()).toBeVisible();
  await expect.poll(() => hasLoadedFace(options, TEST_FONT)).toBe(true);
});
