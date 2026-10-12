<script setup lang="ts">
import { computed, ref } from 'vue';
import CodeView from './CodeView.vue';
import ViewerToolbar from './ViewerToolbar.vue';
import { fontCssVars } from '@/fonts/css';
import type { FontSettings } from '@/settings/font';
import { toCssVars } from '@/themes/css';
import { resolveColors } from '@/themes/resolve';
import type { Theme } from '@/themes/types';
import type { ViewerOptions } from '@/viewer/options';
import { prepareDocument } from '@/viewer/prepare';

const props = withDefaults(
  defineProps<{
    raw: string;
    options: ViewerOptions;
    theme: Theme;
    /** Resolved light/dark mode in effect; drives the toolbar toggle. Defaults to the theme's type. */
    kind?: 'light' | 'dark';
    customCss?: string;
    source?: { url: string; loadedAt: Date };
    toggleLabel?: string;
    font?: FontSettings;
  }>(),
  { customCss: '', kind: undefined, source: undefined, toggleLabel: undefined, font: undefined },
);
const emit = defineEmits<{ toggleTheme: []; openSettings: [] }>();

// Primitive computeds only notify when their value changes, so replacing the options
// object with unrelated changes (e.g. lineNumbers) doesn't re-run the formatter.
const tabSize = computed(() => props.options.tabSize);
const sortKeys = computed(() => props.options.sortKeys);
const indentCStyle = computed(() => props.options.indentCStyle);
const prepared = computed(() =>
  prepareDocument(props.raw, { tabSize: tabSize.value, sortKeys: sortKeys.value, indentCStyle: indentCStyle.value }),
);
const cssVars = computed(() => ({
  ...toCssVars(resolveColors(props.theme)),
  ...(props.font ? fontCssVars(props.font) : {}),
}));
// autoHighlight=false starts on Raw; the Code tab still formats on demand.
const mode = ref<'code' | 'raw'>(props.options.autoHighlight ? 'code' : 'raw');
</script>

<template>
  <div class="jv-root" :class="`jv-${theme.type}`" :style="cssVars">
    <component :is="'style'" v-if="customCss">{{ customCss }}</component>
    <ViewerToolbar
      v-model:mode="mode"
      :source="options.showHeader ? source : undefined"
      :kind="kind ?? theme.type"
      :toggle-label="toggleLabel"
      @toggle-theme="emit('toggleTheme')"
      @open-settings="emit('openSettings')"
    />
    <div v-if="!prepared.ok" class="jv-error" role="alert">
      {{ prepared.error.message
      }}<template v-if="prepared.error.line !== null">
        — line {{ prepared.error.line }}, column {{ prepared.error.column }}</template
      >
    </div>
    <CodeView
      v-if="mode === 'code'"
      class="jv-body"
      :doc="prepared.text"
      :options="options"
      :theme="theme"
      :error="prepared.ok ? null : prepared.error"
    />
    <pre v-else class="jv-body jv-raw">{{ raw }}</pre>
  </div>
</template>
