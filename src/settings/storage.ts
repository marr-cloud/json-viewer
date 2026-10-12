import { storage } from '#imports';
import { defaultSettings, validateSettings, type Settings } from './schema';
import { mergeUnknown } from './merge';

export const settingsItem = storage.defineItem<Settings>('sync:settings', {
  fallback: defaultSettings,
  version: 1,
});

// Local, not sync: a stylesheet can easily exceed sync's 8 KB per-item quota.
export const customCssItem = storage.defineItem<string>('local:customCss', { fallback: '' });

export async function loadSettings(): Promise<Settings> {
  return validateSettings(await settingsItem.getValue());
}

export async function saveSettings(settings: Settings): Promise<void> {
  // Keep fields this version doesn't know: a newer version on another device may have written them.
  const stored = await settingsItem.getValue();
  await settingsItem.setValue(mergeUnknown(stored, validateSettings(settings)));
}

export function watchSettings(callback: (settings: Settings) => void): () => void {
  return settingsItem.watch((value) => callback(validateSettings(value)));
}
