import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { downloadFont, FontDownloadError } from '@/fonts/download';
import { deleteFont, listFonts, saveFont, watchFontIndex } from '@/fonts/store';
import type { FontSummary, StoredFont } from '@/fonts/types';

export interface FontsModel {
  fonts: Ref<FontSummary[]>;
  busy: Ref<boolean>;
  error: Ref<string>;
  download(family: string, subsets: readonly string[]): Promise<StoredFont | null>;
  remove(family: string): Promise<void>;
}

const describe = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

export function useFonts(): FontsModel {
  const fonts = ref<FontSummary[]>([]);
  const busy = ref(false);
  const error = ref('');
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
      error.value = '';
      busy.value = true;
      try {
        const font = await downloadFont(family, subsets);
        await saveFont(font);
        await reload();
        return font;
      } catch (cause) {
        // Storage errors (e.g. the 10 MB local quota) are not download errors but still need a message.
        error.value = cause instanceof FontDownloadError ? cause.message : `Could not save the font: ${describe(cause)}`;
        return null;
      } finally {
        busy.value = false;
      }
    },
    async remove(family) {
      error.value = '';
      try {
        await deleteFont(family);
        await reload();
      } catch (cause) {
        error.value = `Could not delete the font: ${describe(cause)}`;
      }
    },
  };
}
