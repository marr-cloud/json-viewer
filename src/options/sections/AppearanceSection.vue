<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/i18n';
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

const modeOptions = computed<SelectOption[]>(() => [
  { value: 'auto', label: t('options.appearance.mode.auto') },
  { value: 'light', label: t('options.appearance.mode.light') },
  { value: 'dark', label: t('options.appearance.mode.dark') },
]);

const typeName = (theme: Theme) => t(theme.type === 'dark' ? 'options.theme.typeDark' : 'options.theme.typeLight');

const themeOptions = computed<SelectOption[]>(() => [
  ...builtinThemes
    .filter((theme) => theme.type === 'light')
    .map((theme) => ({ value: theme.id, label: theme.name, group: t('options.appearance.group.light') })),
  ...builtinThemes
    .filter((theme) => theme.type === 'dark')
    .map((theme) => ({ value: theme.id, label: theme.name, group: t('options.appearance.group.dark') })),
  ...props.customThemes.map((theme) => ({
    value: theme.id,
    label: t('options.appearance.customOption', { name: theme.name, type: typeName(theme) }),
    group: t('options.appearance.group.custom'),
  })),
]);

const known = (id: string) => builtinThemes.some((t) => t.id === id) || props.customThemes.some((t) => t.id === id);
/** A stored id that no longer exists would leave the <select> blank, so list it as a disabled "missing" option. */
function withMissing(id: string, fallback: string): SelectOption[] {
  if (known(id)) return themeOptions.value;
  return [{ value: id, label: t('options.appearance.missing', { id, fallback }), disabled: true }, ...themeOptions.value];
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
  if (!window.confirm(t('options.appearance.confirmDelete', { name: theme.name }))) return;
  await deleteCustomTheme(theme.id);
  if (props.settings.lightThemeId === theme.id) props.settings.lightThemeId = defaultSettings.lightThemeId;
  if (props.settings.darkThemeId === theme.id) props.settings.darkThemeId = defaultSettings.darkThemeId;
}
</script>

<template>
  <section id="appearance" class="opt-section">
    <h2>{{ t('options.section.appearance') }}</h2>
    <SelectField v-model="settings.themeMode" :label="t('options.appearance.mode')" :options="modeOptions" />
    <div class="opt-theme-row">
      <SelectField v-model="settings.lightThemeId" :label="t('options.appearance.lightTheme')" :options="lightOptions" />
      <ThemeSwatch :theme="lightTheme" />
      <!-- The accessible name comes from text, not aria-label: getByLabel('Light theme') must find only the select. -->
      <button type="button" @click="emit('edit', lightTheme, true, 'light')">
        <span aria-hidden="true">{{ t('options.appearance.duplicate') }}</span>
        <span class="opt-sr-only">{{ t('options.appearance.duplicateLight') }}</span>
      </button>
    </div>
    <div class="opt-theme-row">
      <SelectField v-model="settings.darkThemeId" :label="t('options.appearance.darkTheme')" :options="darkOptions" />
      <ThemeSwatch :theme="darkTheme" />
      <button type="button" @click="emit('edit', darkTheme, true, 'dark')">
        <span aria-hidden="true">{{ t('options.appearance.duplicate') }}</span>
        <span class="opt-sr-only">{{ t('options.appearance.duplicateDark') }}</span>
      </button>
    </div>
    <ThemeImport v-if="!editing" :taken-ids="takenIds" @imported="onImported" />
    <div v-if="customThemes.length" class="opt-custom-list">
      <h3>{{ t('options.appearance.customThemes') }}</h3>
      <ul>
        <li v-for="theme in customThemes" :key="theme.id" class="opt-row">
          <ThemeSwatch :theme="theme" />
          <span>{{ theme.name }}</span>
          <button
            type="button"
            :aria-label="t('options.appearance.editTheme', { name: theme.name })"
            @click="emit('edit', theme, false, null)"
          >
            {{ t('options.appearance.edit') }}
          </button>
          <button type="button" :aria-label="t('options.appearance.exportTheme', { name: theme.name })" @click="exportTheme(theme)">
            {{ t('options.appearance.export') }}
          </button>
          <button type="button" :aria-label="t('options.appearance.deleteTheme', { name: theme.name })" @click="remove(theme)">
            {{ t('options.appearance.delete') }}
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>
