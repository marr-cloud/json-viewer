import type { Theme } from '../types';
import darkPlus from './dark-plus.json';
import generated from './generated.json';
import lightPlus from './light-plus.json';

export const defaultTheme = darkPlus as Theme;
export const defaultLightTheme = lightPlus as Theme;

/** Built-in themes. Their ids are stored in user settings, so never rename them. */
export const builtinThemes: readonly Theme[] = [defaultTheme, defaultLightTheme, ...(generated as Theme[])];

export function getBuiltinTheme(id: string): Theme | undefined {
  return builtinThemes.find((theme) => theme.id === id);
}
