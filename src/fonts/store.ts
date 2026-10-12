import { storage } from '#imports';
import { isStoredFont, type FontSummary, type StoredFont } from './types';

// Local, not sync: font files are far larger than sync's quotas.
const INDEX_KEY = 'local:fontFamilies';
export const fontKey = (family: string) => `local:fonts/${family}` as const;

async function readIndex(): Promise<string[]> {
  const families = await storage.getItem<unknown>(INDEX_KEY);
  return Array.isArray(families) ? families.filter((family): family is string => typeof family === 'string') : [];
}

export async function saveFont(font: StoredFont): Promise<void> {
  await storage.setItem(fontKey(font.family), font);
  const index = await readIndex();
  if (!index.includes(font.family)) await storage.setItem(INDEX_KEY, [...index, font.family]);
}

export async function getFont(family: string): Promise<StoredFont | null> {
  if (!family) return null;
  const value = await storage.getItem<unknown>(fontKey(family));
  return isStoredFont(value) ? value : null;
}

export async function deleteFont(family: string): Promise<void> {
  await storage.removeItem(fontKey(family));
  const index = await readIndex();
  if (index.includes(family)) await storage.setItem(INDEX_KEY, index.filter((name) => name !== family));
}

export async function listFonts(): Promise<FontSummary[]> {
  const families = await readIndex();
  if (families.length === 0) return [];
  const items = await storage.getItems(families.map(fontKey));
  return items.flatMap(({ value }) =>
    isStoredFont(value)
      ? [{ family: value.family, bytes: value.bytes, subsets: value.subsets, downloadedAt: value.downloadedAt }]
      : [],
  );
}

export function watchFont(family: string, callback: () => void): () => void {
  return storage.watch(fontKey(family), () => callback());
}

export function watchFontIndex(callback: () => void): () => void {
  return storage.watch(INDEX_KEY, () => callback());
}
