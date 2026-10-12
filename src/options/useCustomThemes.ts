import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { listCustomThemes, watchCustomThemes } from '@/themes/store';
import type { Theme } from '@/themes/types';

export function useCustomThemes(): { customThemes: Ref<Theme[]> } {
  const customThemes = ref<Theme[]>([]);
  const reload = async () => {
    customThemes.value = await listCustomThemes();
  };
  let stop: (() => void) | undefined;
  onMounted(() => {
    void reload();
    stop = watchCustomThemes(() => void reload());
  });
  onBeforeUnmount(() => stop?.());
  return { customThemes };
}
