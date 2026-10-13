<script setup lang="ts">
import { computed } from 'vue';
import NumberField from '../fields/NumberField.vue';
import SelectField from '../fields/SelectField.vue';
import ToggleField from '../fields/ToggleField.vue';
import { useFonts } from '../useFonts';
import { canonicalFamily, FONT_CATALOG } from '@/fonts/catalog';
import { t, type MessageKey } from '@/i18n';
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

const sourceOptions = computed(() => [
  { value: 'system', label: t('options.fonts.source.system') },
  { value: 'google', label: t('options.fonts.source.google') },
]);
const weightOptions = computed(() =>
  FONT_WEIGHTS.map((weight) => ({
    value: String(weight),
    label: t('options.fonts.weightOption', {
      name: t(`options.fonts.weight.${weight}` as MessageKey),
      weight: String(weight),
    }),
  })),
);
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

/** Google Fonts names are case-sensitive: snap what was typed onto a catalog or downloaded spelling. */
function canonicalize(): void {
  props.font.family = canonicalFamily(props.font.family, [...FONT_CATALOG, ...fonts.value.map((item) => item.family)]);
}

async function onDownload(): Promise<void> {
  canonicalize();
  await download(props.font.family, props.font.subsets);
}

async function onDelete(family: string): Promise<void> {
  if (window.confirm(t('options.fonts.confirmDelete', { family }))) await remove(family);
}
</script>

<template>
  <section id="fonts" class="opt-section">
    <h2>{{ t('options.section.fonts') }}</h2>
    <SelectField v-model="font.source" :label="t('options.fonts.source')" :options="sourceOptions" />
    <label class="opt-field">
      <span class="opt-label">{{ t('options.fonts.family') }}</span>
      <input
        v-model.trim="font.family"
        type="text"
        spellcheck="false"
        @change="canonicalize"
        :list="isGoogle ? 'font-catalog' : undefined"
        :placeholder="isGoogle ? t('options.fonts.family.googlePlaceholder') : t('options.fonts.family.systemPlaceholder')"
      />
      <small class="opt-hint">{{
        isGoogle ? t('options.fonts.family.googleHint') : t('options.fonts.family.systemHint')
      }}</small>
    </label>
    <datalist id="font-catalog">
      <option v-for="family in FONT_CATALOG" :key="family" :value="family" />
    </datalist>
    <p v-if="!familyValid" class="opt-errors" role="alert">{{ t('options.fonts.family.invalid') }}</p>
    <template v-if="isGoogle">
      <fieldset class="opt-field opt-subsets">
        <legend class="opt-label">{{ t('options.fonts.subsets') }}</legend>
        <label v-for="subset in FONT_SUBSETS" :key="subset" class="opt-subset">
          <input v-model="font.subsets" type="checkbox" :value="subset" />
          {{ subset }}
        </label>
      </fieldset>
      <div class="opt-row">
        <button type="button" :disabled="!canDownload" @click="onDownload">
          {{
            busy
              ? t('options.fonts.downloading')
              : downloaded
                ? t('options.fonts.downloadAgain')
                : t('options.fonts.download')
          }}
        </button>
        <span class="opt-hint" role="status">{{
          downloaded
            ? t('options.fonts.downloaded', { size: kb(downloaded.bytes) })
            : font.family
              ? t('options.fonts.notDownloaded')
              : ''
        }}</span>
      </div>
    </template>
    <NumberField v-model="font.sizePx" :label="t('options.fonts.size')" :min="FONT_SIZE_MIN" :max="FONT_SIZE_MAX" />
    <NumberField
      v-model="font.lineHeight"
      :label="t('options.fonts.lineHeight')"
      :min="LINE_HEIGHT_MIN"
      :max="LINE_HEIGHT_MAX"
      :step="0.1"
    />
    <SelectField v-model="weight" :label="t('options.fonts.weight')" :options="weightOptions" />
    <ToggleField v-model="font.ligatures" :label="t('options.fonts.ligatures')" :hint="t('options.fonts.ligaturesHint')" />
    <h3 class="opt-subheading">{{ t('options.fonts.downloadedList') }}</h3>
    <p v-if="fonts.length === 0" class="opt-hint">{{ t('options.fonts.none') }}</p>
    <ul v-else class="opt-font-list">
      <li v-for="item in fonts" :key="item.family">
        <span>{{ item.family }} · {{ kb(item.bytes) }}</span>
        <button type="button" :aria-label="t('options.fonts.deleteFamily', { family: item.family })" @click="onDelete(item.family)">
          {{ t('options.fonts.delete') }}
        </button>
      </li>
    </ul>
    <p v-if="error" class="opt-errors" role="alert">{{ error }}</p>
  </section>
</template>
