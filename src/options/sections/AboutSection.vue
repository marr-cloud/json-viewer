<script setup lang="ts">
import { browser } from 'wxt/browser';
import { t } from '@/i18n';
import I18nText from '@/i18n/I18nText.vue';

const version = browser.runtime.getManifest().version;
</script>

<template>
  <section id="about" class="opt-section">
    <h2>{{ t('options.section.about') }}</h2>
    <p>
      {{ t('options.about.version', { version }) }} ·
      <a href="https://github.com/marr-cloud/json-viewer" target="_blank" rel="noopener">marr-cloud/json-viewer</a>
    </p>
    <p class="opt-hint">
      <I18nText k="options.about.inspired">
        <template #link>
          <a href="https://github.com/tulios/json-viewer" target="_blank" rel="noopener">tulios/json-viewer</a>
        </template>
      </I18nText>
    </p>
    <p class="opt-hint">
      <I18nText k="options.about.licenses">
        <template #link>
          <a href="/THEME-LICENSES.md" target="_blank" rel="noopener">{{ t('options.about.licensesLink') }}</a>
        </template>
      </I18nText>
    </p>
  </section>
</template>
