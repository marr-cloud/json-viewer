<script setup lang="ts">
import NumberField from '../fields/NumberField.vue';
import ToggleField from '../fields/ToggleField.vue';
import { LIGHT_MODE_MAX_MB, LIGHT_MODE_MIN_MB, type Features, type ViewerOptions } from '@/viewer/options';

defineProps<{ features: Features; viewer: ViewerOptions }>();
</script>

<template>
  <section id="features" class="opt-section">
    <h2>Features</h2>
    <ToggleField v-model="features.jsonPath" label="JSONPath filter" hint="The filter box in the toolbar." />
    <ToggleField
      v-model="features.colorSwatches"
      label="Color swatches"
      hint="A small square next to values like #ff5500 or rgb(0, 128, 255)."
    />
    <ToggleField
      v-model="features.dateTooltips"
      label="Date tooltips"
      hint="Hover a Unix time or an ISO 8601 date to see it in local time and UTC."
    />
    <ToggleField
      v-model="features.imagePreview"
      label="Image previews"
      hint="Hover an image URL to see it. The image is loaded from its site."
    />
    <NumberField
      v-model="viewer.lightModeThresholdMB"
      label="Light mode above (MB)"
      :min="LIGHT_MODE_MIN_MB"
      :max="LIGHT_MODE_MAX_MB"
      hint="Bigger documents skip color swatches and date and image previews."
    />
  </section>
</template>
