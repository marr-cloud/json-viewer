<script setup lang="ts">
import { defineAsyncComponent } from 'vue';

// Split out with @codemirror/lang-css so the options entry chunk stays small.
const CssEditor = defineAsyncComponent(() => import('../CssEditor.vue'));

const customCss = defineModel<string>('customCss', { required: true });
</script>

<template>
  <section id="advanced" class="opt-section">
    <h2>Advanced</h2>
    <p class="opt-hint">
      Custom CSS for the viewer. Useful selectors: <code>.jv-root</code>, <code>.jv-toolbar</code>,
      <code>.cm-editor</code>, <code>.cm-content</code>, <code>.cm-line</code>. Variables: <code>--jv-key</code>, <code>--jv-string</code>, <code>--jv-background</code>… Font variables
      (<code>--jv-font-family</code>, <code>--jv-font-size</code>…) come from the Fonts section; add
      <code>!important</code> to override them here.
    </p>
    <CssEditor v-model="customCss" />
  </section>
</template>
