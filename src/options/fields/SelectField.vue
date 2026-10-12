<script setup lang="ts">
import { computed } from 'vue';
import type { SelectOption } from '../types';

const props = defineProps<{ label: string; options: SelectOption[]; hint?: string }>();
const model = defineModel<string>({ required: true });

const groups = computed(() => {
  const map = new Map<string, SelectOption[]>();
  for (const option of props.options) {
    const group = option.group ?? '';
    map.set(group, [...(map.get(group) ?? []), option]);
  }
  return [...map.entries()];
});
</script>

<template>
  <label class="opt-field">
    <span class="opt-label">{{ label }}</span>
    <select v-model="model">
      <template v-for="[group, items] in groups" :key="group">
        <optgroup v-if="group" :label="group">
          <option v-for="option in items" :key="option.value" :value="option.value" :disabled="option.disabled">{{ option.label }}</option>
        </optgroup>
        <template v-else>
          <option v-for="option in items" :key="option.value" :value="option.value" :disabled="option.disabled">{{ option.label }}</option>
        </template>
      </template>
    </select>
    <small v-if="hint" class="opt-hint">{{ hint }}</small>
  </label>
</template>
