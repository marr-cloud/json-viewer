import { describe, expect, it } from 'vitest';
import { defaultFontSettings, validateFontSettings } from './font';

describe('validateFontSettings', () => {
  it('defaults to the system font at 13px / 1.5', () => {
    expect(defaultFontSettings).toEqual({
      source: 'system',
      family: '',
      sizePx: 13,
      lineHeight: 1.5,
      ligatures: true,
      weight: 400,
      subsets: ['latin', 'latin-ext'],
    });
  });

  it('keeps valid values', () => {
    const font = {
      source: 'google',
      family: 'JetBrains Mono',
      sizePx: 16,
      lineHeight: 1.65,
      ligatures: false,
      weight: 500,
      subsets: ['latin', 'cyrillic'],
    };
    expect(validateFontSettings(font)).toEqual(font);
  });

  it('rejects family names that could break out of a CSS string', () => {
    for (const family of ['"; } body {', "Fira'Code", 'a\\b', '<b>', 'x'.repeat(81), 42]) {
      expect(validateFontSettings({ family }).family).toBe('');
    }
    expect(validateFontSettings({ family: '  Fira Code  ' }).family).toBe('Fira Code');
  });

  it('clamps sizes and limits source and weight', () => {
    expect(validateFontSettings({ sizePx: 4 }).sizePx).toBe(8);
    expect(validateFontSettings({ sizePx: 99 }).sizePx).toBe(32);
    expect(validateFontSettings({ lineHeight: 0.5 }).lineHeight).toBe(1);
    expect(validateFontSettings({ lineHeight: 1.234 }).lineHeight).toBe(1.23);
    expect(validateFontSettings({ weight: 700 }).weight).toBe(400);
    expect(validateFontSettings({ source: 'web' }).source).toBe('system');
  });

  it('keeps only known subsets in catalog order and never leaves the list empty', () => {
    expect(validateFontSettings({ subsets: ['cyrillic', 'latin', 'klingon'] }).subsets).toEqual(['latin', 'cyrillic']);
    expect(validateFontSettings({ subsets: [] }).subsets).toEqual(['latin', 'latin-ext']);
    expect(validateFontSettings({ subsets: 'latin' }).subsets).toEqual(['latin', 'latin-ext']);
  });

  it('never returns the shared default subsets array', () => {
    expect(validateFontSettings(undefined).subsets).not.toBe(defaultFontSettings.subsets);
  });
});
