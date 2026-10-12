import { bool, intInRange, nonEmptyId, oneOf, validateFields, type ObjectValidators } from './fields';
import { defaultFontSettings, validateFontSettings, type FontSettings } from './font';
import { defaultShortcuts, validateShortcuts, type Shortcuts } from './shortcuts';
import { defaultViewerOptions, FOLD_LEVELS, type ViewerOptions } from '@/viewer/options';

export type ThemeMode = 'auto' | 'light' | 'dark';

export interface Settings {
  viewer: ViewerOptions;
  themeMode: ThemeMode;
  lightThemeId: string;
  darkThemeId: string;
  font: FontSettings;
  shortcuts: Shortcuts;
}

export const defaultSettings: Settings = {
  viewer: defaultViewerOptions,
  themeMode: 'auto',
  lightThemeId: 'light-plus',
  darkThemeId: 'dark-plus',
  font: defaultFontSettings,
  shortcuts: defaultShortcuts,
};

export const TAB_SIZE_MIN = 1;
export const TAB_SIZE_MAX = 10;

const viewerValidators: ObjectValidators<ViewerOptions> = {
  showHeader: bool,
  sortKeys: bool,
  clickableUrls: bool,
  wrapLinkWithAnchorTag: bool,
  openLinksInNewWindow: bool,
  autoHighlight: bool,
  lineNumbers: bool,
  lineWrapping: bool,
  foldGutter: bool,
  tabSize: intInRange(TAB_SIZE_MIN, TAB_SIZE_MAX),
  indentCStyle: bool,
  showArraySize: bool,
  foldFromLevel: oneOf<number>([0, ...FOLD_LEVELS]),
};

const settingsValidators: ObjectValidators<Settings> = {
  viewer: (value) => validateFields(value, defaultViewerOptions, viewerValidators),
  themeMode: oneOf<ThemeMode>(['auto', 'light', 'dark']),
  lightThemeId: nonEmptyId,
  darkThemeId: nonEmptyId,
  font: (value) => validateFontSettings(value),
  shortcuts: (value) => validateShortcuts(value),
};

/** Returns complete settings; every missing or invalid field falls back to its default. */
export function validateSettings(input: unknown): Settings {
  return validateFields(input, defaultSettings, settingsValidators);
}
