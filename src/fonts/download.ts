import { bytesToBase64 } from './base64';
import { parseCss2, selectFaces } from './css2';
import type { StoredFont, StoredFontFace } from './types';

export type FetchLike = (url: string) => Promise<Response>;

export const GOOGLE_FONTS_CSS_URL = 'https://fonts.googleapis.com/css2';
/** Google silently leaves out the weights a family doesn't have. */
export const DOWNLOAD_WEIGHTS = [300, 400, 500, 600, 700];
/** Per family; storage.local holds about 10 MB in total. */
export const MAX_FONT_BYTES = 2 * 1024 * 1024;

export class FontDownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FontDownloadError';
  }
}

export function css2Url(family: string): string {
  const name = encodeURIComponent(family.trim()).replace(/%20/g, '+');
  return `${GOOGLE_FONTS_CSS_URL}?family=${name}:wght@${DOWNLOAD_WEIGHTS.join(';')}&display=swap`;
}

async function request(fetchImpl: FetchLike, url: string): Promise<Response> {
  try {
    return await fetchImpl(url);
  } catch {
    throw new FontDownloadError('Could not reach Google Fonts. Check your connection.');
  }
}

/** Downloads a Google Fonts family as base64 woff2 faces for the given character sets. */
export async function downloadFont(
  family: string,
  subsets: readonly string[],
  fetchImpl: FetchLike = (url) => fetch(url),
): Promise<StoredFont> {
  const response = await request(fetchImpl, css2Url(family));
  if (response.status === 400) throw new FontDownloadError(`"${family}" is not a Google Fonts family.`);
  if (!response.ok) throw new FontDownloadError(`Google Fonts answered ${response.status}.`);
  const parsed = parseCss2(await response.text());
  const files = selectFaces(parsed, subsets);
  if (files.length === 0) throw new FontDownloadError(`"${family}" has no files for the selected character sets.`);

  const data = new Map<string, string>();
  const faces: StoredFontFace[] = [];
  let bytes = 0;
  for (const file of files) {
    let base64 = data.get(file.url);
    if (base64 === undefined) {
      const fileResponse = await request(fetchImpl, file.url);
      if (!fileResponse.ok) throw new FontDownloadError(`Font file download failed (${fileResponse.status}).`);
      const buffer = new Uint8Array(await fileResponse.arrayBuffer());
      bytes += buffer.byteLength;
      if (bytes > MAX_FONT_BYTES) {
        throw new FontDownloadError(`"${family}" is larger than 2 MB; choose fewer character sets.`);
      }
      base64 = bytesToBase64(buffer);
      data.set(file.url, base64);
    }
    faces.push({ weight: file.weight, unicodeRange: file.unicodeRange, subset: file.subset, dataBase64: base64 });
  }
  return {
    family: parsed[0]!.family,
    faces,
    bytes,
    subsets: [...subsets],
    downloadedAt: new Date().toISOString(),
  };
}
