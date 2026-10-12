import { describe, expect, it } from 'vitest';
import { defaultViewerOptions } from '@/viewer/options';
import { defaultFontSettings } from './font';
import { defaultSettings, validateSettings } from './schema';
import { defaultShortcuts } from './shortcuts';

describe('validateSettings', () => {
  it('validates shortcuts per action', () => {
    const result = validateSettings({ shortcuts: { search: '', filter: 'nope' } });
    expect(result.shortcuts).toEqual({ ...defaultShortcuts, search: '' });
  });

  it('accepts only the offered fold levels', () => {
    for (const level of [0, 2, 3, 4, 5, 6]) {
      expect(validateSettings({ viewer: { foldFromLevel: level } }).viewer.foldFromLevel).toBe(level);
    }
    for (const level of [1, 7, -1, 2.5, '2', null]) {
      expect(validateSettings({ viewer: { foldFromLevel: level } }).viewer.foldFromLevel).toBe(0);
    }
  });

  it('returns the defaults for anything that is not an object', () => {
    for (const input of [undefined, null, 42, 'x', []]) {
      expect(validateSettings(input)).toEqual(defaultSettings);
    }
  });

  it('defaults to auto mode with Light+ and Dark+', () => {
    expect(defaultSettings).toEqual({
      viewer: defaultViewerOptions,
      themeMode: 'auto',
      lightThemeId: 'light-plus',
      darkThemeId: 'dark-plus',
      font: defaultFontSettings,
      shortcuts: defaultShortcuts,
    });
  });

  it('keeps valid values', () => {
    const input = {
      viewer: { ...defaultViewerOptions, sortKeys: true, tabSize: 4 },
      themeMode: 'dark',
      lightThemeId: 'github-light',
      darkThemeId: 'dracula',
      font: { ...defaultFontSettings, source: 'google', family: 'JetBrains Mono' },
      shortcuts: { ...defaultShortcuts, toggleRaw: 'Ctrl+Alt+R' },
    };
    expect(validateSettings(input)).toEqual(input);
  });

  it('replaces each invalid field with its default and keeps the rest', () => {
    const result = validateSettings({
      viewer: { lineNumbers: false, sortKeys: 'yes', tabSize: 'x', bogus: 1 },
      themeMode: 'neon',
      lightThemeId: '',
      darkThemeId: 'nord',
      extra: true,
    });
    expect(result).toEqual({
      viewer: { ...defaultViewerOptions, lineNumbers: false },
      themeMode: 'auto',
      lightThemeId: 'light-plus',
      darkThemeId: 'nord',
      font: defaultFontSettings,
      shortcuts: defaultShortcuts,
    });
  });

  it('clamps and rounds the tab size to 1..10', () => {
    expect(validateSettings({ viewer: { tabSize: 0 } }).viewer.tabSize).toBe(1);
    expect(validateSettings({ viewer: { tabSize: 99 } }).viewer.tabSize).toBe(10);
    expect(validateSettings({ viewer: { tabSize: 3.6 } }).viewer.tabSize).toBe(4);
    expect(validateSettings({ viewer: { tabSize: Number.NaN } }).viewer.tabSize).toBe(2);
  });

  it('never returns the shared default objects', () => {
    const result = validateSettings(undefined);
    expect(result.viewer).not.toBe(defaultViewerOptions);
  });
});
