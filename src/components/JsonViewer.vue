<script setup lang="ts">
import { computed, ref } from 'vue';
import CodeView from './CodeView.vue';
import ViewerToolbar from './ViewerToolbar.vue';
import { toCssVars } from '@/themes/css';
import { resolveColors } from '@/themes/resolve';
import type { Theme } from '@/themes/types';
import type { ViewerOptions } from '@/viewer/options';
import { prepareDocument } from '@/viewer/prepare';

const props = defineProps<{
  raw: string;
  options: ViewerOptions;
  theme: Theme;
  source?: { url: string; loadedAt: Date };
}>();

const prepared = computed(() => prepareDocument(props.raw, props.options));
const cssVars = computed(() => toCssVars(resolveColors(props.theme)));
// autoHighlight=false starts on Raw; the Code tab still formats on demand.
const mode = ref<'code' | 'raw'>(props.options.autoHighlight ? 'code' : 'raw');
</script>

<template>
  <div class="jv-root" :class="`jv-${theme.type}`" :style="cssVars">
    <ViewerToolbar v-model:mode="mode" :source="options.showHeader ? source : undefined" />
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
      :error-line="prepared.ok ? null : prepared.error.line"
    />
    <pre v-else class="jv-body jv-raw">{{ raw }}</pre>
  </div>
</template>
