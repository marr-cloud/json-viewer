import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { getStorage, setStorage } from './storage';

const theme = {
  id: 'my-night',
  name: 'My Night',
  type: 'dark',
  source: 'custom',
  colors: { background: '#101010', foreground: '#eeeeee' },
};

async function openOptions(page: Page, extensionId: string): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByRole('heading', { name: 'Behavior' })).toBeVisible();
}

/** Picks `files` in the file chooser that the Import settings button opens. */
async function importFile(page: Page, files: ReturnType<typeof file>): Promise<void> {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Import settings' }).click(),
  ]);
  await chooser.setFiles(files);
}

const file = (name: string, content: unknown) => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from(typeof content === 'string' ? content : JSON.stringify(content)),
});

test('exports the settings, custom CSS and custom themes to a file', async ({ context, extensionId }) => {
  await setStorage(context, 'sync', {
    settings: { viewer: { sortKeys: true } },
    customThemeIds: [theme.id],
    [`customTheme:${theme.id}`]: theme,
  });
  await setStorage(context, 'local', { customCss: '.cm-editor { color: red }' });
  const options = await context.newPage();
  await openOptions(options, extensionId);
  const [download] = await Promise.all([
    options.waitForEvent('download'),
    options.getByRole('button', { name: 'Export settings' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^json-viewer-settings-\d{4}-\d{2}-\d{2}\.json$/);
  const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(backup).toMatchObject({
    format: 'json-viewer-settings',
    version: 1,
    settings: { viewer: { sortKeys: true } },
    customCss: '.cm-editor { color: red }',
    customThemes: [theme],
  });
});

test('imports a settings file after confirming', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  options.once('dialog', (dialog) => void dialog.accept());
  await importFile(
    options,
    file('mine.json', {
      format: 'json-viewer-settings',
      version: 1,
      settings: { viewer: { tabSize: 4 }, darkThemeId: theme.id },
      customCss: 'body { margin: 0 }',
      customThemes: [theme, { id: 'Bad Id' }],
    }),
  );
  await expect(options.getByRole('status').first()).toHaveText('Settings imported from “mine.json”.');
  await expect(options.getByRole('status').nth(1)).toHaveText('1 custom theme added or updated.');
  await expect(options.getByRole('status').nth(2)).toHaveText('1 theme in the file was left out.');
  await expect(options.getByLabel('Indent size')).toHaveValue('4');
  await expect
    .poll(() => getStorage(context, 'sync', 'settings'))
    .toMatchObject({ viewer: { tabSize: 4 }, darkThemeId: theme.id });
  await expect.poll(() => getStorage(context, 'local', 'customCss')).toBe('body { margin: 0 }');
  expect(await getStorage(context, 'sync', `customTheme:${theme.id}`)).toEqual(theme);
});

test('says why a file cannot be imported and changes nothing', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  let asked = false;
  options.on('dialog', (dialog) => {
    asked = true;
    void dialog.dismiss();
  });
  await importFile(options, file('theme.json', theme));
  await expect(options.getByRole('alert')).toHaveText('That file is not a JSON Viewer settings file.');
  await importFile(options, file('broken.json', '{oops'));
  await expect(options.getByRole('alert')).toHaveText('That file is not valid JSON.');
  expect(asked).toBe(false);
  expect(await getStorage(context, 'sync', 'settings')).toBeUndefined();
});
