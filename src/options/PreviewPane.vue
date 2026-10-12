<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { SAMPLE_JSON, SAMPLE_URL } from './sample';
import JsonViewer from '@/components/JsonViewer.vue';
import viewerCss from '@/components/viewer.css?inline';
import { createFontLoader } from '@/fonts/loader';
import { trackStoredFont } from '@/fonts/track';
import type { Settings } from '@/settings/schema';
import { activeTheme, pickThemeKind, toggledKind, type ThemeKind } from '@/themes/active';
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
// The viewer's custom CSS is a plain <style>; a shadow root keeps it from leaking into the options page.
const host = ref<HTMLDivElement>();
const shadowRoot = shallowRef<ShadowRoot>();
const viewerOptions = computed(() => ({ ...props.settings.viewer }));
const viewerFont = computed(() => ({ ...props.settings.font }));
let stopFont: (() => void) | undefined;
onMounted(() => {
  shadowRoot.value = host.value!.attachShadow({ mode: 'open' });
  media.addEventListener('change', onMediaChange);
  stopFont = trackStoredFont(
    () => (props.settings.font.source === 'google' ? props.settings.font.family : ''),
    createFontLoader(document.fonts),
  );
});
onBeforeUnmount(() => {
  media.removeEventListener('change', onMediaChange);
  stopFont?.();
});

const theme = computed(
  () => props.themeOverride ?? activeTheme(props.settings, props.customThemes, prefersDark.value, override.value),
);
const kind = computed(() => pickThemeKind(props.settings.themeMode, prefersDark.value, override.value));
const source = { url: SAMPLE_URL, loadedAt: new Date() };

function toggleTheme(): void {
  override.value = toggledKind(props.settings.themeMode, prefersDark.value, override.value);
}
</script>

<template>
  <div class="opt-preview-frame">
    <div ref="host" class="opt-preview-host" />
    <Teleport v-if="shadowRoot" :to="shadowRoot">
      <component :is="'style'">{{ viewerCss }}</component>
      <!-- autoHighlight only sets the initial tab, so remount when it changes. -->
      <JsonViewer
        :key="String(settings.viewer.autoHighlight)"
        :raw="SAMPLE_JSON"
        :options="viewerOptions"
        :font="viewerFont"
        :theme="theme"
        :kind="kind"
        :custom-css="customCss"
        :source="source"
        toggle-label="Preview: switch between light and dark"
        @toggle-theme="toggleTheme"
      />
    </Teleport>
  </div>
</template>
