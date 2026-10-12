<script setup lang="ts">
import iconUrl from '@/assets/icon.svg';
import AppearanceSection from '@/options/sections/AppearanceSection.vue';
import AboutSection from '@/options/sections/AboutSection.vue';
import AdvancedSection from '@/options/sections/AdvancedSection.vue';
import BehaviorSection from '@/options/sections/BehaviorSection.vue';
import StructureSection from '@/options/sections/StructureSection.vue';
import PreviewPane from '@/options/PreviewPane.vue';
import { useCustomThemes } from '@/options/useCustomThemes';
import { useSettings } from '@/options/useSettings';

const { settings, customCss, loaded, reset } = useSettings();
const { customThemes } = useCustomThemes();

function onReset(): void {
  if (window.confirm('Reset all settings to their defaults? Custom themes are kept.')) reset();
}
</script>

<template>
  <div class="opt-app">
    <aside class="opt-nav">
      <h1 class="opt-title"><img :src="iconUrl" alt="" width="24" height="24" /> JSON Viewer</h1>
      <nav aria-label="Sections">
        <a href="#appearance">Appearance</a>
        <a href="#behavior">Behavior</a>
        <a href="#structure">Structure</a>
        <a href="#advanced">Advanced</a>
        <a href="#about">About</a>
      </nav>
      <button type="button" class="opt-reset" @click="onReset">Reset to defaults</button>
    </aside>
    <main v-if="loaded" class="opt-main">
      <AppearanceSection :settings="settings" :custom-themes="customThemes" />
      <BehaviorSection :viewer="settings.viewer" />
      <StructureSection :viewer="settings.viewer" />
      <AdvancedSection v-model:custom-css="customCss" />
      <AboutSection />
    </main>
    <section class="opt-preview" aria-label="Live preview">
      <PreviewPane :settings="settings" :custom-css="customCss" :custom-themes="customThemes" />
    </section>
  </div>
</template>
