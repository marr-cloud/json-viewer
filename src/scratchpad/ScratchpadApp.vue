<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { takeScratchpadInput } from './input';
import JsonViewer from '@/components/JsonViewer.vue';
import ViewerShadowRoot from '@/components/ViewerShadowRoot.vue';
import { sniffKind } from '@/detect/detect';
import type { ViewerSession } from '@/viewer/session';

const props = defineProps<{ session: ViewerSession }>();

/** Re-parse once typing pauses, not on every key: documents can be large. */
const INPUT_DELAY_MS = 250;

const input = ref('');
const raw = ref('');
const textarea = ref<HTMLTextAreaElement>();
let timer: ReturnType<typeof setTimeout> | undefined;

function show(text: string): void {
  clearTimeout(timer);
  raw.value = text;
}

function onInput(): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    raw.value = input.value;
  }, INPUT_DELAY_MS);
}

function clear(): void {
  input.value = '';
  show('');
  textarea.value?.focus();
}

function openSettings(): void {
  void browser.runtime.openOptionsPage();
}

const format = computed(() => sniffKind(raw.value));
const state = props.session.state;

onMounted(async () => {
  const handed = await takeScratchpadInput();
  if (handed !== '') {
    input.value = handed;
    show(handed);
  }
  textarea.value?.focus();
});
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div class="sp-app">
    <header class="sp-header">
      <h1 class="sp-title">JSON Scratchpad</h1>
      <span class="sp-hint">Paste JSON, JSONP or NDJSON on the left.</span>
      <button type="button" class="sp-button" :disabled="input === ''" @click="clear">Clear</button>
    </header>
    <textarea
      ref="textarea"
      v-model="input"
      class="sp-input"
      aria-label="JSON input"
      spellcheck="false"
      placeholder='{"paste": "JSON here"}'
      @input="onInput"
    />
    <div class="sp-output">
      <ViewerShadowRoot v-if="raw.trim() !== ''">
        <JsonViewer
          :raw="raw"
          :format="format"
          :options="state.settings.viewer"
          :font="state.settings.font"
          :shortcuts="state.settings.shortcuts"
          :features="state.settings.features"
          :theme="session.theme.value"
          :kind="session.kind.value"
          :custom-css="state.customCss"
          @toggle-theme="session.toggleTheme"
          @open-settings="openSettings"
        />
      </ViewerShadowRoot>
      <p v-else class="sp-empty">The formatted result appears here.</p>
    </div>
  </div>
</template>
