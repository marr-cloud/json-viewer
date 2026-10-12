export const themeColorKeys = [
  'background',
  'foreground',
  'gutterBackground',
  'gutterForeground',
  'activeLine',
  'selection',
  'cursor',
  'foldPlaceholder',
  'key',
  'string',
  'number',
  'boolean',
  'null',
  'punctuation',
  'link',
  'toolbarBackground',
  'border',
] as const;

export type ThemeColorKey = (typeof themeColorKeys)[number];
export type ThemeColors = Record<ThemeColorKey, string>;

export interface Theme {
  id: string;
  name: string;
  type: 'dark' | 'light';
  source: 'builtin' | 'imported' | 'custom';
  colors: Partial<ThemeColors> & Pick<ThemeColors, 'background' | 'foreground'>;
}
