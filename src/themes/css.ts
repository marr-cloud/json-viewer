import { themeColorKeys, type ThemeColorKey, type ThemeColors } from './types';

export function cssVarName(key: ThemeColorKey): string {
  return `--jv-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

export function toCssVars(colors: ThemeColors): Record<string, string> {
  return Object.fromEntries(themeColorKeys.map((key) => [cssVarName(key), colors[key]]));
}
