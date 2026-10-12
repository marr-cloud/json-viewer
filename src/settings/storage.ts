import { storage } from '#imports';
import { defaultSettings, validateSettings, type Settings } from './schema';

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
  await settingsItem.setValue(validateSettings(settings));
}

export function watchSettings(callback: (settings: Settings) => void): () => void {
  return settingsItem.watch((value) => callback(validateSettings(value)));
}
