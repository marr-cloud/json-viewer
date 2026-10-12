<script setup lang="ts">
import { ref } from 'vue';
import { comboFromEvent, IS_MAC, isValidShortcut, modifierHint, shortcutLabel } from '@/settings/shortcuts';

const props = withDefaults(
  defineProps<{ label: string; defaultValue: string; conflict?: string; /** Defaults to this platform. */ mac?: boolean }>(),
  { conflict: undefined, mac: IS_MAC },
);
const model = defineModel<string>({ required: true });
const recording = ref(false);
const invalid = ref(false);
// Key-ups that follow a recorded combination must not "click" the button again (Space would restart recording).
let swallowKeyup = false;

function toggle(): void {
  recording.value = !recording.value;
  invalid.value = false;
}

function finish(value?: string): void {
  if (value !== undefined) model.value = value;
  recording.value = false;
  invalid.value = false;
  swallowKeyup = true;
}

function onKeydown(event: KeyboardEvent): void {
  if (!recording.value) {
    swallowKeyup = false;
    return;
  }
  const plain = !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey;
  // Tab still moves focus, so the field never traps the keyboard.
  if (plain && event.code === 'Tab') {
    recording.value = false;
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (plain && event.code === 'Escape') return finish();
  if (plain && (event.code === 'Backspace' || event.code === 'Delete')) return finish('');
  const combo = comboFromEvent(event, props.mac);
  // A modifier on its own: wait for the rest of the combination.
  if (combo === null) return;
  if (isValidShortcut(combo)) finish(combo);
  else invalid.value = true;
}

function onKeyup(event: KeyboardEvent): void {
  if (recording.value || swallowKeyup) event.preventDefault();
}
</script>

<template>
  <div class="opt-field opt-shortcut">
    <span class="opt-label">{{ label }}</span>
    <div class="opt-shortcut-row">
      <button
        type="button"
        class="opt-shortcut-key"
        :class="{ 'opt-recording': recording }"
        :aria-label="`${label} shortcut`"
        :aria-pressed="recording"
        @click="toggle"
        @keydown="onKeydown"
        @keyup="onKeyup"
        @blur="recording = false"
      >
        {{ recording ? 'Press keys…' : model ? shortcutLabel(model, mac) : 'None' }}
      </button>
      <button v-if="model !== defaultValue" type="button" :aria-label="`Reset ${label} shortcut`" @click="model = defaultValue">
        Reset
      </button>
    </div>
    <small v-if="invalid" class="opt-hint opt-errors" role="alert">{{ modifierHint(mac) }}</small>
    <small v-else-if="conflict" class="opt-hint opt-errors">Also assigned to {{ conflict }}.</small>
  </div>
</template>
