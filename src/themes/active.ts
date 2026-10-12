import type { Settings, ThemeMode } from '@/settings/schema';
import { defaultLightTheme, defaultTheme, getBuiltinTheme } from './builtin';
import type { Theme } from './types';

export type ThemeKind = 'light' | 'dark';

export function pickThemeKind(mode: ThemeMode, prefersDark: boolean, override: ThemeKind | null): ThemeKind {
  if (override !== null) return override;
  if (mode === 'auto') return prefersDark ? 'dark' : 'light';
  return mode;
}

/** Built-in or custom theme by id; unknown ids (deleted, or synced without the theme) fall back to Dark+/Light+. */
export function findTheme(id: string, customThemes: readonly Theme[], kind: ThemeKind): Theme {
  return (
    getBuiltinTheme(id) ??
    customThemes.find((theme) => theme.id === id) ??
    (kind === 'dark' ? defaultTheme : defaultLightTheme)
  );
}

export function activeTheme(
  settings: Pick<Settings, 'themeMode' | 'lightThemeId' | 'darkThemeId'>,
  customThemes: readonly Theme[],
  prefersDark: boolean,
  override: ThemeKind | null,
): Theme {
  const kind = pickThemeKind(settings.themeMode, prefersDark, override);
  return findTheme(kind === 'dark' ? settings.darkThemeId : settings.lightThemeId, customThemes, kind);
}
