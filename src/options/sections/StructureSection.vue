<script setup lang="ts">
import { computed } from 'vue';
import NumberField from '../fields/NumberField.vue';
import SelectField from '../fields/SelectField.vue';
import ToggleField from '../fields/ToggleField.vue';
import type { SelectOption } from '../types';
import { t } from '@/i18n';
import { TAB_SIZE_MAX, TAB_SIZE_MIN } from '@/settings/schema';
import { foldLevelLabel } from '@/viewer/foldLevelLabel';
import { FOLD_LEVELS, type ViewerOptions } from '@/viewer/options';

const props = defineProps<{ viewer: ViewerOptions }>();

const foldOptions = computed<SelectOption[]>(() => [
  { value: '0', label: t('options.structure.foldOff') },
  ...FOLD_LEVELS.map((level) => ({ value: String(level), label: foldLevelLabel(level) })),
]);
const foldFromLevel = computed({
  get: () => String(props.viewer.foldFromLevel),
  set: (value: string) => {
    props.viewer.foldFromLevel = Number(value);
  },
});
</script>

<template>
  <section id="structure" class="opt-section">
    <h2>{{ t('options.section.structure') }}</h2>
    <NumberField v-model="viewer.tabSize" :label="t('options.structure.tabSize')" :min="TAB_SIZE_MIN" :max="TAB_SIZE_MAX" />
    <ToggleField v-model="viewer.lineNumbers" :label="t('options.structure.lineNumbers')" />
    <ToggleField v-model="viewer.lineWrapping" :label="t('options.structure.lineWrapping')" />
    <ToggleField v-model="viewer.foldGutter" :label="t('options.structure.foldGutter')" />
    <SelectField
      v-model="foldFromLevel"
      :label="t('options.structure.foldOnOpen')"
      :options="foldOptions"
      :hint="t('options.structure.foldHint')"
    />
    <ToggleField v-model="viewer.showArraySize" :label="t('options.structure.arraySize')" />
    <ToggleField v-model="viewer.indentCStyle" :label="t('options.structure.cStyle')" :hint="t('options.structure.cStyleHint')" />
  </section>
</template>
