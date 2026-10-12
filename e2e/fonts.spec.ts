import type { BrowserContext } from '@playwright/test';
import { expect, test } from './fixtures';
import { hasLoadedFace, mockGoogleFonts, seedTestFont, TEST_FONT } from './fonts';
import { getStorage, setStorage } from './storage';

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

async function openFonts(context: BrowserContext, extensionId: string) {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(options.getByRole('heading', { name: 'Fonts', exact: true })).toBeVisible();
  return { options, fonts: options.locator('#fonts') };
}

test('downloads a Google font; the preview and open viewers use it', async ({ context, server, extensionId }) => {
  await mockGoogleFonts(context);
  const viewerPage = await context.newPage();
  await viewerPage.goto(server.url('/data.json'));
  const { options, fonts } = await openFonts(context, extensionId);
  await fonts.getByLabel('Font source').selectOption('google');
  await fonts.getByLabel('Font family').fill(TEST_FONT);
  await fonts.getByRole('button', { name: 'Download' }).click();
  await expect(fonts.getByRole('status')).toHaveText(/^Downloaded \(\d+ KB\)$/);
  await expect(fonts.getByRole('button', { name: `Delete ${TEST_FONT}` })).toBeVisible();
  await expect.poll(() => hasLoadedFace(options, TEST_FONT)).toBe(true);
  await expect
    .poll(() => getStorage(context, 'local', `fonts/${TEST_FONT}`))
    .toMatchObject({ family: TEST_FONT, subsets: ['latin', 'latin-ext'] });
  await expect.poll(() => hasLoadedFace(viewerPage, TEST_FONT)).toBe(true);
});

test('shows an error for an unknown Google font and saves nothing', async ({ context, extensionId }) => {
  await mockGoogleFonts(context);
  const { fonts } = await openFonts(context, extensionId);
  await fonts.getByLabel('Font source').selectOption('google');
  await fonts.getByLabel('Font family').fill('Nope Font');
  await fonts.getByRole('button', { name: 'Download' }).click();
  await expect(fonts.getByRole('alert')).toHaveText('"Nope Font" is not a Google Fonts family.');
  expect(await getStorage(context, 'local', 'fontFamilies')).toBeUndefined();
});

test('says when the chosen Google font is not downloaded on this device', async ({ context, extensionId }) => {
  await setStorage(context, 'sync', googleFont);
  const { fonts } = await openFonts(context, extensionId);
  await expect(fonts.getByRole('status')).toHaveText('Not downloaded yet');
  await expect(fonts.getByRole('button', { name: 'Download' })).toBeEnabled();
});

test('deletes a downloaded font', async ({ context, extensionId }) => {
  await seedTestFont(context);
  const { options, fonts } = await openFonts(context, extensionId);
  options.on('dialog', (dialog) => void dialog.accept());
  await fonts.getByRole('button', { name: `Delete ${TEST_FONT}` }).click();
  await expect(fonts.getByRole('button', { name: `Delete ${TEST_FONT}` })).toHaveCount(0);
  await expect.poll(() => getStorage(context, 'local', `fonts/${TEST_FONT}`)).toBeUndefined();
});

test('suggests the catalog families for Google Fonts', async ({ context, extensionId }) => {
  const { options } = await openFonts(context, extensionId);
  await expect(options.locator('#font-catalog option')).toHaveCount(20);
});

test('shows an error when deleting a font fails, whatever the font source', async ({ context, extensionId }) => {
  await seedTestFont(context);
  await setStorage(context, 'sync', { settings: { font: { source: 'system' } } });
  const { options, fonts } = await openFonts(context, extensionId);
  options.on('dialog', (dialog) => void dialog.accept());
  await options.evaluate(() => {
    const { chrome } = globalThis as unknown as { chrome: { storage: { local: { remove: () => Promise<never> } } } };
    chrome.storage.local.remove = () => Promise.reject(new Error('boom'));
  });
  await fonts.getByRole('button', { name: `Delete ${TEST_FONT}` }).click();
  await expect(fonts.getByRole('alert')).toContainText('Could not delete the font');
});
