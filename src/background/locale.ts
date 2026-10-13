import { resolveLocale, type Locale } from '@/i18n/translate';
import { loadSettings } from '@/settings/storage';

/** The language the background speaks (menus, the toolbar icon): the setting, or the browser's on `auto`. */
export async function backgroundLocale(languages: readonly string[] = navigator.languages): Promise<Locale> {
  try {
    return resolveLocale((await loadSettings()).locale, languages);
  } catch {
    return resolveLocale('auto', languages);
  }
}
