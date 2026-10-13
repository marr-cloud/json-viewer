import type { BrowserContext } from '@playwright/test';
import { expect, test } from './fixtures';
import { getStorage, setStorage } from './storage';

const viewer = 'json-viewer-app';

test.beforeEach(async ({ extensionId }) => {
  expect(extensionId).toMatch(/^[a-p]{32}$/);
});

test('unwraps JSONP served as JavaScript or text', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.jsonp'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name": "jsonp"');
  await expect(page.locator(`${viewer} .jv-status-info`)).toContainText('JSONP');
  await page.goto(server.url('/plain.jsonp'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name": "plain jsonp"');
});

test('leaves real scripts alone', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/script.js'));
  await page.waitForTimeout(500);
  await expect(page.locator(viewer)).toHaveCount(0);
  await expect(page.locator('body > pre')).toBeVisible();
});

test('shows NDJSON as an array, whether sent as text or as JSON', async ({ context, server }) => {
  const page = await context.newPage();
  for (const route of ['/records.jsonl', '/ndjson-as-json']) {
    await page.goto(server.url(route));
    await expect(page.locator(`${viewer} .cm-content`)).toContainText('"id": 2');
    await expect(page.locator(`${viewer} .jv-status-info`)).toContainText('NDJSON');
    await expect(page.locator(`${viewer} .jv-error`)).toHaveCount(0);
  }
});

test('skips excluded sites but not others', async ({ context, server }) => {
  await setStorage(context, 'sync', { settings: { excludedHosts: ['127.0.0.1'] } });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await page.waitForTimeout(500);
  await expect(page.locator(viewer)).toHaveCount(0);
  await expect(page.locator('body > pre')).toBeVisible();
  await page.goto(server.insecureUrl('/data.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name": "x"');
});

test('the Sites section saves host patterns and flags the rest', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  const field = options.getByLabel("Don't open the viewer on");
  await field.fill('https://API.example.com/v1\nnot a host\n*.test');
  await field.press('Tab');
  await expect(field).toHaveValue('api.example.com\n*.test');
  await expect(options.getByRole('alert')).toContainText('not a host');
  await expect.poll(() => getStorage(context, 'sync', 'settings')).toMatchObject({ excludedHosts: ['api.example.com', '*.test'] });
});

test('the scratchpad formats pasted text', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/scratchpad.html`);
  const input = page.getByLabel('JSON input');
  await expect(input).toBeFocused();
  await expect(page.locator('.sp-empty')).toBeVisible();
  await input.fill('cb({"pasted": true})');
  await expect(page.locator('.sp-output .cm-content')).toContainText('"pasted": true');
  await expect(page.locator('.sp-output .jv-status-info')).toContainText('JSONP');
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.locator('.sp-empty')).toBeVisible();
});

test('the scratchpad opens with handed-over text', async ({ context, extensionId }) => {
  await setStorage(context, 'session', { 'scratchpadInput:abc': '[1, 2, 3]', 'scratchpadInput:other': '"not mine"' });
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/scratchpad.html?input=abc`);
  await expect(page.getByLabel('JSON input')).toHaveValue('[1, 2, 3]');
  await expect(page.locator('.sp-output .cm-content')).toContainText('3');
  await expect.poll(() => getStorage(context, 'session', 'scratchpadInput:abc')).toBeUndefined();
  // Another tab's hand-off stays, and a reload of this one starts empty.
  expect(await getStorage(context, 'session', 'scratchpadInput:other')).toBe('"not mine"');
  expect(page.url()).toBe(`chrome-extension://${extensionId}/scratchpad.html`);
});

/** What "View as JSON" does (src/background/viewer.ts injectViewer with force), run from the service worker. */
async function forceViewer(context: BrowserContext, url: string): Promise<void> {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  await worker.evaluate(async (pageUrl) => {
    type Scripting = {
      executeScript(details: {
        target: { tabId: number };
        func?: (flag: string, guard: string) => boolean;
        args?: string[];
        files?: string[];
      }): Promise<{ result?: unknown }[]>;
    };
    const api = (globalThis as unknown as { chrome: { tabs: { query(q: { url: string }): Promise<{ id: number }[]> }; scripting: Scripting } }).chrome;
    const [tab] = await api.tabs.query({ url: pageUrl });
    const target = { tabId: tab!.id };
    const [flagged] = await api.scripting.executeScript({
      target,
      func: (flag, guard) => {
        (globalThis as unknown as Record<string, unknown>)[flag] = true;
        return document.documentElement.hasAttribute(guard);
      },
      args: ['__jsonViewerForced', 'data-json-viewer'],
    });
    if (flagged?.result === true) return;
    await api.scripting.executeScript({ target, files: ['/content-scripts/viewer.js'] });
  }, url);
}

test('"View as JSON" opens the viewer on pages that were not detected', async ({ context, server }) => {
  const page = await context.newPage();
  for (const [route, text] of [
    ['/page.html', '"a": 1'],
    ['/json-in-html', '"b": 2'],
  ] as const) {
    await page.goto(server.url(route));
    await page.waitForTimeout(300);
    await expect(page.locator(viewer)).toHaveCount(0);
    await forceViewer(context, server.url(route));
    await expect(page.locator(`${viewer} .cm-content`)).toContainText(text);
  }
});

test('"View as JSON" on a page that already shows the viewer leaves it as it is', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name": "x"');
  await forceViewer(context, server.url('/data.json'));
  await page.waitForTimeout(500);
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name": "x"');
});

test('the Sites section saves while typing, without leaving the field', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.getByLabel("Don't open the viewer on").fill('typed.example.com');
  await expect.poll(() => getStorage(context, 'sync', 'settings')).toMatchObject({ excludedHosts: ['typed.example.com'] });
});
