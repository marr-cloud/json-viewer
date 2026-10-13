<script setup lang="ts">
import ToggleField from '../fields/ToggleField.vue';
import { t } from '@/i18n';
import type { ViewerOptions } from '@/viewer/options';

defineProps<{ viewer: ViewerOptions }>();
</script>

<template>
  <section id="behavior" class="opt-section">
    <h2>{{ t('options.section.behavior') }}</h2>
    <ToggleField v-model="viewer.showHeader" :label="t('options.behavior.showHeader')" />
    <ToggleField
      v-model="viewer.autoHighlight"
      :label="t('options.behavior.autoHighlight')"
      :hint="t('options.behavior.autoHighlightHint')"
    />
    <ToggleField v-model="viewer.sortKeys" :label="t('options.behavior.sortKeys')" />
    <ToggleField v-model="viewer.clickableUrls" :label="t('options.behavior.clickableUrls')" />
    <ToggleField
      v-model="viewer.wrapLinkWithAnchorTag"
      :label="t('options.behavior.anchors')"
      :hint="t('options.behavior.anchorsHint')"
    />
    <ToggleField v-model="viewer.openLinksInNewWindow" :label="t('options.behavior.newTab')" />
  </section>
</template>
