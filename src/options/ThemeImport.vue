<script setup lang="ts">
import { ref } from 'vue';
import { fromVSCode, ThemeImportError } from '@/themes/fromVSCode';
import { saveCustomTheme, uniqueThemeId } from '@/themes/store';
import type { Theme } from '@/themes/types';

const props = defineProps<{ takenIds: string[] }>();
const emit = defineEmits<{ imported: [theme: Theme] }>();

const text = ref('');
const errors = ref<string[]>([]);
const warnings = ref<string[]>([]);
const message = ref('');

async function importTheme(source: string): Promise<void> {
  errors.value = [];
  warnings.value = [];
  message.value = '';
  try {
    const result = fromVSCode(source, 'imported');
    const theme: Theme = { ...result.theme, id: uniqueThemeId(result.theme.name, props.takenIds) };
    await saveCustomTheme(theme);
    warnings.value = result.warnings;
    message.value = `Imported “${theme.name}” as a ${theme.type} theme.`;
    text.value = '';
    emit('imported', theme);
  } catch (error) {
    errors.value = error instanceof ThemeImportError ? error.errors : [error instanceof Error ? error.message : String(error)];
  }
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) await importTheme(await file.text());
}
</script>

<template>
  <div class="opt-import">
    <h3>Import a VS Code theme</h3>
    <p class="opt-hint">
      Paste a color theme's JSON (the <code>themes/*.json</code> file of a VS Code theme extension) or choose the file.
    </p>
    <label class="opt-field">
      <span class="opt-label">VS Code theme JSON</span>
      <textarea v-model="text" rows="6" spellcheck="false" />
    </label>
    <div class="opt-row">
      <button type="button" :disabled="!text.trim()" @click="importTheme(text)">Import</button>
      <label class="opt-file">
        Choose file…
        <input type="file" accept=".json,.jsonc,application/json" @change="onFile" />
      </label>
    </div>
    <p v-if="message" class="opt-success" role="status">{{ message }}</p>
    <ul v-if="warnings.length" class="opt-warnings">
      <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
    </ul>
    <ul v-if="errors.length" class="opt-errors" role="alert">
      <li v-for="error in errors" :key="error">{{ error }}</li>
    </ul>
  </div>
</template>
