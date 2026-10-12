<script setup lang="ts">
import { browser } from 'wxt/browser';

const version = browser.runtime.getManifest().version;
</script>

<template>
  <section id="about" class="opt-section">
    <h2>About</h2>
    <p>JSON Viewer {{ version }} — inspired by <a href="https://github.com/tulios/json-viewer" target="_blank" rel="noopener">tulios/json-viewer</a>.</p>
    <p class="opt-hint">Built-in themes are converted from VS Code themes via tm-themes; see their <a href="/THEME-LICENSES.md" target="_blank" rel="noopener">licenses</a>.</p>
  </section>
</template>
