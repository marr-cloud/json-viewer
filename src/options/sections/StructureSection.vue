<script setup lang="ts">
import NumberField from '../fields/NumberField.vue';
import ToggleField from '../fields/ToggleField.vue';
import { TAB_SIZE_MAX, TAB_SIZE_MIN } from '@/settings/schema';
import type { ViewerOptions } from '@/viewer/options';

defineProps<{ viewer: ViewerOptions }>();
</script>

<template>
  <section id="structure" class="opt-section">
    <h2>Structure</h2>
    <NumberField v-model="viewer.tabSize" label="Indent size (spaces)" :min="TAB_SIZE_MIN" :max="TAB_SIZE_MAX" />
    <ToggleField v-model="viewer.lineNumbers" label="Show line numbers" />
    <ToggleField v-model="viewer.lineWrapping" label="Wrap long lines" />
    <ToggleField v-model="viewer.foldGutter" label="Show fold arrows" />
    <ToggleField v-model="viewer.showArraySize" label="Show item counts on folded blocks" />
    <ToggleField v-model="viewer.indentCStyle" label="C-style braces" hint="Opening braces on their own line." />
  </section>
</template>
