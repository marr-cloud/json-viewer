import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { getStorage, setStorage } from './storage';

const viewer = 'json-viewer-app';

const VSCODE_THEME = `{
  // Exported from VS Code
  "name": "Test Night",
  "type": "dark",
  "colors": { "editor.background": "#101010", "editor.foreground": "#eeeeee" },
  "tokenColors": [{ "scope": "support.type.property-name", "settings": { "foreground": "#ff0000" } }],
}`;

async function openOptions(page: Page, extensionId: string): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
}

async function keyColor(page: Page): Promise<string> {
  const keyLine = page.locator(`${viewer} .cm-line`, { hasText: '"name"' });
  return keyLine.locator('span').first().evaluate((el) => getComputedStyle(el).color);
}

test('imports a pasted VS Code theme and uses it', async ({ context, server, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByLabel('Theme mode').selectOption('dark');
  await options.getByLabel('VS Code theme JSON').fill(VSCODE_THEME);
  await options.getByRole('button', { name: 'Import' }).click();
  await expect(options.locator('p.opt-success')).toContainText('Imported “Test Night” as a dark theme.');
  await expect(options.getByLabel('Dark theme')).toHaveValue('test-night');
  await expect.poll(() => getStorage(context, 'sync', 'settings')).toMatchObject({ darkThemeId: 'test-night' });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect.poll(() => keyColor(page)).toBe('rgb(255, 0, 0)');
  await expect(page.locator(`${viewer} .jv-root`)).toHaveCSS('background-color', 'rgb(16, 16, 16)');
});

test('reports invalid theme files', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByLabel('VS Code theme JSON').fill('{"colors": ');
  await options.getByRole('button', { name: 'Import' }).click();
  await expect(options.getByRole('alert')).toContainText('Invalid JSON');
});

test('switches to a built-in theme', async ({ context, server, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByLabel('Theme mode').selectOption('dark');
  await options.getByLabel('Dark theme').selectOption('dracula');
  await expect.poll(() => getStorage(context, 'sync', 'settings')).toMatchObject({ darkThemeId: 'dracula' });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .jv-root`)).toHaveCSS('background-color', 'rgb(40, 42, 54)');
});

test('deletes a custom theme and falls back to the default', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByLabel('VS Code theme JSON').fill(VSCODE_THEME);
  await options.getByRole('button', { name: 'Import' }).click();
  await expect(options.getByLabel('Dark theme')).toHaveValue('test-night');
  options.once('dialog', (dialog) => void dialog.accept());
  await options.getByRole('button', { name: 'Delete Test Night' }).click();
  await expect(options.getByRole('button', { name: 'Delete Test Night' })).toHaveCount(0);
  await expect(options.getByLabel('Dark theme')).toHaveValue('dark-plus');
});

test('duplicates and edits a theme with a live preview', async ({ context, server, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByLabel('Theme mode').selectOption('dark');
  await options.getByRole('button', { name: 'Duplicate & edit dark theme' }).click();
  await expect(options.getByLabel('Theme name')).toHaveValue('Dark+ (copy)');
  await options.getByLabel('key hex').fill('#00ff00');
  await options.getByLabel('key hex').press('Tab');
  const previewKey = options.locator('.opt-preview .cm-line', { hasText: '"title"' }).locator('span').first();
  await expect(previewKey).toHaveCSS('color', 'rgb(0, 255, 0)');
  await options.getByRole('button', { name: 'Save theme' }).click();
  await expect(options.getByLabel('Dark theme')).toHaveValue('dark-copy');
  await expect.poll(() => getStorage(context, 'sync', 'settings')).toMatchObject({ darkThemeId: 'dark-copy' });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect.poll(() => keyColor(page)).toBe('rgb(0, 255, 0)');
});

test('blocks saving a theme with invalid JSON', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByRole('button', { name: 'Duplicate & edit dark theme' }).click();
  await options.getByLabel('Theme JSON').fill('{"name": ');
  await expect(options.getByRole('alert')).toContainText('Invalid JSON');
  await expect(options.getByRole('button', { name: 'Save theme' })).toBeDisabled();
});

test('clears the JSON error once a color edit rewrites the JSON', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByRole('button', { name: 'Duplicate & edit dark theme' }).click();
  await options.getByLabel('Theme JSON').fill('{"name": ');
  await expect(options.getByRole('alert')).toContainText('Invalid JSON');
  await options.getByLabel('key hex').fill('#00ff00');
  await options.getByLabel('key hex').press('Tab');
  await expect(options.getByRole('alert')).toHaveCount(0);
  await expect(options.getByRole('button', { name: 'Save theme' })).toBeEnabled();
});

test('rejects an invalid hex and restores the field', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByRole('button', { name: 'Duplicate & edit dark theme' }).click();
  const field = options.getByLabel('key hex');
  const previous = await field.inputValue();
  await field.fill('nope');
  await field.press('Tab');
  await expect(options.getByRole('alert')).toContainText('Invalid color for key');
  await expect(field).toHaveValue(previous);
});

test('the viewer toggle switches modes even when the light slot holds a dark theme', async ({ context, server }) => {
  await setStorage(context, 'sync', { settings: { themeMode: 'auto', lightThemeId: 'monokai', darkThemeId: 'dracula' } });
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(server.url('/data.json'));
  const root = page.locator(`${viewer} .jv-root`);
  await expect(root).toHaveCSS('background-color', 'rgb(39, 40, 34)');
  await page.getByRole('button', { name: 'Toggle light/dark theme' }).click();
  await expect(root).toHaveCSS('background-color', 'rgb(40, 42, 54)');
  await page.getByRole('button', { name: 'Toggle light/dark theme' }).click();
  await expect(root).toHaveCSS('background-color', 'rgb(39, 40, 34)');
});

test('duplicating the light slot theme saves the copy into the light slot even if it is dark', async ({ context, extensionId }) => {
  await setStorage(context, 'sync', { settings: { lightThemeId: 'monokai' } });
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByRole('button', { name: 'Duplicate & edit light theme' }).click();
  await options.getByRole('button', { name: 'Save theme' }).click();
  await expect(options.getByLabel('Light theme')).toHaveValue('monokai-copy');
  await expect(options.getByLabel('Dark theme')).toHaveValue('dark-plus');
});

test('exports a custom theme as compact JSON', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByLabel('VS Code theme JSON').fill(VSCODE_THEME);
  await options.getByRole('button', { name: 'Import' }).click();
  const [download] = await Promise.all([
    options.waitForEvent('download'),
    options.getByRole('button', { name: 'Export Test Night' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('test-night.json');
  const theme = JSON.parse(readFileSync((await download.path())!, 'utf8')) as Record<string, unknown>;
  expect(theme).toMatchObject({ id: 'test-night', name: 'Test Night', type: 'dark', source: 'imported' });
  expect(theme.colors).toMatchObject({ background: '#101010', foreground: '#eeeeee' });
});

test('a missing stored theme id is shown as a disabled option', async ({ context, extensionId }) => {
  await setStorage(context, 'sync', { settings: { darkThemeId: 'ghost', lightThemeId: 'phantom' } });
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await expect(options.getByLabel('Dark theme')).toHaveValue('ghost');
  await expect(options.getByLabel('Dark theme').locator('option:checked')).toHaveText('Missing theme (ghost) — using Dark+');
  await expect(options.getByLabel('Light theme').locator('option:checked')).toHaveText('Missing theme (phantom) — using Light+');
});
