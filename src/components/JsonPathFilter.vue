<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ active: boolean; error: string | null; disabled: boolean }>();
const emit = defineEmits<{ apply: [path: string]; clear: [] }>();
const text = defineModel<string>({ required: true });
const input = ref<HTMLInputElement>();

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault();
    // Read the field itself: the model only catches up after the parent re-renders.
    emit('apply', (event.target as HTMLInputElement).value);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    emit('clear');
  }
}

function clearAndFocus(): void {
  emit('clear');
  input.value?.focus();
}

defineExpose({
  focus(): void {
    input.value?.focus();
    input.value?.select();
  },
});
</script>

<template>
  <div class="jv-filter" :class="{ 'jv-filter-active': active }">
    <input
      ref="input"
      v-model="text"
      class="jv-filter-input"
      type="text"
      spellcheck="false"
      autocomplete="off"
      aria-label="JSONPath filter"
      placeholder="$.items[*].id"
      :title="disabled ? 'Fix the JSON error to filter' : 'JSONPath filter: Enter applies, Esc clears'"
      :disabled="disabled"
      :aria-invalid="error !== null"
      @keydown="onKeydown"
    />
    <button v-if="active" type="button" class="jv-icon-button" aria-label="Clear filter" title="Clear filter (Esc)" @click="clearAndFocus">
      ×
    </button>
    <p v-if="error" class="jv-filter-error" role="alert">{{ error }}</p>
  </div>
</template>
