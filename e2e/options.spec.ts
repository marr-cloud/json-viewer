import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { getStorage } from './storage';

const viewer = 'json-viewer-app';

async function openOptions(page: Page, extensionId: string): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByRole('heading', { name: 'Behavior' })).toBeVisible();
}

test('a behavior change reaches an open viewer', async ({ context, server, extensionId }) => {
  const viewerPage = await context.newPage();
  await viewerPage.goto(server.url('/data.json'));
  await expect(viewerPage.locator(`${viewer} .jv-url`)).toBeVisible();
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByRole('switch', { name: 'Show URL and load time in the toolbar' }).uncheck();
  await expect(viewerPage.locator(`${viewer} .jv-url`)).toHaveCount(0);
});

test('the preview follows the indent size', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  const secondLine = options.locator('.opt-preview .cm-line').nth(1);
  await expect.poll(() => secondLine.evaluate((el) => el.textContent)).toMatch(/^ {2}"title"/);
  await options.getByLabel('Indent size (spaces)').fill('4');
  await options.getByLabel('Indent size (spaces)').press('Tab');
  await expect.poll(() => secondLine.evaluate((el) => el.textContent)).toMatch(/^ {4}"title"/);
});

test('turning off automatic formatting opens pages on Raw', async ({ context, server, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByRole('switch', { name: 'Format JSON automatically' }).uncheck();
  await expect(options.locator('.opt-preview .jv-raw')).toBeVisible();
  await expect
    .poll(() => getStorage(context, 'sync', 'settings'))
    .toMatchObject({ viewer: { autoHighlight: false } });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .jv-raw`)).toBeVisible();
});

test('custom CSS from the editor applies to the viewer', async ({ context, server, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByLabel('Custom CSS').click();
  await options.keyboard.type('.cm-content { letter-spacing: 3px; }');
  await expect(options.locator('.opt-preview .cm-content')).toHaveCSS('letter-spacing', '3px');
  await expect(options.locator('.opt-css .cm-content')).not.toHaveCSS('letter-spacing', '3px');
  await expect.poll(() => getStorage(context, 'local', 'customCss')).toBe('.cm-content { letter-spacing: 3px; }');
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toHaveCSS('letter-spacing', '3px');
});

test('the settings button in the viewer opens the options page', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const [options] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('button', { name: 'Open settings' }).click(),
  ]);
  await options.waitForURL(/\/options\.html$/);
});

test('reset restores the defaults', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  const sortKeys = options.getByRole('switch', { name: 'Sort object keys' });
  await sortKeys.check();
  options.once('dialog', (dialog) => void dialog.accept());
  await options.getByRole('button', { name: 'Reset to defaults' }).click();
  await expect(sortKeys).not.toBeChecked();
});

test('the preview reacts to line number changes', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await expect(options.locator('.opt-preview .cm-lineNumbers')).toBeVisible();
  const toggle = options.getByRole('switch', { name: 'Show line numbers' });
  await toggle.uncheck();
  await expect(options.locator('.opt-preview .cm-lineNumbers')).toHaveCount(0);
  await toggle.check();
  await expect(options.locator('.opt-preview .cm-lineNumbers')).toBeVisible();
});

test('the preview scrolls inside its frame', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await options.setViewportSize({ width: 1400, height: 260 });
  await openOptions(options, extensionId);
  const frame = await options.locator('.opt-preview-frame').boundingBox();
  const root = await options.locator('.opt-preview .jv-root').boundingBox();
  expect(root!.height).toBeLessThanOrEqual(frame!.height);
  const scroller = options.locator('.opt-preview .cm-scroller');
  await expect.poll(() => scroller.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
});
