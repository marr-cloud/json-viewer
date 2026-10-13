<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import iconUrl from '@/assets/icon.svg';
import { applyLocaleSetting, t } from '@/i18n';
import SelectField from '@/options/fields/SelectField.vue';
import SettingsActions from '@/options/SettingsActions.vue';
import AppearanceSection from '@/options/sections/AppearanceSection.vue';
import FontsSection from '@/options/sections/FontsSection.vue';
import AboutSection from '@/options/sections/AboutSection.vue';
import AdvancedSection from '@/options/sections/AdvancedSection.vue';
import BehaviorSection from '@/options/sections/BehaviorSection.vue';
import FeaturesSection from '@/options/sections/FeaturesSection.vue';
import StructureSection from '@/options/sections/StructureSection.vue';
import ShortcutsSection from '@/options/sections/ShortcutsSection.vue';
import SitesSection from '@/options/sections/SitesSection.vue';
import PreviewPane from '@/options/PreviewPane.vue';
import { useCustomThemes } from '@/options/useCustomThemes';
import { useSettings } from '@/options/useSettings';
import ThemeEditor from '@/options/ThemeEditor.vue';
import { builtinThemes } from '@/themes/builtin';
import type { SelectOption, ThemeSlot } from '@/options/types';
import type { Theme } from '@/themes/types';

const model = useSettings();
const { settings, customCss, loaded } = model;
const { customThemes } = useCustomThemes();

watchEffect(() => {
  document.documentElement.lang = applyLocaleSetting(settings.value.locale);
  document.title = t('options.title');
});

// Each language is named in itself, so it can be found whatever the current one.
const languageOptions = computed<SelectOption[]>(() => [
  { value: 'auto', label: t('options.language.auto') },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
]);

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
</script>

<template>
  <div class="opt-app">
    <aside class="opt-nav">
      <h1 class="opt-title"><img :src="iconUrl" alt="" width="24" height="24" /> JSON Viewer</h1>
      <nav :aria-label="t('options.nav.label')">
        <a href="#appearance">{{ t('options.section.appearance') }}</a>
        <a href="#fonts">{{ t('options.section.fonts') }}</a>
        <a href="#behavior">{{ t('options.section.behavior') }}</a>
        <a href="#structure">{{ t('options.section.structure') }}</a>
        <a href="#features">{{ t('options.section.features') }}</a>
        <a href="#shortcuts">{{ t('options.section.shortcuts') }}</a>
        <a href="#sites">{{ t('options.section.sites') }}</a>
        <a href="#advanced">{{ t('options.section.advanced') }}</a>
        <a href="#about">{{ t('options.section.about') }}</a>
      </nav>
      <!-- Only once loaded: a choice made earlier would be overwritten by the stored settings. -->
      <SelectField v-if="loaded" v-model="settings.locale" :label="t('options.language.label')" :options="languageOptions" />
      <SettingsActions :model="model" :custom-themes="customThemes" />
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
      <FeaturesSection :features="settings.features" :viewer="settings.viewer" />
      <ShortcutsSection :shortcuts="settings.shortcuts" />
      <SitesSection v-model:hosts="settings.excludedHosts" />
      <AdvancedSection v-model:custom-css="customCss" />
      <AboutSection />
    </main>
    <section class="opt-preview" :aria-label="t('options.preview.label')">
      <PreviewPane :settings="settings" :custom-css="customCss" :custom-themes="customThemes" :theme-override="previewTheme" />
    </section>
  </div>
</template>
