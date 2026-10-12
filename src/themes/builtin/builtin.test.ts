import { describe, expect, it } from 'vitest';
import { parseCompactTheme } from '../validate';
import { builtinThemes, defaultLightTheme, defaultTheme, getBuiltinTheme } from './index';

const IDS = [
  'dark-plus', 'light-plus', 'one-dark-pro', 'dracula', 'github-dark', 'github-light', 'monokai', 'tokyo-night',
  'catppuccin-mocha', 'catppuccin-latte', 'nord', 'night-owl', 'solarized-dark', 'solarized-light', 'ayu-dark',
  'material-theme',
];

describe('builtinThemes', () => {
  it('contains the 16 themes in order, Dark+ and Light+ first', () => {
    expect(builtinThemes.map((t) => t.id)).toEqual(IDS);
    expect(builtinThemes[0]).toBe(defaultTheme);
    expect(builtinThemes[1]).toBe(defaultLightTheme);
  });

  it('only contains valid built-in themes', () => {
    for (const theme of builtinThemes) {
      expect(parseCompactTheme(theme)).toEqual({ ok: true, theme });
      expect(theme.source).toBe('builtin');
    }
  });

  it('has the expected types and Dracula key color', () => {
    expect(defaultLightTheme.type).toBe('light');
    expect(getBuiltinTheme('github-light')?.type).toBe('light');
    expect(getBuiltinTheme('dracula')?.colors.key).toBe('#8be9fd');
    expect(getBuiltinTheme('nope')).toBeUndefined();
  });
});
