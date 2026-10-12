<script setup lang="ts">
import { computed } from 'vue';
import CodeView from './CodeView.vue';
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
</script>

<template>
  <div class="jv-root" :class="`jv-${theme.type}`" :style="cssVars">
    <CodeView
      class="jv-body"
      :doc="prepared.text"
      :options="options"
      :theme="theme"
      :error-line="prepared.ok ? null : prepared.error.line"
    />
  </div>
</template>
