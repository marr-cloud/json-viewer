import { storage } from '#imports';
import { browser } from 'wxt/browser';
import { getBuiltinTheme } from './builtin';
import type { Theme } from './types';
import { parseCompactTheme } from './validate';

// One sync item per theme keeps each well under storage.sync's 8 KB per-item quota.
const INDEX_KEY = 'sync:customThemeIds';
const themeKey = (id: string) => `sync:customTheme:${id}` as const;

export class ThemeValidationError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join('\n'));
    this.name = 'ThemeValidationError';
    this.errors = errors;
  }
}

const ID_MAX_BASE = 48;

export function uniqueThemeId(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base =
    name
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, ID_MAX_BASE)
      .replace(/-+$/, '') || 'theme';
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const id = `${base}-${n}`;
    if (!used.has(id)) return id;
  }
}

async function readIndex(): Promise<string[]> {
  const ids = await storage.getItem<unknown>(INDEX_KEY);
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
}

export async function listCustomThemes(): Promise<Theme[]> {
  const ids = await readIndex();
  if (ids.length === 0) return [];
  const items = await storage.getItems(ids.map(themeKey));
  return items.flatMap(({ value }) => {
    const result = parseCompactTheme(value);
    return result.ok ? [result.theme] : [];
  });
}

export async function saveCustomTheme(theme: Theme): Promise<void> {
  const result = parseCompactTheme({ ...theme, source: theme.source === 'builtin' ? 'custom' : theme.source });
  if (!result.ok) throw new ThemeValidationError(result.errors);
  if (getBuiltinTheme(theme.id)) throw new ThemeValidationError([`"${theme.id}" is a built-in theme id`]);
  await storage.setItem(themeKey(theme.id), result.theme);
  const ids = await readIndex();
  if (!ids.includes(theme.id)) await storage.setItem(INDEX_KEY, [...ids, theme.id]);
}

export async function deleteCustomTheme(id: string): Promise<void> {
  await storage.removeItem(themeKey(id));
  const ids = await readIndex();
  await storage.setItem(
    INDEX_KEY,
    ids.filter((existing) => existing !== id),
  );
}

export function watchCustomThemes(callback: () => void): () => void {
  const listener: Parameters<typeof browser.storage.onChanged.addListener>[0] = (changes, area) => {
    if (area !== 'sync') return;
    if (Object.keys(changes).some((key) => key === 'customThemeIds' || key.startsWith('customTheme:'))) callback();
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
