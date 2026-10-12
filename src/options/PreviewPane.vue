<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { SAMPLE_JSON, SAMPLE_URL } from './sample';
import JsonViewer from '@/components/JsonViewer.vue';
import viewerCss from '@/components/viewer.css?inline';
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
// The viewer's custom CSS is a plain <style>; a shadow root keeps it from leaking into the options page.
const host = ref<HTMLDivElement>();
const shadowRoot = shallowRef<ShadowRoot>();
const viewerOptions = computed(() => ({ ...props.settings.viewer }));
onMounted(() => {
  shadowRoot.value = host.value!.attachShadow({ mode: 'open' });
  media.addEventListener('change', onMediaChange);
});
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
    <div ref="host" class="opt-preview-host" />
    <Teleport v-if="shadowRoot" :to="shadowRoot">
      <component :is="'style'">{{ viewerCss }}</component>
      <div class="opt-preview-root">
        <!-- autoHighlight only sets the initial tab, so remount when it changes. -->
        <JsonViewer
          :key="String(settings.viewer.autoHighlight)"
          :raw="SAMPLE_JSON"
          :options="viewerOptions"
          :theme="theme"
          :custom-css="customCss"
          :source="source"
          @toggle-theme="toggleTheme"
        />
      </div>
    </Teleport>
  </div>
</template>
