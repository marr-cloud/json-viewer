<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { t } from '@/i18n';
import I18nText from '@/i18n/I18nText.vue';

// Split out with @codemirror/lang-css so the options entry chunk stays small.
const CssEditor = defineAsyncComponent(() => import('../CssEditor.vue'));

const customCss = defineModel<string>('customCss', { required: true });
</script>

<template>
  <section id="advanced" class="opt-section">
    <h2>{{ t('options.section.advanced') }}</h2>
    <p class="opt-hint">
      <I18nText k="options.advanced.hint">
        <template #selectors>
          <code>.jv-root</code>, <code>.jv-toolbar</code>, <code>.cm-editor</code>, <code>.cm-content</code>,
          <code>.cm-line</code>
        </template>
        <template #variables><code>--jv-key</code>, <code>--jv-string</code>, <code>--jv-background</code></template>
        <template #fontVariables><code>--jv-font-family</code>, <code>--jv-font-size</code></template>
        <template #important><code>!important</code></template>
      </I18nText>
    </p>
    <CssEditor v-model="customCss" />
  </section>
</template>
