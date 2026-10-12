import { readFile } from 'node:fs/promises';
import type { BrowserContext, Page } from '@playwright/test';
import { setStorage } from './storage';

export const TEST_FONT = 'Share Tech Mono';
const ASSETS = 'e2e/assets/fonts';

/** Stores the test font as if it had been downloaded from the options page. */
export async function seedTestFont(context: BrowserContext): Promise<void> {
  const data = await readFile(`${ASSETS}/share-tech-mono-latin-400.woff2`);
  await setStorage(context, 'local', {
    [`fonts/${TEST_FONT}`]: {
      family: TEST_FONT,
      faces: [{ weight: '400', unicodeRange: '', subset: 'latin', dataBase64: data.toString('base64') }],
      bytes: data.byteLength,
      subsets: ['latin'],
      downloadedAt: '2026-10-12T00:00:00.000Z',
    },
    fontFamilies: [TEST_FONT],
  });
}

/** True once document.fonts holds a loaded face for the family (content scripts share the page's FontFaceSet). */
export function hasLoadedFace(page: Page, family: string): Promise<boolean> {
  return page.evaluate((name) => {
    let found = false;
    document.fonts.forEach((face) => {
      if (face.family.replace(/["']/g, '') === name && face.status === 'loaded') found = true;
    });
    return found;
  }, family);
}

/** Serves the recorded Share Tech Mono css2 response and file; any other family answers 400 like Google does. */
export async function mockGoogleFonts(context: BrowserContext): Promise<void> {
  const css = await readFile(`${ASSETS}/share-tech-mono.css`, 'utf8');
  const woff2 = await readFile(`${ASSETS}/share-tech-mono-latin-400.woff2`);
  const cors = { 'access-control-allow-origin': '*' };
  await context.route('https://fonts.googleapis.com/css2**', (route) => {
    const family = new URL(route.request().url()).searchParams.get('family') ?? '';
    return family.startsWith(`${TEST_FONT}:`)
      ? route.fulfill({ status: 200, contentType: 'text/css', headers: cors, body: css })
      : route.fulfill({ status: 400, contentType: 'text/html', headers: cors, body: 'Bad Request' });
  });
  await context.route('https://fonts.gstatic.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'font/woff2', headers: cors, body: woff2 }),
  );
}
