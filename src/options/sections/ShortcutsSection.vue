<script setup lang="ts">
import ShortcutField from '../fields/ShortcutField.vue';
import { t } from '@/i18n';
import {
  conflictWith,
  defaultShortcuts,
  SHORTCUT_ACTIONS,
  SHORTCUT_LABEL_KEYS,
  type ShortcutAction,
  type Shortcuts,
} from '@/settings/shortcuts';

const props = defineProps<{ shortcuts: Shortcuts }>();

function conflict(action: ShortcutAction): string | undefined {
  const other = conflictWith(props.shortcuts, action);
  return other === null ? undefined : t(SHORTCUT_LABEL_KEYS[other]);
}
</script>

<template>
  <section id="shortcuts" class="opt-section">
    <h2>{{ t('options.section.shortcuts') }}</h2>
    <p class="opt-hint">{{ t('options.shortcuts.hint') }}</p>
    <ShortcutField
      v-for="action in SHORTCUT_ACTIONS"
      :key="action"
      v-model="shortcuts[action]"
      :label="t(SHORTCUT_LABEL_KEYS[action])"
      :default-value="defaultShortcuts[action]"
      :conflict="conflict(action)"
    />
  </section>
</template>
