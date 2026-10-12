import { isRecord } from '../shared/guards';
import { parseHex, toHex } from './color';
import { themeColorKeys, type Theme, type ThemeColorKey, type ThemeColors } from './types';

export const THEME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export type ThemeValidation = { ok: true; theme: Theme } | { ok: false; errors: string[] };

const SOURCES: readonly string[] = ['builtin', 'imported', 'custom'];

function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    return toHex(parseHex(value));
  } catch {
    return null;
  }
}

/** Validates an untrusted compact theme (storage, the editor's JSON, imports) and normalizes its colors. */
export function parseCompactTheme(input: unknown): ThemeValidation {
  if (!isRecord(input)) return { ok: false, errors: ['A theme must be a JSON object'] };
  const errors: string[] = [];

  const id = typeof input.id === 'string' ? input.id : '';
  if (!THEME_ID_PATTERN.test(id)) {
    errors.push('"id" must use lowercase letters, digits and dashes (max 64 characters)');
  }
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 80) : '';
  if (name === '') errors.push('"name" must be a non-empty string');
  const type = input.type;
  if (type !== 'dark' && type !== 'light') errors.push('"type" must be "dark" or "light"');
  const source = SOURCES.includes(input.source as string) ? (input.source as Theme['source']) : 'custom';

  const colors: Partial<ThemeColors> = {};
  if (!isRecord(input.colors)) {
    errors.push('"colors" must be an object');
  } else {
    for (const [key, value] of Object.entries(input.colors)) {
      if (!(themeColorKeys as readonly string[]).includes(key)) {
        errors.push(`Unknown color "${key}"`);
        continue;
      }
      const hex = normalizeHex(value);
      if (hex === null) errors.push(`"colors.${key}" must be a hex color like #1e1e1e`);
      else colors[key as ThemeColorKey] = hex;
    }
  }
  if (!colors.background) errors.push('"colors.background" is required');
  if (!colors.foreground) errors.push('"colors.foreground" is required');

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    theme: { id, name, type: type as Theme['type'], source, colors: colors as Theme['colors'] },
  };
}
