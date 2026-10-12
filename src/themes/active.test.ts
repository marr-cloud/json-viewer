import { describe, expect, it } from 'vitest';
import { defaultSettings } from '@/settings/schema';
import { activeTheme, findTheme, pickThemeKind } from './active';
import { defaultLightTheme, defaultTheme, getBuiltinTheme } from './builtin';
import type { Theme } from './types';

const mine: Theme = { id: 'mine', name: 'Mine', type: 'dark', source: 'custom', colors: { background: '#000000', foreground: '#ffffff' } };

describe('pickThemeKind', () => {
  it.each([
    ['auto', true, null, 'dark'],
    ['auto', false, null, 'light'],
    ['light', true, null, 'light'],
    ['dark', false, null, 'dark'],
    ['dark', false, 'light', 'light'],
    ['auto', false, 'dark', 'dark'],
  ] as const)('%s, prefersDark=%s, override=%s → %s', (mode, prefersDark, override, expected) => {
    expect(pickThemeKind(mode, prefersDark, override)).toBe(expected);
  });
});

describe('findTheme', () => {
  it('finds built-in and custom themes', () => {
    expect(findTheme('dracula', [], 'dark')).toBe(getBuiltinTheme('dracula'));
    expect(findTheme('mine', [mine], 'dark')).toBe(mine);
  });

  it('falls back to Dark+ or Light+ for unknown ids', () => {
    expect(findTheme('ghost', [], 'dark')).toBe(defaultTheme);
    expect(findTheme('ghost', [mine], 'light')).toBe(defaultLightTheme);
  });
});

describe('activeTheme', () => {
  it('uses the slot that matches the resolved kind', () => {
    const settings = { ...defaultSettings, lightThemeId: 'github-light', darkThemeId: 'mine' };
    expect(activeTheme(settings, [mine], true, null)).toBe(mine);
    expect(activeTheme(settings, [mine], false, null)).toBe(getBuiltinTheme('github-light'));
    expect(activeTheme({ ...settings, themeMode: 'light' }, [mine], true, 'dark')).toBe(mine);
  });
});
