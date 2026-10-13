<script setup lang="ts">
import { ref } from 'vue';
import { t, tc, type MessageKey } from '@/i18n';
import { backupFileName, createBackup, MAX_BACKUP_BYTES, parseBackup, type BackupError } from '@/settings/backup';
import { saveCustomTheme } from '@/themes/store';
import type { Theme } from '@/themes/types';
import { downloadText } from '@/viewer/download';
import type { SettingsModel } from './useSettings';

const props = defineProps<{ model: SettingsModel; customThemes: Theme[] }>();

const ERROR_KEYS: Record<BackupError, MessageKey> = {
  'too-large': 'options.backup.error.tooLarge',
  'not-json': 'options.backup.error.notJson',
  'not-a-backup': 'options.backup.error.notABackup',
  'newer-version': 'options.backup.error.newerVersion',
};

const fileInput = ref<HTMLInputElement>();
// Functions, so the messages follow a language change (an imported file can change the language).
const notes = ref<(() => string)[]>([]);
const error = ref<(() => string) | null>(null);

function exportSettings(): void {
  const now = new Date();
  const backup = createBackup({
    settings: props.model.settings.value,
    customCss: props.model.customCss.value,
    customThemes: props.customThemes,
    now,
  });
  downloadText(`${JSON.stringify(backup, null, 2)}\n`, backupFileName(now));
}

function fail(key: MessageKey): void {
  notes.value = [];
  error.value = () => t(key);
}

async function importSettings(): Promise<void> {
  const file = fileInput.value?.files?.[0];
  if (fileInput.value) fileInput.value.value = '';
  if (!file) return;
  if (file.size > MAX_BACKUP_BYTES) return fail(ERROR_KEYS['too-large']);
  let text: string;
  try {
    text = await file.text();
  } catch {
    return fail('options.backup.error.unreadable');
  }
  const result = parseBackup(text);
  if (!result.ok) return fail(ERROR_KEYS[result.error]);
  if (!window.confirm(t('options.backup.confirm', { file: file.name }))) return;

  const { settings, customCss, customThemes, skippedThemes } = result.backup;
  props.model.settings.value = settings;
  props.model.customCss.value = customCss;
  let failed = 0;
  for (const theme of customThemes) {
    try {
      await saveCustomTheme(theme);
    } catch {
      // storage.sync's quota (100 KB) is the only expected failure for a theme that already validated.
      failed++;
    }
  }
  const saved = customThemes.length - failed;
  error.value = null;
  notes.value = [
    () => t('options.backup.imported', { file: file.name }),
    ...(saved > 0 ? [() => tc('options.backup.themesSaved', saved)] : []),
    ...(skippedThemes > 0 ? [() => tc('options.backup.themesSkipped', skippedThemes)] : []),
  ];
  if (failed > 0) error.value = () => tc('options.backup.themesFailed', failed);
}

function reset(): void {
  if (window.confirm(t('options.reset.confirm'))) props.model.reset();
}
</script>

<template>
  <div class="opt-actions">
    <button type="button" :disabled="!model.loaded.value" @click="exportSettings">{{ t('options.backup.export') }}</button>
    <button type="button" :disabled="!model.loaded.value" @click="fileInput?.click()">
      {{ t('options.backup.import') }}
    </button>
    <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="importSettings" />
    <button type="button" :disabled="!model.loaded.value" @click="reset">{{ t('options.reset.button') }}</button>
    <small class="opt-hint">{{ t('options.backup.hint') }}</small>
    <p v-for="(note, index) in notes" :key="index" class="opt-hint" role="status">{{ note() }}</p>
    <p v-if="error" class="opt-hint opt-errors" role="alert">{{ error() }}</p>
  </div>
</template>
