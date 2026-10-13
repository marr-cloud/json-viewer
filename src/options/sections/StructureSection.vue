<script setup lang="ts">
import { computed } from 'vue';
import NumberField from '../fields/NumberField.vue';
import SelectField from '../fields/SelectField.vue';
import ToggleField from '../fields/ToggleField.vue';
import type { SelectOption } from '../types';
import { TAB_SIZE_MAX, TAB_SIZE_MIN } from '@/settings/schema';
import { foldLevelLabel } from '@/viewer/foldLevelLabel';
import { FOLD_LEVELS, type ViewerOptions } from '@/viewer/options';

const props = defineProps<{ viewer: ViewerOptions }>();

const foldOptions: SelectOption[] = [
  { value: '0', label: 'Off' },
  ...FOLD_LEVELS.map((level) => ({ value: String(level), label: foldLevelLabel(level) })),
];
const foldFromLevel = computed({
  get: () => String(props.viewer.foldFromLevel),
  set: (value: string) => {
    props.viewer.foldFromLevel = Number(value);
  },
});
</script>

<template>
  <section id="structure" class="opt-section">
    <h2>Structure</h2>
    <NumberField v-model="viewer.tabSize" label="Indent size (spaces)" :min="TAB_SIZE_MIN" :max="TAB_SIZE_MAX" />
    <ToggleField v-model="viewer.lineNumbers" label="Show line numbers" />
    <ToggleField v-model="viewer.lineWrapping" label="Wrap long lines" />
    <ToggleField v-model="viewer.foldGutter" label="Show fold arrows" />
    <SelectField
      v-model="foldFromLevel"
      label="Fold on open"
      :options="foldOptions"
      hint="&quot;Show 1 level&quot; is the original extension's &quot;alwaysFold&quot;."
    />
    <ToggleField v-model="viewer.showArraySize" label="Show item counts on folded blocks" />
    <ToggleField v-model="viewer.indentCStyle" label="C-style braces" hint="Opening braces on their own line." />
  </section>
</template>
