import { describe, expect, it } from 'vitest';
import { defaultTheme } from './builtin';
import { cssVarName, toCssVars } from './css';
import { resolveColors } from './resolve';
import { themeColorKeys, type Theme } from './types';

const minimal = (type: Theme['type'], background: string, foreground: string): Theme => ({
  id: 't',
  name: 'T',
  type,
  source: 'custom',
  colors: { background, foreground },
});

describe('resolveColors', () => {
  it('returns every color of a fully specified theme unchanged', () => {
    expect(resolveColors(defaultTheme)).toEqual(defaultTheme.colors);
  });

  it('derives missing colors for a dark theme', () => {
    const colors = resolveColors(minimal('dark', '#1e1e1e', '#d4d4d4'));
    expect(colors).toMatchObject({
      gutterBackground: '#1e1e1e',
      gutterForeground: '#d4d4d499',
      punctuation: '#d4d4d499',
      foldPlaceholder: '#d4d4d499',
      activeLine: '#d4d4d40f',
      selection: '#d4d4d433',
      cursor: '#d4d4d4',
      toolbarBackground: '#1d1d1d',
      border: '#1b1b1b',
      key: '#9cdcfe',
      string: '#ce9178',
      link: '#3794ff',
    });
  });

  it('derives missing colors for a light theme', () => {
    const colors = resolveColors(minimal('light', '#ffffff', '#000000'));
    expect(colors).toMatchObject({
      toolbarBackground: '#ffffff',
      border: '#e6e6e6',
      key: '#0451a5',
      boolean: '#0000ff',
    });
  });

  it('ignores explicitly undefined colors', () => {
    const theme = minimal('dark', '#1e1e1e', '#d4d4d4');
    theme.colors.key = undefined;
    expect(resolveColors(theme).key).toBe('#9cdcfe');
  });
});

describe('toCssVars', () => {
  it('maps every key to a --jv- custom property', () => {
    expect(cssVarName('gutterForeground')).toBe('--jv-gutter-foreground');
    const vars = toCssVars(resolveColors(defaultTheme));
    expect(Object.keys(vars)).toHaveLength(themeColorKeys.length);
    expect(vars['--jv-background']).toBe('#1e1e1e');
    expect(vars['--jv-toolbar-background']).toBe('#252526');
  });
});
