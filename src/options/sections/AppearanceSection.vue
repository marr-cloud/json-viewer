<script setup lang="ts">
import { computed } from 'vue';
import SelectField from '../fields/SelectField.vue';
import ThemeImport from '../ThemeImport.vue';
import ThemeSwatch from '../ThemeSwatch.vue';
import type { SelectOption } from '../types';
import { defaultSettings, type Settings } from '@/settings/schema';
import { findTheme } from '@/themes/active';
import { builtinThemes } from '@/themes/builtin';
import { deleteCustomTheme } from '@/themes/store';
import type { Theme } from '@/themes/types';

const props = defineProps<{ settings: Settings; customThemes: Theme[] }>();

const modeOptions: SelectOption[] = [
  { value: 'auto', label: 'Follow the system' },
  { value: 'light', label: 'Always light' },
  { value: 'dark', label: 'Always dark' },
];

const themeOptions = computed<SelectOption[]>(() => [
  ...builtinThemes.filter((t) => t.type === 'light').map((t) => ({ value: t.id, label: t.name, group: 'Light themes' })),
  ...builtinThemes.filter((t) => t.type === 'dark').map((t) => ({ value: t.id, label: t.name, group: 'Dark themes' })),
  ...props.customThemes.map((t) => ({ value: t.id, label: `${t.name} (${t.type})`, group: 'Custom' })),
]);

const lightTheme = computed(() => findTheme(props.settings.lightThemeId, props.customThemes, 'light'));
const darkTheme = computed(() => findTheme(props.settings.darkThemeId, props.customThemes, 'dark'));
const takenIds = computed(() => [...builtinThemes, ...props.customThemes].map((t) => t.id));

function onImported(theme: Theme): void {
  if (theme.type === 'dark') props.settings.darkThemeId = theme.id;
  else props.settings.lightThemeId = theme.id;
}

async function remove(theme: Theme): Promise<void> {
  if (!window.confirm(`Delete “${theme.name}”?`)) return;
  await deleteCustomTheme(theme.id);
  if (props.settings.lightThemeId === theme.id) props.settings.lightThemeId = defaultSettings.lightThemeId;
  if (props.settings.darkThemeId === theme.id) props.settings.darkThemeId = defaultSettings.darkThemeId;
}
</script>

<template>
  <section id="appearance" class="opt-section">
    <h2>Appearance</h2>
    <SelectField v-model="settings.themeMode" label="Theme mode" :options="modeOptions" />
    <div class="opt-theme-row">
      <SelectField v-model="settings.lightThemeId" label="Light theme" :options="themeOptions" />
      <ThemeSwatch :theme="lightTheme" />
    </div>
    <div class="opt-theme-row">
      <SelectField v-model="settings.darkThemeId" label="Dark theme" :options="themeOptions" />
      <ThemeSwatch :theme="darkTheme" />
    </div>
    <ThemeImport :taken-ids="takenIds" @imported="onImported" />
    <div v-if="customThemes.length" class="opt-custom-list">
      <h3>Custom themes</h3>
      <ul>
        <li v-for="theme in customThemes" :key="theme.id" class="opt-row">
          <ThemeSwatch :theme="theme" />
          <span>{{ theme.name }}</span>
          <button type="button" :aria-label="`Delete ${theme.name}`" @click="remove(theme)">Delete</button>
        </li>
      </ul>
    </div>
  </section>
</template>
