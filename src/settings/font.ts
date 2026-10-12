import {
  bool,
  intInRange,
  numberInRange,
  oneOf,
  validateFields,
  type FieldValidator,
  type ObjectValidators,
} from './fields';

export type FontSource = 'google' | 'system';

export interface FontSettings {
  source: FontSource;
  /** Empty means the default monospace stack. */
  family: string;
  sizePx: number;
  lineHeight: number;
  ligatures: boolean;
  weight: number;
  /** Google Fonts character sets to download. */
  subsets: string[];
}

export const FONT_SIZE_MIN = 8;
export const FONT_SIZE_MAX = 32;
export const LINE_HEIGHT_MIN = 1;
export const LINE_HEIGHT_MAX = 3;
export const FONT_WEIGHTS = [300, 400, 500, 600] as const;
export const FONT_SUBSETS = ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext', 'greek', 'greek-ext', 'vietnamese'] as const;
/** Letters, digits, spaces, dots, dashes and underscores: safe to quote inside a CSS font-family. */
export const FONT_FAMILY_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,79}$/u;

export const defaultFontSettings: FontSettings = {
  source: 'system',
  family: '',
  sizePx: 13,
  lineHeight: 1.5,
  ligatures: true,
  weight: 400,
  subsets: ['latin', 'latin-ext'],
};

const family: FieldValidator<string> = (value, fallback) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed === '' || FONT_FAMILY_PATTERN.test(trimmed) ? trimmed : fallback;
};

const subsets: FieldValidator<string[]> = (value, fallback) => {
  const known = Array.isArray(value) ? FONT_SUBSETS.filter((subset) => value.includes(subset)) : [];
  return known.length > 0 ? known : [...fallback];
};

const fontValidators: ObjectValidators<FontSettings> = {
  source: oneOf<FontSource>(['google', 'system']),
  family,
  sizePx: intInRange(FONT_SIZE_MIN, FONT_SIZE_MAX),
  lineHeight: numberInRange(LINE_HEIGHT_MIN, LINE_HEIGHT_MAX, 2),
  ligatures: bool,
  weight: oneOf<number>(FONT_WEIGHTS),
  subsets,
};

export function validateFontSettings(input: unknown): FontSettings {
  return validateFields(input, defaultFontSettings, fontValidators);
}
