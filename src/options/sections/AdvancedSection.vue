<script setup lang="ts">
import CssEditor from '../CssEditor.vue';

const customCss = defineModel<string>('customCss', { required: true });
</script>

<template>
  <section id="advanced" class="opt-section">
    <h2>Advanced</h2>
    <p class="opt-hint">
      Custom CSS for the viewer. Useful selectors: <code>.jv-root</code>, <code>.jv-toolbar</code>,
      <code>.cm-editor</code>, <code>.cm-content</code>, <code>.cm-line</code>. Variables:
      <code>--jv-font-family</code>, <code>--jv-font-size</code>, <code>--jv-line-height</code> and the theme colors
      <code>--jv-key</code>, <code>--jv-string</code>, <code>--jv-background</code>…
    </p>
    <CssEditor v-model="customCss" />
  </section>
</template>
