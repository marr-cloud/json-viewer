<script setup lang="ts">
import { ref } from 'vue';
import { t } from '@/i18n';
import I18nText from '@/i18n/I18nText.vue';
import { saveCustomTheme, uniqueThemeId } from '@/themes/store';
import type { Theme } from '@/themes/types';

const props = defineProps<{ takenIds: string[] }>();
const emit = defineEmits<{ imported: [theme: Theme] }>();

const text = ref('');
const errors = ref<string[]>([]);
const warnings = ref<string[]>([]);
/** The theme just imported; the message about it is worded in the current language. */
const imported = ref<Theme | null>(null);
const importing = ref(false);
// Set once the converter has loaded on demand (it and jsonc-parser are only needed when importing).
let ImportError: typeof import('@/themes/fromVSCode').ThemeImportError | undefined;

async function importTheme(input: string | File): Promise<void> {
  errors.value = [];
  warnings.value = [];
  imported.value = null;
  importing.value = true;
  try {
    const source = typeof input === 'string' ? input : await input.text();
    const { fromVSCode, ThemeImportError } = await import('@/themes/fromVSCode');
    ImportError = ThemeImportError;
    const result = fromVSCode(source, 'imported');
    const theme: Theme = { ...result.theme, id: uniqueThemeId(result.theme.name, props.takenIds) };
    await saveCustomTheme(theme);
    warnings.value = result.warnings;
    imported.value = theme;
    text.value = '';
    emit('imported', theme);
  } catch (error) {
    errors.value = ImportError && error instanceof ImportError ? error.errors : [error instanceof Error ? error.message : String(error)];
  } finally {
    importing.value = false;
  }
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) await importTheme(file);
}
</script>

<template>
  <div class="opt-import">
    <h3>{{ t('options.import.title') }}</h3>
    <p class="opt-hint">
      <I18nText k="options.import.hint">
        <template #file><code>themes/*.json</code></template>
      </I18nText>
    </p>
    <label class="opt-field">
      <span class="opt-label">{{ t('options.import.json') }}</span>
      <textarea v-model="text" rows="6" spellcheck="false" />
    </label>
    <div class="opt-row">
      <button type="button" :disabled="!text.trim() || importing" @click="importTheme(text)">
        {{ t('options.import.button') }}
      </button>
      <label class="opt-file">
        {{ t('options.import.chooseFile') }}
        <input type="file" accept=".json,.jsonc,application/json" @change="onFile" />
      </label>
    </div>
    <p v-if="imported" class="opt-success" role="status">
      {{
        t('options.import.done', {
          name: imported.name,
          type: t(imported.type === 'dark' ? 'options.theme.typeDark' : 'options.theme.typeLight'),
        })
      }}
    </p>
    <ul v-if="warnings.length" class="opt-warnings">
      <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
    </ul>
    <ul v-if="errors.length" class="opt-errors" role="alert">
      <li v-for="error in errors" :key="error">{{ error }}</li>
    </ul>
  </div>
</template>
