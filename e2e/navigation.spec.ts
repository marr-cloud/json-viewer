import { expect, test } from './fixtures';
import { setStorage } from './storage';

const viewer = 'json-viewer-app';

test.beforeEach(async ({ extensionId }) => {
  expect(extensionId).toMatch(/^[a-p]{32}$/);
});

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
