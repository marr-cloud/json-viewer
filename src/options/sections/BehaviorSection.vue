<script setup lang="ts">
import ToggleField from '../fields/ToggleField.vue';
import type { ViewerOptions } from '@/viewer/options';

defineProps<{ viewer: ViewerOptions }>();
</script>

<template>
  <section id="behavior" class="opt-section">
    <h2>Behavior</h2>
    <ToggleField v-model="viewer.showHeader" label="Show URL and load time in the toolbar" />
    <ToggleField v-model="viewer.autoHighlight" label="Format JSON automatically" hint="When off, pages open on the Raw tab." />
    <ToggleField v-model="viewer.sortKeys" label="Sort object keys" />
    <ToggleField v-model="viewer.clickableUrls" label="Make URLs clickable" />
    <ToggleField
      v-model="viewer.wrapLinkWithAnchorTag"
      label="Render URLs as real links"
      hint="Enables right-click › Copy link address."
    />
    <ToggleField v-model="viewer.openLinksInNewWindow" label="Open links in a new tab" />
  </section>
</template>
