import { shallowRef } from 'vue';
import {
  formatNumber,
  resolveLocale,
  translate,
  translateCount,
  type Locale,
  type LocaleSetting,
  type MessageKey,
  type Params,
  type PluralKey,
} from './translate';

export type { Locale, LocaleSetting, MessageKey, PluralKey } from './translate';
export { LOCALES } from './translate';

// One language per page (options, scratchpad, the content script's world). A ref, so templates and computeds
// that call t() update when it changes.
const current = shallowRef<Locale>('en');

export function getLocale(): Locale {
  return current.value;
}

export function setLocale(locale: Locale): void {
  current.value = locale;
}

/** Sets the page's language from the setting (`auto` follows the browser) and returns it. */
export function applyLocaleSetting(setting: LocaleSetting, languages: readonly string[] = navigator.languages): Locale {
  const locale = resolveLocale(setting, languages);
  setLocale(locale);
  return locale;
}

export function t(key: MessageKey, params?: Params): string {
  return translate(current.value, key, params);
}

/** Plural message for `count` (see translateCount). */
export function tc(key: PluralKey, count: number, params?: Params): string {
  return translateCount(current.value, key, count, params);
}

export function n(value: number): string {
  return formatNumber(current.value, value);
}

export type MessagePart = { text: string } | { slot: string };

/** Splits a message at its {placeholders}, so a template can put elements (links) in them. */
export function messageParts(message: string): MessagePart[] {
  const parts: MessagePart[] = [];
  let last = 0;
  for (const match of message.matchAll(/\{(\w+)\}/g)) {
    if (match.index > last) parts.push({ text: message.slice(last, match.index) });
    parts.push({ slot: match[1] ?? '' });
    last = match.index + match[0].length;
  }
  if (last < message.length) parts.push({ text: message.slice(last) });
  return parts;
}
