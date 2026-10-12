import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { deleteCustomTheme, listCustomThemes, saveCustomTheme, ThemeValidationError, uniqueThemeId, watchCustomThemes } from './store';
import type { Theme } from './types';

const theme = (id: string, name = id): Theme => ({
  id,
  name,
  type: 'dark',
  source: 'custom',
  colors: { background: '#FFF', foreground: '#000000' },
});

describe('uniqueThemeId', () => {
  it('slugifies names', () => {
    expect(uniqueThemeId('Dracula Theme', [])).toBe('dracula-theme');
    expect(uniqueThemeId('Café Night!', [])).toBe('cafe-night');
    expect(uniqueThemeId('***', [])).toBe('theme');
  });

  it('avoids taken ids', () => {
    expect(uniqueThemeId('Nord', ['nord'])).toBe('nord-2');
    expect(uniqueThemeId('Nord', ['nord', 'nord-2'])).toBe('nord-3');
  });

  it('keeps ids within the allowed length', () => {
    expect(uniqueThemeId('x'.repeat(200), []).length).toBeLessThanOrEqual(48);
  });
});

describe('custom theme store', () => {
  beforeEach(() => fakeBrowser.reset());

  it('saves, lists (normalized) and deletes themes', async () => {
    await saveCustomTheme(theme('one'));
    await saveCustomTheme(theme('two'));
    expect((await listCustomThemes()).map((t) => t.id)).toEqual(['one', 'two']);
    expect((await listCustomThemes())[0]?.colors.background).toBe('#ffffff');
    await deleteCustomTheme('one');
    expect((await listCustomThemes()).map((t) => t.id)).toEqual(['two']);
    expect((await fakeBrowser.storage.sync.get('customTheme:one'))['customTheme:one']).toBeUndefined();
  });

  it('updates an existing theme without duplicating its id', async () => {
    await saveCustomTheme(theme('one', 'First'));
    await saveCustomTheme(theme('one', 'Renamed'));
    const list = await listCustomThemes();
    expect(list.map((t) => t.name)).toEqual(['Renamed']);
  });

  it('rejects invalid themes and built-in ids', async () => {
    await expect(saveCustomTheme({ ...theme('one'), name: '' })).rejects.toBeInstanceOf(ThemeValidationError);
    await expect(saveCustomTheme(theme('dracula'))).rejects.toThrow('"dracula" is a built-in theme id');
  });

  it('skips corrupted stored entries', async () => {
    await saveCustomTheme(theme('good'));
    await fakeBrowser.storage.sync.set({ customThemeIds: ['good', 'bad'], 'customTheme:bad': { id: 'bad' } });
    expect((await listCustomThemes()).map((t) => t.id)).toEqual(['good']);
  });

  it('notifies watchers about theme changes only', async () => {
    let calls = 0;
    const stop = watchCustomThemes(() => calls++);
    await saveCustomTheme(theme('one'));
    const afterSave = calls;
    await fakeBrowser.storage.sync.set({ unrelated: 1 });
    expect(calls).toBe(afterSave);
    expect(afterSave).toBeGreaterThan(0);
    stop();
    await deleteCustomTheme('one');
    expect(calls).toBe(afterSave);
  });
});
