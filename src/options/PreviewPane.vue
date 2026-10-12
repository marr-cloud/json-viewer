<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { SAMPLE_JSON, SAMPLE_URL } from './sample';
import JsonViewer from '@/components/JsonViewer.vue';
import type { Settings } from '@/settings/schema';
import { activeTheme, type ThemeKind } from '@/themes/active';
import type { Theme } from '@/themes/types';

const props = defineProps<{
  settings: Settings;
  customCss: string;
  customThemes: Theme[];
  themeOverride?: Theme | null;
}>();

const media = window.matchMedia('(prefers-color-scheme: dark)');
const prefersDark = ref(media.matches);
const override = ref<ThemeKind | null>(null);
const onMediaChange = (event: MediaQueryListEvent) => {
  prefersDark.value = event.matches;
};
onMounted(() => media.addEventListener('change', onMediaChange));
onBeforeUnmount(() => media.removeEventListener('change', onMediaChange));

const theme = computed(
  () => props.themeOverride ?? activeTheme(props.settings, props.customThemes, prefersDark.value, override.value),
);
const source = { url: SAMPLE_URL, loadedAt: new Date() };

function toggleTheme(): void {
  override.value = theme.value.type === 'dark' ? 'light' : 'dark';
}
</script>

<template>
  <div class="opt-preview-frame">
    <!-- autoHighlight only sets the initial tab, so remount when it changes. -->
    <JsonViewer
      :key="String(settings.viewer.autoHighlight)"
      :raw="SAMPLE_JSON"
      :options="settings.viewer"
      :theme="theme"
      :custom-css="customCss"
      :source="source"
      @toggle-theme="toggleTheme"
    />
  </div>
</template>
