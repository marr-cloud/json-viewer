import { describe, expect, it, vi } from 'vitest';
import { css2Url, downloadFont, FontDownloadError, MAX_FONT_BYTES } from './download';

const CSS = `/* latin */
@font-face { font-family: 'Demo Mono'; font-style: normal; font-weight: 300; src: url(https://fonts.gstatic.com/s/demo/v1/var-latin.woff2) format('woff2'); unicode-range: U+0000-00FF; }
/* latin */
@font-face { font-family: 'Demo Mono'; font-style: normal; font-weight: 700; src: url(https://fonts.gstatic.com/s/demo/v1/var-latin.woff2) format('woff2'); unicode-range: U+0000-00FF; }
/* cyrillic */
@font-face { font-family: 'Demo Mono'; font-style: normal; font-weight: 400; src: url(https://fonts.gstatic.com/s/demo/v1/cyr.woff2) format('woff2'); unicode-range: U+0400-045F; }`;

const LATIN_FILE = 'https://fonts.gstatic.com/s/demo/v1/var-latin.woff2';

function fakeFetch(routes: Record<string, () => Response>) {
  return vi.fn(async (url: string) => {
    const route = routes[url];
    if (!route) throw new TypeError('Failed to fetch');
    return route();
  });
}

describe('downloadFont', () => {
  it('builds the css2 URL for every supported weight', () => {
    expect(css2Url('JetBrains Mono')).toBe(
      'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap',
    );
  });

  it('downloads each file once and stores the faces as base64', async () => {
    const fetchImpl = fakeFetch({
      [css2Url('Demo Mono')]: () => new Response(CSS),
      [LATIN_FILE]: () => new Response(new Uint8Array([1, 2, 3])),
    });
    const font = await downloadFont('Demo Mono', ['latin'], fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(font).toMatchObject({
      family: 'Demo Mono',
      bytes: 3,
      subsets: ['latin'],
      faces: [{ weight: '300 700', unicodeRange: 'U+0000-00FF', subset: 'latin', dataBase64: 'AQID' }],
    });
    expect(Number.isNaN(Date.parse(font.downloadedAt))).toBe(false);
  });

  it('reports an unknown family', async () => {
    const fetchImpl = fakeFetch({ [css2Url('Nope')]: () => new Response('bad', { status: 400 }) });
    await expect(downloadFont('Nope', ['latin'], fetchImpl)).rejects.toThrow('"Nope" is not a Google Fonts family.');
  });

  it('reports when no file matches the selected character sets', async () => {
    const fetchImpl = fakeFetch({ [css2Url('Demo Mono')]: () => new Response(CSS) });
    await expect(downloadFont('Demo Mono', ['greek'], fetchImpl)).rejects.toThrow(
      '"Demo Mono" has no files for the selected character sets.',
    );
  });

  it('reports network failures as download errors', async () => {
    await expect(downloadFont('Demo Mono', ['latin'], fakeFetch({}))).rejects.toBeInstanceOf(FontDownloadError);
    await expect(downloadFont('Demo Mono', ['latin'], fakeFetch({}))).rejects.toThrow('Could not reach Google Fonts');
  });

  it('reports a failed file download', async () => {
    const fetchImpl = fakeFetch({
      [css2Url('Demo Mono')]: () => new Response(CSS),
      [LATIN_FILE]: () => new Response('', { status: 404 }),
    });
    await expect(downloadFont('Demo Mono', ['latin'], fetchImpl)).rejects.toThrow('Font file download failed (404).');
  });

  it('refuses fonts over the size limit', async () => {
    const fetchImpl = fakeFetch({
      [css2Url('Demo Mono')]: () => new Response(CSS),
      [LATIN_FILE]: () => new Response(new Uint8Array(MAX_FONT_BYTES + 1)),
    });
    await expect(downloadFont('Demo Mono', ['latin'], fetchImpl)).rejects.toThrow('larger than 2 MB');
  });
});
