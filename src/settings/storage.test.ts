import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defaultSettings } from './schema';
import { customCssItem, loadSettings, saveSettings, watchSettings } from './storage';

describe('settings storage', () => {
  beforeEach(() => fakeBrowser.reset());

  it('loads the defaults when nothing is stored', async () => {
    expect(await loadSettings()).toEqual(defaultSettings);
  });

  it('round-trips saved settings through sync storage', async () => {
    const settings = { ...defaultSettings, themeMode: 'light' as const };
    await saveSettings(settings);
    expect(await loadSettings()).toEqual(settings);
    expect((await fakeBrowser.storage.sync.get('settings')).settings).toEqual(settings);
  });

  it('validates before saving', async () => {
    await saveSettings({ ...defaultSettings, viewer: { ...defaultSettings.viewer, tabSize: 99 } });
    expect((await loadSettings()).viewer.tabSize).toBe(10);
  });

  it('repairs corrupted stored settings on load', async () => {
    await fakeBrowser.storage.sync.set({ settings: { themeMode: 'neon', viewer: { tabSize: 'x', lineNumbers: false } } });
    const settings = await loadSettings();
    expect(settings.themeMode).toBe('auto');
    expect(settings.viewer.tabSize).toBe(2);
    expect(settings.viewer.lineNumbers).toBe(false);
  });

  it('notifies watchers with validated settings', async () => {
    const seen: string[] = [];
    const stop = watchSettings((settings) => seen.push(settings.themeMode));
    await fakeBrowser.storage.sync.set({ settings: { themeMode: 'dark' } });
    await fakeBrowser.storage.sync.set({ settings: { themeMode: 'neon' } });
    stop();
    await fakeBrowser.storage.sync.set({ settings: { themeMode: 'light' } });
    expect(seen).toEqual(['dark', 'auto']);
  });

  it('stores custom CSS locally with an empty default', async () => {
    expect(await customCssItem.getValue()).toBe('');
    await customCssItem.setValue('.cm-content { color: red; }');
    expect((await fakeBrowser.storage.local.get('customCss')).customCss).toBe('.cm-content { color: red; }');
  });
});
