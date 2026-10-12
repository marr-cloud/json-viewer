import { mix, withAlpha } from './color';
import type { Theme, ThemeColors } from './types';

type TokenColors = Pick<ThemeColors, 'key' | 'string' | 'number' | 'boolean' | 'null' | 'link'>;

// VS Code Dark+ / Light+ JSON token colors.
const defaultTokenColors: Record<Theme['type'], TokenColors> = {
  dark: {
    key: '#9cdcfe',
    string: '#ce9178',
    number: '#b5cea8',
    boolean: '#569cd6',
    null: '#569cd6',
    link: '#3794ff',
  },
  light: {
    key: '#0451a5',
    string: '#a31515',
    number: '#098658',
    boolean: '#0000ff',
    null: '#0000ff',
    link: '#006ab1',
  },
};

/** Fills every color the theme leaves out, following spec §4.1. */
export function resolveColors(theme: Theme): ThemeColors {
  const { background, foreground } = theme.colors;
  const dark = theme.type === 'dark';
  const derived: ThemeColors = {
    background,
    foreground,
    gutterBackground: background,
    gutterForeground: withAlpha(foreground, 0.6),
    punctuation: withAlpha(foreground, 0.6),
    foldPlaceholder: withAlpha(foreground, 0.6),
    activeLine: withAlpha(foreground, 0.06),
    selection: withAlpha(foreground, 0.2),
    cursor: foreground,
    toolbarBackground: dark ? mix(background, '#000000', 0.04) : mix(background, '#ffffff', 0.04),
    border: mix(background, '#000000', 0.1),
    ...defaultTokenColors[theme.type],
  };
  const defined = Object.fromEntries(
    Object.entries(theme.colors).filter(([, value]) => value !== undefined),
  );
  return { ...derived, ...defined };
}
