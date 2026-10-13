<script setup lang="ts">
import NumberField from '../fields/NumberField.vue';
import ToggleField from '../fields/ToggleField.vue';
import { t } from '@/i18n';
import { LIGHT_MODE_MAX_MB, LIGHT_MODE_MIN_MB, type Features, type ViewerOptions } from '@/viewer/options';

defineProps<{ features: Features; viewer: ViewerOptions }>();
</script>

<template>
  <section id="features" class="opt-section">
    <h2>{{ t('options.section.features') }}</h2>
    <ToggleField v-model="features.jsonPath" :label="t('options.features.jsonPath')" :hint="t('options.features.jsonPathHint')" />
    <ToggleField
      v-model="features.colorSwatches"
      :label="t('options.features.colorSwatches')"
      :hint="t('options.features.colorSwatchesHint')"
    />
    <ToggleField
      v-model="features.dateTooltips"
      :label="t('options.features.dateTooltips')"
      :hint="t('options.features.dateTooltipsHint')"
    />
    <ToggleField
      v-model="features.imagePreview"
      :label="t('options.features.imagePreview')"
      :hint="t('options.features.imagePreviewHint')"
    />
    <NumberField
      v-model="viewer.lightModeThresholdMB"
      :label="t('options.features.lightMode')"
      :min="LIGHT_MODE_MIN_MB"
      :max="LIGHT_MODE_MAX_MB"
      :hint="t('options.features.lightModeHint')"
    />
  </section>
</template>
