<script setup lang="ts">
import { computed } from 'vue';
import NumberField from '../fields/NumberField.vue';
import SelectField from '../fields/SelectField.vue';
import ToggleField from '../fields/ToggleField.vue';
import {
  FONT_FAMILY_PATTERN,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_WEIGHTS,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  type FontSettings,
} from '@/settings/font';

const props = defineProps<{ font: FontSettings }>();

const weightLabels: Record<number, string> = { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold' };
const weightOptions = FONT_WEIGHTS.map((weight) => ({ value: String(weight), label: `${weightLabels[weight]} (${weight})` }));
const weight = computed({
  get: () => String(props.font.weight),
  set: (value: string) => {
    props.font.weight = Number(value);
  },
});
const familyValid = computed(() => props.font.family === '' || FONT_FAMILY_PATTERN.test(props.font.family));
</script>

<template>
  <section id="fonts" class="opt-section">
    <h2>Fonts</h2>
    <label class="opt-field">
      <span class="opt-label">Font family</span>
      <input v-model.trim="font.family" type="text" spellcheck="false" placeholder="Default monospace font" />
      <small class="opt-hint">A font installed on this computer, e.g. Cascadia Code. Leave empty for the default.</small>
    </label>
    <p v-if="!familyValid" class="opt-errors" role="alert">Use letters, numbers, spaces, dots, dashes or underscores.</p>
    <NumberField v-model="font.sizePx" label="Font size (px)" :min="FONT_SIZE_MIN" :max="FONT_SIZE_MAX" />
    <NumberField v-model="font.lineHeight" label="Line height" :min="LINE_HEIGHT_MIN" :max="LINE_HEIGHT_MAX" :step="0.1" />
    <SelectField v-model="weight" label="Font weight" :options="weightOptions" />
    <ToggleField v-model="font.ligatures" label="Font ligatures" hint="Joins character pairs such as => in fonts that have them." />
  </section>
</template>
