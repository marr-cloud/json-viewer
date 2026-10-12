import { expect, test } from './fixtures';
import { setStorage } from './storage';

const viewer = 'json-viewer-app';
const darkTheme = { type: 'dark', source: 'custom' };

test.beforeEach(async ({ extensionId }) => {
  expect(extensionId).toMatch(/^[a-p]{32}$/);
});

test('applies the configured light theme', async ({ context, server }) => {
  await setStorage(context, 'sync', { settings: { themeMode: 'light' } });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .jv-root`)).toHaveClass(/jv-light/);
  await expect(page.locator(`${viewer} .jv-root`)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('follows the system color scheme in auto mode, live', async ({ context, server }) => {
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .jv-root`)).toHaveClass(/jv-light/);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator(`${viewer} .jv-root`)).toHaveClass(/jv-dark/);
});

test('updates an open viewer when settings change', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const secondLine = page.locator(`${viewer} .cm-line`).nth(1);
  await expect.poll(() => secondLine.evaluate((el) => el.textContent)).toMatch(/^ {2}"name"/);
  await setStorage(context, 'sync', { settings: { viewer: { tabSize: 4 } } });
  await expect.poll(() => secondLine.evaluate((el) => el.textContent)).toMatch(/^ {4}"name"/);
});

test('the toolbar toggles light/dark for this tab', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .jv-root`)).toHaveClass(/jv-dark/);
  await page.getByRole('button', { name: 'Toggle light/dark theme' }).click();
  await expect(page.locator(`${viewer} .jv-root`)).toHaveClass(/jv-light/);
});

test('applies custom CSS', async ({ context, server }) => {
  await setStorage(context, 'local', { customCss: '.cm-content { letter-spacing: 3px; }' });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toHaveCSS('letter-spacing', '3px');
});

test('uses a custom theme from storage', async ({ context, server }) => {
  await setStorage(context, 'sync', {
    settings: { themeMode: 'dark', darkThemeId: 'mine' },
    customThemeIds: ['mine'],
    'customTheme:mine': { id: 'mine', name: 'Mine', ...darkTheme, colors: { background: '#101010', foreground: '#eeeeee', key: '#ff0000' } },
  });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const keyLine = page.locator(`${viewer} .cm-line`, { hasText: '"name"' });
  await expect(keyLine.locator('span').first()).toHaveCSS('color', 'rgb(255, 0, 0)');
  await expect(page.locator(`${viewer} .jv-root`)).toHaveCSS('background-color', 'rgb(16, 16, 16)');
});

test('falls back to Dark+ when the selected theme is missing', async ({ context, server }) => {
  await setStorage(context, 'sync', { settings: { themeMode: 'dark', darkThemeId: 'ghost' } });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const keyLine = page.locator(`${viewer} .cm-line`, { hasText: '"name"' });
  await expect(keyLine.locator('span').first()).toHaveCSS('color', 'rgb(156, 220, 254)');
});

test('renders with defaults when stored settings are garbage', async ({ context, server }) => {
  await setStorage(context, 'sync', { settings: 'not an object', customThemeIds: 7 });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name": "x"');
});

test('applies the configured font settings', async ({ context, server }) => {
  await setStorage(context, 'sync', {
    settings: { font: { family: 'Courier New', sizePx: 18, lineHeight: 2, ligatures: false } },
  });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const scroller = page.locator(`${viewer} .cm-scroller`);
  await expect(scroller).toHaveCSS('font-size', '18px');
  await expect(scroller).toHaveCSS('line-height', '36px');
  await expect(scroller).toHaveCSS('font-variant-ligatures', 'none');
  expect(await scroller.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"Courier New", ui-monospace/);
});

test('ignores a stored font family that could break the stylesheet', async ({ context, server }) => {
  await setStorage(context, 'sync', { settings: { font: { family: '"; } .jv-root { display: none } x {' } } });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .jv-root`)).toBeVisible();
  const family = await page.locator(`${viewer} .cm-scroller`).evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).toMatch(/^ui-monospace/);
});
