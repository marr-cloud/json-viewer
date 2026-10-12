<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { parseHex, toHex } from '@/themes/color';
import { resolveColors } from '@/themes/resolve';
import { saveCustomTheme, uniqueThemeId } from '@/themes/store';
import { themeColorKeys, type Theme, type ThemeColorKey, type ThemeColors } from '@/themes/types';
import { parseCompactTheme } from '@/themes/validate';

const props = defineProps<{ initial: Theme; isNew: boolean; takenIds: string[] }>();
const emit = defineEmits<{ change: [theme: Theme]; saved: [theme: Theme]; cancel: [] }>();

const clone = (theme: Theme): Theme => JSON.parse(JSON.stringify(theme)) as Theme;
const start = clone(props.initial);
const draft = ref<Theme>({
  ...start,
  name: props.isNew ? `${start.name} (copy)` : start.name,
  source: 'custom',
});

const jsonText = ref('');
const jsonErrors = ref<string[]>([]);
const saveError = ref('');
let editingJson = false;

const resolved = computed(() => resolveColors(draft.value));
const canSave = computed(() => jsonErrors.value.length === 0 && draft.value.name.trim() !== '');

watch(
  draft,
  (theme) => {
    if (!editingJson) jsonText.value = JSON.stringify(theme, null, 2);
    emit('change', clone(theme));
  },
  { deep: true, immediate: true },
);

function hexOrNull(value: string): string | null {
  try {
    return toHex(parseHex(value));
  } catch {
    return null;
  }
}

function setColor(key: ThemeColorKey, value: string): void {
  const trimmed = value.trim();
  if (trimmed === '' && key !== 'background' && key !== 'foreground') {
    // Clearing an optional color makes it derived again.
    delete (draft.value.colors as Partial<ThemeColors>)[key];
    return;
  }
  const hex = hexOrNull(trimmed);
  if (hex !== null) draft.value.colors[key] = hex;
}

function onJsonInput(): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText.value);
  } catch (error) {
    jsonErrors.value = [`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`];
    return;
  }
  const result = parseCompactTheme({ ...(parsed as object), id: draft.value.id, source: 'custom' });
  if (!result.ok) {
    jsonErrors.value = result.errors;
    return;
  }
  jsonErrors.value = [];
  editingJson = true;
  draft.value = result.theme;
  // Let the deep watcher run before JSON edits are reflected back again.
  queueMicrotask(() => {
    editingJson = false;
  });
}

async function save(): Promise<void> {
  saveError.value = '';
  const id = props.isNew ? uniqueThemeId(draft.value.name, props.takenIds) : draft.value.id;
  const theme: Theme = { ...clone(draft.value), id, name: draft.value.name.trim(), source: 'custom' };
  try {
    await saveCustomTheme(theme);
    emit('saved', theme);
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : String(error);
  }
}
</script>

<template>
  <section class="opt-editor" aria-label="Theme editor">
    <h3>{{ isNew ? 'New theme' : 'Edit theme' }}</h3>
    <label class="opt-field">
      <span class="opt-label">Theme name</span>
      <input v-model="draft.name" type="text" />
    </label>
    <label class="opt-field">
      <span class="opt-label">Type</span>
      <select v-model="draft.type">
        <option value="dark">Dark</option>
        <option value="light">Light</option>
      </select>
    </label>
    <div class="opt-color-grid">
      <div v-for="key in themeColorKeys" :key="key" class="opt-color-row">
        <span class="opt-color-name">{{ key }}</span>
        <input
          type="color"
          :aria-label="`${key} picker`"
          :value="resolved[key].slice(0, 7)"
          @input="setColor(key, ($event.target as HTMLInputElement).value)"
        />
        <input
          type="text"
          :aria-label="`${key} hex`"
          :value="draft.colors[key] ?? ''"
          :placeholder="resolved[key]"
          spellcheck="false"
          @change="setColor(key, ($event.target as HTMLInputElement).value)"
        />
        <small v-if="!draft.colors[key]" class="opt-hint">derived</small>
      </div>
    </div>
    <label class="opt-field">
      <span class="opt-label">Theme JSON</span>
      <textarea v-model="jsonText" rows="12" spellcheck="false" @input="onJsonInput" />
    </label>
    <ul v-if="jsonErrors.length" class="opt-errors" role="alert">
      <li v-for="error in jsonErrors" :key="error">{{ error }}</li>
    </ul>
    <p v-if="saveError" class="opt-errors" role="alert">{{ saveError }}</p>
    <div class="opt-row">
      <button type="button" :disabled="!canSave" @click="save">Save theme</button>
      <button type="button" @click="emit('cancel')">Cancel</button>
    </div>
  </section>
</template>
