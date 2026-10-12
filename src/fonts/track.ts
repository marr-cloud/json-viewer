import { watch, type WatchSource } from 'vue';
import type { FontLoader } from './loader';
import { getFont, watchFont } from './store';

/**
 * Keeps `loader` in sync with the downloaded font named by `family` (empty = none): reapplies when the
 * family changes or its stored files change (e.g. downloaded later from the options page).
 */
export function trackStoredFont(family: WatchSource<string>, loader: Pick<FontLoader, 'apply'>): () => void {
  let latest = 0;
  let stopItem: (() => void) | undefined;
  const load = (name: string) => {
    const request = ++latest;
    getFont(name)
      .then((font) => {
        if (request === latest) loader.apply(font);
      })
      .catch((error: unknown) => console.warn('[json-viewer] font load failed', error));
  };
  const stopWatch = watch(
    family,
    (name) => {
      stopItem?.();
      stopItem = name ? watchFont(name, () => load(name)) : undefined;
      load(name);
    },
    { immediate: true },
  );
  return () => {
    latest++;
    stopWatch();
    stopItem?.();
  };
}
