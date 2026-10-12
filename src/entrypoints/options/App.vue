<script setup lang="ts">
import { computed, ref } from 'vue';
import iconUrl from '@/assets/icon.svg';
import AppearanceSection from '@/options/sections/AppearanceSection.vue';
import FontsSection from '@/options/sections/FontsSection.vue';
import AboutSection from '@/options/sections/AboutSection.vue';
import AdvancedSection from '@/options/sections/AdvancedSection.vue';
import BehaviorSection from '@/options/sections/BehaviorSection.vue';
import StructureSection from '@/options/sections/StructureSection.vue';
import PreviewPane from '@/options/PreviewPane.vue';
import { useCustomThemes } from '@/options/useCustomThemes';
import { useSettings } from '@/options/useSettings';
import ThemeEditor from '@/options/ThemeEditor.vue';
import { builtinThemes } from '@/themes/builtin';
import type { ThemeSlot } from '@/options/types';
import type { Theme } from '@/themes/types';

const { settings, customCss, loaded, reset } = useSettings();
const { customThemes } = useCustomThemes();

const editing = ref<{ theme: Theme; isNew: boolean; slot: ThemeSlot } | null>(null);
const previewTheme = ref<Theme | null>(null);
const takenIds = computed(() => [...builtinThemes, ...customThemes.value].map((t) => t.id));

function startEditing(theme: Theme, isNew: boolean, slot: ThemeSlot | null): void {
  editing.value = { theme, isNew, slot: slot ?? theme.type };
}

function stopEditing(): void {
  editing.value = null;
  previewTheme.value = null;
}

function onSaved(theme: Theme): void {
  // The saved theme goes to the slot being edited, whatever its own type.
  const slot = editing.value?.slot ?? theme.type;
  if (slot === 'dark') settings.value.darkThemeId = theme.id;
  else settings.value.lightThemeId = theme.id;
  stopEditing();
}

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
        <a href="#fonts">Fonts</a>
        <a href="#behavior">Behavior</a>
        <a href="#structure">Structure</a>
        <a href="#advanced">Advanced</a>
        <a href="#about">About</a>
      </nav>
      <button type="button" class="opt-reset" @click="onReset">Reset to defaults</button>
    </aside>
    <main v-if="loaded" class="opt-main">
      <AppearanceSection :settings="settings" :custom-themes="customThemes" :editing="editing !== null" @edit="startEditing" />
      <ThemeEditor
        v-if="editing"
        :key="`${editing.theme.id}-${editing.isNew}`"
        :initial="editing.theme"
        :is-new="editing.isNew"
        :taken-ids="takenIds"
        @change="previewTheme = $event"
        @saved="onSaved"
        @cancel="stopEditing"
      />
      <FontsSection :font="settings.font" />
      <BehaviorSection :viewer="settings.viewer" />
      <StructureSection :viewer="settings.viewer" />
      <AdvancedSection v-model:custom-css="customCss" />
      <AboutSection />
    </main>
    <section class="opt-preview" aria-label="Live preview">
      <PreviewPane :settings="settings" :custom-css="customCss" :custom-themes="customThemes" :theme-override="previewTheme" />
    </section>
  </div>
</template>
