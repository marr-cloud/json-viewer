import { expect, test } from './fixtures';

const viewer = 'json-viewer-app';

test.beforeEach(async ({ extensionId }) => {
  // Requesting the fixture makes sure the extension's service worker is up.
  expect(extensionId).toMatch(/^[a-p]{32}$/);
});

test('renders application/json responses formatted', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const content = page.locator(`${viewer} .cm-content`);
  await expect(content).toContainText('"name": "x"');
  await expect(content).toContainText('12345678901234567890');
  await expect(page.locator('body > pre')).toBeHidden();
});

test('renders +json and JSON served as text/plain', async ({ context, server }) => {
  const page = await context.newPage();
  for (const route of ['/ld', '/plain-json']) {
    await page.goto(server.url(route));
    await expect(page.locator(`${viewer} .cm-content`)).toBeVisible();
  }
});

test('leaves HTML pages and plain-text logs alone', async ({ context, server }) => {
  const page = await context.newPage();
  for (const route of ['/page.html', '/plain-log']) {
    await page.goto(server.url(route));
    await page.waitForTimeout(500);
    await expect(page.locator(viewer)).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-json-viewer', /.*/);
    await expect(page.locator('body > pre')).toBeVisible();
  }
});

test('renders a ~4 MB document', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/big.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"item 0"', { timeout: 15_000 });
});

test('colors keys with the Dark+ theme', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const keyLine = page.locator(`${viewer} .cm-line`, { hasText: '"name"' });
  await expect(keyLine.locator('span').first()).toHaveCSS('color', 'rgb(156, 220, 254)');
});

test('shows the URL header and toggles Raw', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .jv-url`)).toHaveText(server.url('/data.json'));

  await page.getByRole('tab', { name: 'Raw' }).click();
  await expect(page.locator(`${viewer} .jv-raw`)).toContainText('{"name":"x"');
  await expect(page.locator(`${viewer} .cm-editor`)).toHaveCount(0);

  await page.getByRole('tab', { name: 'Code' }).click();
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name": "x"');
});

test('shows a located error for invalid JSON', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/invalid.json'));
  await expect(page.locator(`${viewer} .jv-error`)).toContainText('line 3, column 1');
  await expect(page.locator(`${viewer} .cm-jv-error-line`)).toHaveCount(1);
});

test('treats a BOM-prefixed body as valid JSON', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/bom.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"a": 1');
  await expect(page.locator(`${viewer} .jv-error`)).toHaveCount(0);
});

test('opens clicked URLs in a new tab', async ({ context, server }) => {
  await context.route('https://example.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>ok</p>' }),
  );
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    page.locator(`${viewer} .cm-url`).first().click(),
  ]);
  await popup.waitForURL('https://example.com/a');
});

test('does not open tabs when double-clicking a URL', async ({ context, server }) => {
  await context.route('https://example.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>ok</p>' }),
  );
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const url = page.locator(`${viewer} .cm-url`).first();
  await expect(url).toBeVisible();
  const before = context.pages().length;
  const opened = context.waitForEvent('page', { timeout: 1000 });
  const outcome = opened.then(
    () => 'opened',
    () => 'none',
  );
  await url.dblclick();
  expect(await outcome).toBe('none');
  expect(context.pages().length).toBe(before);
});

test('focuses the editor so Ctrl+F opens the in-editor search', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name"');
  await page.keyboard.press('Control+f');
  await expect(page.locator(`${viewer} .cm-search`)).toBeVisible();
});

test('brings the error of a minified invalid document into view', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/minified-invalid.json'));
  await expect(page.locator(`${viewer} .jv-error`)).toContainText('line 1, column');
  await expect(page.locator(`${viewer} .cm-jv-error-char`)).toBeInViewport();
  await expect(page.locator(`${viewer} .cm-jv-error-line`)).toHaveCount(0);
});

test('the always-on detector does not post messages to the page', async ({ context, server }) => {
  const page = await context.newPage();
  await page.addInitScript(() => {
    const w = window as unknown as { __jvMessages: unknown[] };
    w.__jvMessages = [];
    window.addEventListener('message', (e) => w.__jvMessages.push(e.data));
  });
  await page.goto(server.url('/page.html'));
  await page.waitForTimeout(500);
  const messages = await page.evaluate(
    () => (window as unknown as { __jvMessages: unknown[] }).__jvMessages,
  );
  expect(JSON.stringify(messages)).not.toMatch(/wxt|content-script-started/);
});
