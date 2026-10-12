import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

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
  await expect(options.getByRole('status')).toContainText('Imported “Test Night” as a dark theme.');
  await expect(options.getByLabel('Dark theme')).toHaveValue('test-night');
  await options.waitForTimeout(500);
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
  await options.waitForTimeout(500);
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
