import type { BrowserContext } from '@playwright/test';

type StorageArea = 'sync' | 'local';
type ChromeStorage = { storage: Record<StorageArea, { set(items: Record<string, unknown>): Promise<void> }> };

/** Writes raw chrome.storage items from the extension's service worker (keys without WXT's "sync:"/"local:" prefix). */
export async function setStorage(context: BrowserContext, area: StorageArea, items: Record<string, unknown>): Promise<void> {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  await worker.evaluate(
    ([target, values]) => (globalThis as unknown as { chrome: ChromeStorage }).chrome.storage[target].set(values),
    [area, items] as const,
  );
}
