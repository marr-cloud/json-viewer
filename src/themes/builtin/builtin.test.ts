import { describe, expect, it } from 'vitest';
import { parseCompactTheme } from '../validate';
import { builtinThemes, defaultLightTheme, defaultTheme, getBuiltinTheme } from './index';

const IDS = [
  'dark-plus', 'light-plus', 'one-dark-pro', 'dracula', 'github-dark', 'github-light', 'monokai', 'tokyo-night',
  'catppuccin-mocha', 'catppuccin-latte', 'nord', 'night-owl', 'solarized-dark', 'solarized-light', 'ayu-dark',
  'material-theme', 'night-sky',
];

describe('builtinThemes', () => {
  it('contains the 17 themes in order, Dark+ and Light+ first', () => {
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

  it('has Night Sky, One Dark Pro Night Flat with URLs in its own link blue', () => {
    const nightSky = getBuiltinTheme('night-sky')!;
    expect(nightSky).toMatchObject({ name: 'Night Sky', type: 'dark', source: 'builtin' });
    expect(nightSky.colors).toMatchObject({ background: '#16191d', foreground: '#abb2bf', string: '#98c379', link: '#61afef' });
  });
});
