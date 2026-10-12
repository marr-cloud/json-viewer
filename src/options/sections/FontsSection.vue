<script setup lang="ts">
import { computed } from 'vue';
import NumberField from '../fields/NumberField.vue';
import SelectField from '../fields/SelectField.vue';
import ToggleField from '../fields/ToggleField.vue';
import { useFonts } from '../useFonts';
import { FONT_CATALOG } from '@/fonts/catalog';
import {
  FONT_FAMILY_PATTERN,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_SUBSETS,
  FONT_WEIGHTS,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  type FontSettings,
} from '@/settings/font';

const props = defineProps<{ font: FontSettings }>();
const { fonts, busy, error, download, remove } = useFonts();

const sourceOptions = [
  { value: 'system', label: 'Installed on this computer' },
  { value: 'google', label: 'Google Fonts (downloaded once, then works offline)' },
];
const weightLabels: Record<number, string> = { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold' };
const weightOptions = FONT_WEIGHTS.map((weight) => ({ value: String(weight), label: `${weightLabels[weight]} (${weight})` }));
const weight = computed({
  get: () => String(props.font.weight),
  set: (value: string) => {
    props.font.weight = Number(value);
  },
});

const isGoogle = computed(() => props.font.source === 'google');
const familyValid = computed(() => props.font.family === '' || FONT_FAMILY_PATTERN.test(props.font.family));
const downloaded = computed(() => fonts.value.find((item) => item.family === props.font.family) ?? null);
const canDownload = computed(
  () => props.font.family !== '' && familyValid.value && props.font.subsets.length > 0 && !busy.value,
);
const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`;

async function onDownload(): Promise<void> {
  const font = await download(props.font.family, props.font.subsets);
  // Google's spelling of the name is the key the viewer looks up.
  if (font) props.font.family = font.family;
}

async function onDelete(family: string): Promise<void> {
  if (window.confirm(`Delete the downloaded font "${family}"?`)) await remove(family);
}
</script>

<template>
  <section id="fonts" class="opt-section">
    <h2>Fonts</h2>
    <SelectField v-model="font.source" label="Font source" :options="sourceOptions" />
    <label class="opt-field">
      <span class="opt-label">Font family</span>
      <input
        v-model.trim="font.family"
        type="text"
        spellcheck="false"
        :list="isGoogle ? 'font-catalog' : undefined"
        :placeholder="isGoogle ? 'e.g. JetBrains Mono' : 'Default monospace font'"
      />
      <small class="opt-hint">{{
        isGoogle
          ? 'Pick a suggestion or type any Google Fonts family.'
          : 'A font installed on this computer, e.g. Cascadia Code. Leave empty for the default.'
      }}</small>
    </label>
    <datalist id="font-catalog">
      <option v-for="family in FONT_CATALOG" :key="family" :value="family" />
    </datalist>
    <p v-if="!familyValid" class="opt-errors" role="alert">Use letters, numbers, spaces, dots, dashes or underscores.</p>
    <template v-if="isGoogle">
      <fieldset class="opt-field opt-subsets">
        <legend class="opt-label">Character sets to download</legend>
        <label v-for="subset in FONT_SUBSETS" :key="subset" class="opt-subset">
          <input v-model="font.subsets" type="checkbox" :value="subset" />
          {{ subset }}
        </label>
      </fieldset>
      <div class="opt-row">
        <button type="button" :disabled="!canDownload" @click="onDownload">
          {{ busy ? 'Downloading…' : downloaded ? 'Download again' : 'Download' }}
        </button>
        <span class="opt-hint" role="status">{{
          downloaded ? `Downloaded (${kb(downloaded.bytes)})` : font.family ? 'Not downloaded yet' : ''
        }}</span>
      </div>
    </template>
    <NumberField v-model="font.sizePx" label="Font size (px)" :min="FONT_SIZE_MIN" :max="FONT_SIZE_MAX" />
    <NumberField v-model="font.lineHeight" label="Line height" :min="LINE_HEIGHT_MIN" :max="LINE_HEIGHT_MAX" :step="0.1" />
    <SelectField v-model="weight" label="Font weight" :options="weightOptions" />
    <ToggleField v-model="font.ligatures" label="Font ligatures" hint="Joins character pairs such as => in fonts that have them." />
    <h3 class="opt-subheading">Downloaded fonts</h3>
    <p v-if="fonts.length === 0" class="opt-hint">None yet.</p>
    <ul v-else class="opt-font-list">
      <li v-for="item in fonts" :key="item.family">
        <span>{{ item.family }} · {{ kb(item.bytes) }}</span>
        <button type="button" :aria-label="`Delete ${item.family}`" @click="onDelete(item.family)">Delete</button>
      </li>
    </ul>
    <p v-if="error" class="opt-errors" role="alert">{{ error }}</p>
  </section>
</template>
