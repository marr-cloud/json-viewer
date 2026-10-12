<script setup lang="ts">
import { computed } from 'vue';
import SelectField from '../fields/SelectField.vue';
import ThemeImport from '../ThemeImport.vue';
import ThemeSwatch from '../ThemeSwatch.vue';
import type { SelectOption, ThemeSlot } from '../types';
import { defaultSettings, type Settings } from '@/settings/schema';
import { findTheme } from '@/themes/active';
import { builtinThemes } from '@/themes/builtin';
import { deleteCustomTheme } from '@/themes/store';
import type { Theme } from '@/themes/types';

const props = defineProps<{ settings: Settings; customThemes: Theme[]; editing?: boolean }>();
const emit = defineEmits<{ edit: [theme: Theme, isNew: boolean, slot: ThemeSlot | null] }>();

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

const known = (id: string) => builtinThemes.some((t) => t.id === id) || props.customThemes.some((t) => t.id === id);
/** A stored id that no longer exists would leave the <select> blank, so list it as a disabled "missing" option. */
function withMissing(id: string, fallback: string): SelectOption[] {
  if (known(id)) return themeOptions.value;
  return [{ value: id, label: `Missing theme (${id}) — using ${fallback}`, disabled: true }, ...themeOptions.value];
}
const lightOptions = computed(() => withMissing(props.settings.lightThemeId, 'Light+'));
const darkOptions = computed(() => withMissing(props.settings.darkThemeId, 'Dark+'));

const lightTheme = computed(() => findTheme(props.settings.lightThemeId, props.customThemes, 'light'));
const darkTheme = computed(() => findTheme(props.settings.darkThemeId, props.customThemes, 'dark'));
const takenIds = computed(() => [...builtinThemes, ...props.customThemes].map((t) => t.id));

function onImported(theme: Theme): void {
  if (theme.type === 'dark') props.settings.darkThemeId = theme.id;
  else props.settings.lightThemeId = theme.id;
}

/** Downloads the compact theme JSON through a Blob URL (no permissions needed). */
function exportTheme(theme: Theme): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${theme.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
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
      <SelectField v-model="settings.lightThemeId" label="Light theme" :options="lightOptions" />
      <ThemeSwatch :theme="lightTheme" />
      <button type="button" @click="emit('edit', lightTheme, true, 'light')">Duplicate &amp; edit<span class="opt-sr-only"> light theme</span></button>
    </div>
    <div class="opt-theme-row">
      <SelectField v-model="settings.darkThemeId" label="Dark theme" :options="darkOptions" />
      <ThemeSwatch :theme="darkTheme" />
      <button type="button" @click="emit('edit', darkTheme, true, 'dark')">Duplicate &amp; edit<span class="opt-sr-only"> dark theme</span></button>
    </div>
    <ThemeImport v-if="!editing" :taken-ids="takenIds" @imported="onImported" />
    <div v-if="customThemes.length" class="opt-custom-list">
      <h3>Custom themes</h3>
      <ul>
        <li v-for="theme in customThemes" :key="theme.id" class="opt-row">
          <ThemeSwatch :theme="theme" />
          <span>{{ theme.name }}</span>
          <button type="button" :aria-label="`Edit ${theme.name}`" @click="emit('edit', theme, false, null)">Edit</button>
          <button type="button" :aria-label="`Export ${theme.name}`" @click="exportTheme(theme)">Export</button>
          <button type="button" :aria-label="`Delete ${theme.name}`" @click="remove(theme)">Delete</button>
        </li>
      </ul>
    </div>
  </section>
</template>
