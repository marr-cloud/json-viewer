import { computed, onBeforeUnmount, onMounted, ref, shallowRef, type Ref } from 'vue';
import { downloadFont, FontDownloadError } from '@/fonts/download';
import { t } from '@/i18n';
import { deleteFont, listFonts, saveFont, watchFontIndex } from '@/fonts/store';
import type { FontSummary, StoredFont } from '@/fonts/types';

export interface FontsModel {
  fonts: Ref<FontSummary[]>;
  busy: Ref<boolean>;
  /** In the current language; follows a language change. */
  error: Readonly<Ref<string>>;
  download(family: string, subsets: readonly string[]): Promise<StoredFont | null>;
  remove(family: string): Promise<void>;
}

const describe = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

export function useFonts(): FontsModel {
  const fonts = ref<FontSummary[]>([]);
  const busy = ref(false);
  // A function, so the message is worded again when the language changes.
  const failure = shallowRef<(() => string) | null>(null);
  const error = computed(() => failure.value?.() ?? '');
  const reload = async () => {
    fonts.value = await listFonts();
  };
  let stop: (() => void) | undefined;
  onMounted(() => {
    void reload();
    stop = watchFontIndex(() => void reload());
  });
  onBeforeUnmount(() => stop?.());

  return {
    fonts,
    busy,
    error,
    async download(family, subsets) {
      failure.value = null;
      busy.value = true;
      try {
        const font = await downloadFont(family, subsets);
        await saveFont(font);
        await reload();
        return font;
      } catch (cause) {
        // Storage errors (e.g. the 10 MB local quota) are not download errors but still need a message.
        failure.value =
          cause instanceof FontDownloadError
            ? () => t(cause.key, cause.params)
            : () => t('options.fonts.saveFailed', { reason: describe(cause) });
        return null;
      } finally {
        busy.value = false;
      }
    },
    async remove(family) {
      failure.value = null;
      try {
        await deleteFont(family);
        await reload();
      } catch (cause) {
        failure.value = () => t('options.fonts.deleteFailed', { reason: describe(cause) });
      }
    },
  };
}
