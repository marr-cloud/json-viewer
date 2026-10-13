import { t } from '@/i18n';
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

/** Runs a network step (a request or reading its body); any failure means the connection broke. */
async function network<T>(step: () => Promise<T>): Promise<T> {
  try {
    return await step();
  } catch {
    throw new FontDownloadError(t('options.fonts.error.offline'));
  }
}

/** Downloads a Google Fonts family as base64 woff2 faces for the given character sets. */
export async function downloadFont(
  family: string,
  subsets: readonly string[],
  fetchImpl: FetchLike = (url) => fetch(url),
): Promise<StoredFont> {
  const response = await network(() => fetchImpl(css2Url(family)));
  if (response.status === 400) {
    throw new FontDownloadError(t('options.fonts.error.unknownFamily', { family }));
  }
  if (!response.ok) throw new FontDownloadError(t('options.fonts.error.status', { status: String(response.status) }));
  const parsed = parseCss2(await network(() => response.text()));
  const files = selectFaces(parsed, subsets);
  if (files.length === 0) throw new FontDownloadError(t('options.fonts.error.noFiles', { family }));

  const data = new Map<string, string>();
  const faces: StoredFontFace[] = [];
  let bytes = 0;
  for (const file of files) {
    let base64 = data.get(file.url);
    if (base64 === undefined) {
      const fileResponse = await network(() => fetchImpl(file.url));
      if (!fileResponse.ok) {
        throw new FontDownloadError(t('options.fonts.error.fileStatus', { status: String(fileResponse.status) }));
      }
      const buffer = new Uint8Array(await network(() => fileResponse.arrayBuffer()));
      bytes += buffer.byteLength;
      if (bytes > MAX_FONT_BYTES) {
        throw new FontDownloadError(t('options.fonts.error.tooLarge', { family }));
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
