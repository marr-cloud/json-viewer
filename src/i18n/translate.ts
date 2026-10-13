import { en } from './messages/en';
import { es } from './messages/es';

export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export type LocaleSetting = 'auto' | Locale;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
/** Keys with plural forms (`<key>.one`, `<key>.other`), named without the form. */
export type PluralKey = { [K in MessageKey]: K extends `${infer Base}.other` ? Base : never }[MessageKey];
export type Params = Record<string, string | number>;

const dictionaries: Record<Locale, Messages> = { en, es };

/** The language to show: the chosen one, or on `auto` the first of the browser's languages we have. */
export function resolveLocale(setting: LocaleSetting, languages: readonly string[]): Locale {
  if (setting !== 'auto') return setting;
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0] ?? '';
    if ((LOCALES as readonly string[]).includes(base)) return base as Locale;
  }
  return 'en';
}

export function formatNumber(locale: Locale, value: number): string {
  return value.toLocaleString(locale);
}

function fill(locale: Locale, text: string, params: Params | undefined): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    if (value === undefined) return placeholder;
    return typeof value === 'number' ? formatNumber(locale, value) : value;
  });
}

export function translate(locale: Locale, key: MessageKey, params?: Params): string {
  return fill(locale, dictionaries[locale][key], params);
}

/** The plural form of `key` for `count`, with `{count}` filled in. */
export function translateCount(locale: Locale, key: PluralKey, count: number, params?: Params): string {
  const form = new Intl.PluralRules(locale).select(count);
  const messages = dictionaries[locale] as Record<string, string>;
  const text = messages[`${key}.${form}`] ?? messages[`${key}.other`] ?? key;
  return fill(locale, text, { ...params, count });
}
