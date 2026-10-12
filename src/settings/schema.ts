import { isRecord, nonEmptyString } from '@/shared/guards';
import { defaultViewerOptions, type ViewerOptions } from '@/viewer/options';

export type ThemeMode = 'auto' | 'light' | 'dark';

export interface Settings {
  viewer: ViewerOptions;
  themeMode: ThemeMode;
  lightThemeId: string;
  darkThemeId: string;
}

export const defaultSettings: Settings = {
  viewer: defaultViewerOptions,
  themeMode: 'auto',
  lightThemeId: 'light-plus',
  darkThemeId: 'dark-plus',
};

export const TAB_SIZE_MIN = 1;
export const TAB_SIZE_MAX = 10;

const THEME_MODES: readonly string[] = ['auto', 'light', 'dark'];

/** Returns complete settings; every missing or invalid field falls back to its default. */
export function validateSettings(input: unknown): Settings {
  const raw = isRecord(input) ? input : {};
  const rawViewer = isRecord(raw.viewer) ? raw.viewer : {};
  const viewer: ViewerOptions = { ...defaultViewerOptions };
  for (const key of Object.keys(defaultViewerOptions) as (keyof ViewerOptions)[]) {
    const value = rawViewer[key];
    if (key === 'tabSize') {
      if (typeof value === 'number' && Number.isFinite(value)) {
        viewer.tabSize = Math.min(TAB_SIZE_MAX, Math.max(TAB_SIZE_MIN, Math.round(value)));
      }
    } else if (typeof value === 'boolean') {
      (viewer as unknown as Record<string, boolean>)[key] = value;
    }
  }
  return {
    viewer,
    themeMode: THEME_MODES.includes(raw.themeMode as string) ? (raw.themeMode as ThemeMode) : defaultSettings.themeMode,
    lightThemeId: nonEmptyString(raw.lightThemeId) ?? defaultSettings.lightThemeId,
    darkThemeId: nonEmptyString(raw.darkThemeId) ?? defaultSettings.darkThemeId,
  };
}
