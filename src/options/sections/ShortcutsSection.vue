<script setup lang="ts">
import ShortcutField from '../fields/ShortcutField.vue';
import {
  conflictWith,
  defaultShortcuts,
  SHORTCUT_ACTIONS,
  SHORTCUT_LABELS,
  type ShortcutAction,
  type Shortcuts,
} from '@/settings/shortcuts';

const props = defineProps<{ shortcuts: Shortcuts }>();

function conflict(action: ShortcutAction): string | undefined {
  const other = conflictWith(props.shortcuts, action);
  return other === null ? undefined : SHORTCUT_LABELS[other];
}
</script>

<template>
  <section id="shortcuts" class="opt-section">
    <h2>Shortcuts</h2>
    <p class="opt-hint">
      Click a shortcut and press the new keys. Backspace removes it, Esc cancels. Search, folding and the cursor
      path work on the Code tab.
    </p>
    <ShortcutField
      v-for="action in SHORTCUT_ACTIONS"
      :key="action"
      v-model="shortcuts[action]"
      :label="SHORTCUT_LABELS[action]"
      :default-value="defaultShortcuts[action]"
      :conflict="conflict(action)"
    />
  </section>
</template>
