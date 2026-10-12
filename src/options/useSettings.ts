import { onMounted, ref, watch, type Ref } from 'vue';
import { defaultSettings, type Settings } from '@/settings/schema';
import { customCssItem, loadSettings, saveSettings } from '@/settings/storage';

// storage.sync allows ~120 writes per minute; typing in a field must not burst past that.
export const SAVE_DELAY_MS = 300;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

export interface SettingsModel {
  settings: Ref<Settings>;
  customCss: Ref<string>;
  loaded: Ref<boolean>;
  reset(): void;
}

export function useSettings(): SettingsModel {
  const settings = ref<Settings>(clone(defaultSettings));
  const customCss = ref('');
  const loaded = ref(false);
  let savedSettings = '';
  let savedCss = '';

  const flushSettings = debounce(() => {
    const json = JSON.stringify(settings.value);
    if (json === savedSettings) return;
    savedSettings = json;
    void saveSettings(JSON.parse(json) as Settings);
  }, SAVE_DELAY_MS);
  const flushCss = debounce(() => {
    if (customCss.value === savedCss) return;
    savedCss = customCss.value;
    void customCssItem.setValue(savedCss);
  }, SAVE_DELAY_MS);

  onMounted(async () => {
    settings.value = await loadSettings();
    customCss.value = await customCssItem.getValue();
    savedSettings = JSON.stringify(settings.value);
    savedCss = customCss.value;
    loaded.value = true;
  });

  watch(settings, () => loaded.value && flushSettings(), { deep: true });
  watch(customCss, () => loaded.value && flushCss());

  return {
    settings,
    customCss,
    loaded,
    reset() {
      settings.value = clone(defaultSettings);
      customCss.value = '';
    },
  };
}
