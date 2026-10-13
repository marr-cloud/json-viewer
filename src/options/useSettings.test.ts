// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defaultSettings } from '@/settings/schema';
import { SAVE_DELAY_MS, useSettings } from './useSettings';

let app: App | undefined;

async function mountModel() {
  let model!: ReturnType<typeof useSettings>;
  app = createApp({
    setup() {
      model = useSettings();
      return () => null;
    },
  });
  app.mount(document.createElement('div'));
  await vi.waitFor(() => expect(model.loaded.value).toBe(true));
  return model;
}

describe('useSettings', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    app?.unmount();
    vi.useRealTimers();
  });

  it('loads stored settings', async () => {
    await fakeBrowser.storage.sync.set({ settings: { themeMode: 'dark' } });
    const model = await mountModel();
    expect(model.settings.value.themeMode).toBe('dark');
  });

  // WXT may also write version metadata ("settings$"), so count only writes of the settings value.
  const settingsWrites = (set: { mock: { calls: unknown[][] } }) =>
    set.mock.calls.filter(([items]) => typeof items === 'object' && items !== null && 'settings' in items).length;

  it('debounces many quick edits into one sync write', async () => {
    const model = await mountModel();
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set');
    for (let size = 1; size <= 8; size++) {
      model.settings.value.viewer.tabSize = size;
      await nextTick();
      vi.advanceTimersByTime(50);
    }
    expect(settingsWrites(set)).toBe(0);
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    await vi.waitFor(() => expect(settingsWrites(set)).toBe(1));
    expect((await fakeBrowser.storage.sync.get('settings')).settings).toMatchObject({ viewer: { tabSize: 8 } });
  });

  it('does not write when nothing changed', async () => {
    const model = await mountModel();
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set');
    model.settings.value.viewer.tabSize = 4;
    await nextTick();
    model.settings.value.viewer.tabSize = defaultSettings.viewer.tabSize;
    await nextTick();
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    await Promise.resolve();
    expect(settingsWrites(set)).toBe(0);
  });

  it('replace() saves the settings and CSS right away, without a second write later', async () => {
    const model = await mountModel();
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set');
    await model.replace({ ...structuredClone(defaultSettings), themeMode: 'dark' }, 'b{}');
    expect((await fakeBrowser.storage.sync.get('settings')).settings).toMatchObject({ themeMode: 'dark' });
    expect((await fakeBrowser.storage.local.get('customCss')).customCss).toBe('b{}');
    expect(model.settings.value.themeMode).toBe('dark');
    await nextTick();
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    await Promise.resolve();
    expect(settingsWrites(set)).toBe(1);
  });

  it('replace() rejects when storage refuses, and a later edit tries again', async () => {
    const model = await mountModel();
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set').mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'));
    await expect(model.replace({ ...structuredClone(defaultSettings), themeMode: 'dark' }, '')).rejects.toThrow('QUOTA_BYTES');
    model.settings.value.viewer.tabSize = 6;
    await nextTick();
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    await vi.waitFor(() => expect(settingsWrites(set)).toBe(2));
    expect((await fakeBrowser.storage.sync.get('settings')).settings).toMatchObject({ themeMode: 'dark', viewer: { tabSize: 6 } });
  });

  it('saves custom CSS to local storage and resets to defaults', async () => {
    const model = await mountModel();
    model.customCss.value = '.cm-content { color: red; }';
    model.settings.value.themeMode = 'light';
    await nextTick();
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    await vi.waitFor(async () =>
      expect((await fakeBrowser.storage.local.get('customCss')).customCss).toBe('.cm-content { color: red; }'),
    );
    model.reset();
    expect(model.settings.value).toEqual(defaultSettings);
    expect(model.customCss.value).toBe('');
  });
});
