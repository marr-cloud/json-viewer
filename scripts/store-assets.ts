// Store listing images: screenshots (1280×800), the Edge logo (300×300) and the small promo tile (440×280).
// Run `pnpm build` first, then `pnpm store:assets`; the files go to docs/store/assets/.
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { setStorage } from '../e2e/storage';

const root = path.resolve(import.meta.dirname, '..');
const extensionPath = path.join(root, '.output/chrome-mv3');
const outDir = path.join(root, 'docs/store/assets');
const VIEWPORT = { width: 1280, height: 800 };

// A made-up API response that shows what the viewer does: nesting, URLs, colors, dates, numbers.
const ORDERS = JSON.stringify({
  data: [
    {
      id: 1042,
      status: 'shipped',
      customer: { name: 'Ana Torres', email: 'ana@example.com', profile: 'https://example.com/customers/77' },
      items: [
        { sku: 'MUG-NIGHT', name: 'Night Sky mug', price: 12.5, quantity: 2, color: '#1e2a4a' },
        { sku: 'TEE-JSON', name: 'JSON t-shirt', price: 19.99, quantity: 1, color: '#61afef' },
      ],
      total: 44.99,
      paid: true,
      coupon: null,
      createdAt: '2026-10-12T09:30:00Z',
      shippedAt: 1760351400,
      tracking: 'https://track.example.com/1Z999AA10123456784',
    },
    {
      id: 1043,
      status: 'pending',
      customer: { name: 'Luis Ramírez', email: 'luis@example.com', profile: 'https://example.com/customers/81' },
      items: [{ sku: 'CAP-BRACE', name: '{ } cap', price: 15, quantity: 1, color: 'rgb(229, 192, 123)' }],
      total: 15,
      paid: false,
      coupon: 'WELCOME10',
      createdAt: '2026-10-13T14:05:00Z',
      shippedAt: null,
      tracking: null,
    },
  ],
  meta: { page: 1, perPage: 20, total: 2, next: null, links: { self: '/orders?page=1', docs: '/docs/orders' } },
});

const API_URL = 'https://api.example.com/v1/orders';
const ICON = `data:image/svg+xml;base64,${readFileSync(path.join(root, 'src/assets/icon.svg')).toString('base64')}`;

async function extensionId(context: BrowserContext): Promise<string> {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  return new URL(worker.url()).host;
}

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, name) });
  console.log('wrote', name);
}

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    locale: 'en-US',
    colorScheme: 'dark',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  // A realistic address in the toolbar; the response never leaves the machine.
  await context.route(API_URL, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: ORDERS }),
  );
  const id = await extensionId(context);
  const settings = (extra: Record<string, unknown>) =>
    setStorage(context, 'sync', {
      settings: { darkThemeId: 'night-sky', lightThemeId: 'github-light', viewer: { showArraySize: true }, ...extra },
    });

  try {
    const page = await context.newPage();

    // 1. The viewer, dark (Night Sky), with a date tooltip open.
    await settings({ themeMode: 'dark' });
    await page.goto(API_URL);
    const viewer = page.locator('json-viewer-app');
    await viewer.locator('.cm-content').waitFor();
    await viewer.locator('.cm-line span', { hasText: '1760351400' }).hover();
    await viewer.locator('.cm-jv-date').waitFor();
    await shot(page, '1-viewer-dark.png');

    // 2. The viewer, light, filtered with JSONPath.
    await settings({ themeMode: 'light' });
    await page.reload();
    await viewer.locator('.cm-content').waitFor();
    const filter = viewer.getByLabel('JSONPath filter');
    await filter.fill('$.data[?(@.paid == true)]');
    await filter.press('Enter');
    await viewer.locator('.jv-filter-active').waitFor();
    await shot(page, '2-viewer-light-filter.png');

    // 3. The options page with its live preview.
    await settings({ themeMode: 'dark' });
    await page.goto(`chrome-extension://${id}/options.html`);
    await page.getByRole('heading', { name: 'Appearance' }).waitFor();
    await shot(page, '3-options.png');

    // 4. The scratchpad.
    await page.goto(`chrome-extension://${id}/scratchpad.html`);
    await page.getByLabel('JSON input').fill(ORDERS);
    await page.locator('.sp-output .cm-content').waitFor();
    await shot(page, '4-scratchpad.png');

    // 5. Spanish: the viewer and the options page.
    await settings({ themeMode: 'dark', locale: 'es' });
    await page.goto(API_URL);
    await viewer.locator('.cm-content').waitFor();
    await shot(page, '5-viewer-es.png');
    await page.goto(`chrome-extension://${id}/options.html`);
    await page.getByRole('heading', { name: 'Apariencia' }).waitFor();
    await shot(page, '6-options-es.png');

    // Edge logo (300×300) and the small promo tile (440×280).
    const art = await context.newPage();
    await art.setViewportSize({ width: 300, height: 300 });
    await art.setContent(
      `<body style="margin:0"><img src="${ICON}" style="width:300px;height:300px;display:block"></body>`,
    );
    await art.locator('img').evaluate((img: HTMLImageElement) => img.decode());
    await art.screenshot({ path: path.join(outDir, 'logo-300.png'), omitBackground: true });
    console.log('wrote logo-300.png');
    await art.setViewportSize({ width: 440, height: 280 });
    await art.setContent(`
      <body style="margin:0;width:440px;height:280px;display:flex;align-items:center;gap:20px;padding:0 32px;box-sizing:border-box;
                   background:linear-gradient(135deg,#16191d,#1e2a4a);font-family:'Segoe UI',system-ui,sans-serif;color:#e6e6e6">
        <img src="${ICON}" style="width:112px;height:112px">
        <div>
          <div style="font-size:30px;font-weight:600;line-height:1.15">JSON Viewer<br>Extended</div>
          <div style="margin-top:10px;font-size:15px;color:#61afef">VS Code themes · Google Fonts</div>
        </div>
      </body>`);
    await art.locator('img').evaluate((img: HTMLImageElement) => img.decode());
    await art.screenshot({ path: path.join(outDir, 'promo-440x280.png') });
    console.log('wrote promo-440x280.png');
  } finally {
    await context.close();
  }
}

await main();
