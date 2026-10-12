import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { getStorage, setStorage } from './storage';

const viewer = 'json-viewer-app';

test.beforeEach(async ({ context, extensionId }) => {
  expect(extensionId).toMatch(/^[a-p]{32}$/);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

/** Reads the clipboard from a page on a secure origin. */
function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

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

test('shows the cursor path, size, lines and format', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .jv-status-info`)).toHaveText(/95 B.*12 lines.*JSON/);
  await page.locator(`${viewer} .cm-line`, { hasText: '"list"' }).click();
  await expect(page.locator(`${viewer} .jv-path`)).toHaveText('$.nested.list');
});

test('copies the cursor path on click', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await page.locator(`${viewer} .cm-line`, { hasText: '"list"' }).click();
  await page.locator(`${viewer} .jv-path`).click();
  await expect(page.locator(`${viewer} .jv-status-message`)).toHaveText('Copied path');
  expect(await readClipboard(page)).toBe('$.nested.list');
});

test('copies the path on a page without the async Clipboard API', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.insecureUrl('/data.json'));
  expect(await page.evaluate(() => window.isSecureContext)).toBe(false);
  await page.locator(`${viewer} .cm-line`, { hasText: '"list"' }).click();
  await page.locator(`${viewer} .jv-path`).click();
  await expect(page.locator(`${viewer} .jv-status-message`)).toHaveText('Copied path');
  const reader = await context.newPage();
  await reader.goto(server.url('/page.html'));
  expect(await readClipboard(reader)).toBe('$.nested.list');
});

const FORMATTED_DATA = [
  '{',
  '  "name": "x",',
  '  "url": "https://example.com/a",',
  '  "nested": {',
  '    "list": [',
  '      1,',
  '      2,',
  '      3',
  '    ]',
  '  },',
  '  "big": 12345678901234567890',
  '}',
].join('\n');
const MINIFIED_DATA = '{"name":"x","url":"https://example.com/a","nested":{"list":[1,2,3]},"big":12345678901234567890}';

test('folds all and unfolds all', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const content = page.locator(`${viewer} .cm-content`);
  await expect(content).toContainText('"list"');
  await page.getByRole('button', { name: 'Fold all', exact: true }).click();
  await expect(content).not.toContainText('"list"');
  await page.getByRole('button', { name: 'Unfold all', exact: true }).click();
  await expect(content).toContainText('"list"');
});

/** The editor is virtualized, so scroll to the bottom and check the last items are folded too. */
async function expectFoldedToTheEnd(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.locator(`${viewer} .cm-scroller`).evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        const text = (await page.locator(`${viewer} .cm-content`).textContent()) ?? '';
        return { hasName: text.includes('"name"'), hasEnd: text.includes('{…}') };
      },
      { timeout: 30_000 },
    )
    .toEqual({ hasName: false, hasEnd: true });
}

test('folds a 4 MB document completely on open', async ({ context, server }) => {
  await setStorage(context, 'sync', { settings: { viewer: { foldFromLevel: 2 } } });
  const page = await context.newPage();
  await page.goto(server.url('/big.json'));
  await expect(page.locator(`${viewer} .jv-status-info`)).toContainText('450,002 lines', { timeout: 15_000 });
  await expectFoldedToTheEnd(page);
});

test('folds and unfolds a 4 MB document', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/big.json'));
  await expect(page.locator(`${viewer} .jv-status-info`)).toContainText('450,002 lines', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Fold all', exact: true }).click();
  await expectFoldedToTheEnd(page);
  await page.getByRole('button', { name: 'Unfold all', exact: true }).click();
  await page.locator(`${viewer} .cm-scroller`).evaluate((el) => {
    el.scrollTop = 0;
  });
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"item 0"');
});

test('copies the formatted and the minified document', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await page.getByRole('button', { name: 'Copy formatted JSON' }).click();
  await expect(page.locator(`${viewer} .jv-status-message`)).toHaveText('Copied formatted JSON');
  // Windows converts line breaks to CRLF in the clipboard.
  expect((await readClipboard(page)).replaceAll('\r\n', '\n')).toBe(FORMATTED_DATA);
  await page.getByRole('button', { name: 'Copy minified JSON' }).click();
  await expect(page.locator(`${viewer} .jv-status-message`)).toHaveText('Copied minified JSON');
  expect(await readClipboard(page)).toBe(MINIFIED_DATA);
});

test('downloads the formatted document', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download JSON' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('data.json');
  expect(await readFile((await download.path())!, 'utf8')).toBe(FORMATTED_DATA);
});

test('sorts keys for this tab only', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const secondLine = page.locator(`${viewer} .cm-line`).nth(1);
  await expect.poll(() => secondLine.evaluate((el) => el.textContent)).toMatch(/^ {2}"name"/);
  await page.getByRole('button', { name: 'Sort keys' }).click();
  await expect.poll(() => secondLine.evaluate((el) => el.textContent)).toMatch(/^ {2}"big"/);
  const other = await context.newPage();
  await other.goto(server.url('/data.json'));
  await expect
    .poll(() => other.locator(`${viewer} .cm-line`).nth(1).evaluate((el) => el.textContent))
    .toMatch(/^ {2}"name"/);
});

test('filters with JSONPath and goes back with Esc', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const content = page.locator(`${viewer} .cm-content`);
  const filter = page.getByRole('textbox', { name: 'JSONPath filter' });
  await filter.fill('$.nested.list[?(@ > 1)]');
  await filter.press('Enter');
  await expect(content).toHaveText(/^\[\s*2,\s*3\s*\]$/);
  await expect(page.locator(`${viewer} .jv-status-info`)).toContainText('2 matches');
  await filter.press('Escape');
  await expect(content).toContainText('"name": "x"');
});

test('shows JSONPath syntax errors under the field', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const filter = page.getByRole('textbox', { name: 'JSONPath filter' });
  await filter.fill('$.nested[?(@.x >');
  await filter.press('Enter');
  await expect(page.locator(`${viewer} .jv-filter-error`)).toBeVisible();
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name": "x"');
});

test('filters a 4 MB document', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/big.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"item 0"', { timeout: 15_000 });
  const filter = page.getByRole('textbox', { name: 'JSONPath filter' });
  await filter.fill('$[?(@.id == 49999)].name');
  await filter.press('Enter');
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"item 49999"', { timeout: 15_000 });
  await expect(page.locator(`${viewer} .jv-status-info`)).toContainText('1 match');
});

test('works with the default keyboard shortcuts', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const content = page.locator(`${viewer} .cm-content`);
  await expect(content).toContainText('"list"');
  await page.keyboard.press('Alt+BracketLeft');
  await expect(content).not.toContainText('"list"');
  await page.keyboard.press('Alt+BracketRight');
  await expect(content).toContainText('"list"');
  await page.keyboard.press('Control+Shift+KeyF');
  await expect(page.getByRole('textbox', { name: 'JSONPath filter' })).toBeFocused();
  await page.keyboard.press('Alt+KeyR');
  await expect(page.locator(`${viewer} .jv-raw`)).toBeVisible();
  await page.keyboard.press('Alt+KeyR');
  await expect(content).toBeVisible();
});

test('copies the cursor path with Ctrl+Shift+C', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await page.locator(`${viewer} .cm-line`, { hasText: '"list"' }).click();
  await page.keyboard.press('Control+Shift+KeyC');
  await expect(page.locator(`${viewer} .jv-status-message`)).toHaveText('Copied path');
  expect(await readClipboard(page)).toBe('$.nested.list');
});

test('uses the shortcuts from the settings', async ({ context, server }) => {
  await setStorage(context, 'sync', { settings: { shortcuts: { toggleRaw: 'Ctrl+Alt+Y' } } });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name"');
  // If Alt+R still toggled, the next shortcut would toggle back to Code and the check would fail.
  await page.keyboard.press('Alt+KeyR');
  await page.keyboard.press('Control+Alt+KeyY');
  await expect(page.locator(`${viewer} .jv-raw`)).toBeVisible();
});

test('records a shortcut in the options page and uses it in the viewer', async ({ context, server, extensionId }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  const field = options.getByRole('button', { name: 'Toggle Raw shortcut', exact: true });
  await expect(field).toHaveText('Alt+R');
  await field.click();
  await expect(field).toHaveText('Press keys…');
  await options.keyboard.press('Control+Alt+KeyY');
  await expect(field).toHaveText('Ctrl+Alt+Y');
  await expect
    .poll(() => getStorage(context, 'sync', 'settings'))
    .toMatchObject({ shortcuts: { toggleRaw: 'Ctrl+Alt+Y' } });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name"');
  await page.keyboard.press('Control+Alt+KeyY');
  await expect(page.locator(`${viewer} .jv-raw`)).toBeVisible();
});

test('warns about a shortcut used twice and clears it with Backspace', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  const filterField = options.getByRole('button', { name: 'JSONPath filter shortcut', exact: true });
  await filterField.click();
  await options.keyboard.press('Alt+KeyR');
  await expect(filterField).toHaveText('Alt+R');
  await expect(options.getByText('Also assigned to Toggle Raw.')).toBeVisible();
  await expect(options.getByText('Also assigned to JSONPath filter.')).toBeVisible();
  await filterField.click();
  await options.keyboard.press('Backspace');
  await expect(filterField).toHaveText('None');
  await expect(options.getByText(/Also assigned to/)).toHaveCount(0);
});

test('keeps the shortcuts after a click on a non-focusable part of the viewer', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await page.locator(`${viewer} .jv-status-info`).click();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await page.keyboard.press('Alt+R');
  await expect(page.locator(`${viewer} .jv-raw`)).toBeVisible();
});
