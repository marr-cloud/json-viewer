<script setup lang="ts">
const props = defineProps<{ label: string; min: number; max: number; hint?: string }>();
const model = defineModel<number>({ required: true });

function onChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  model.value = Number.isFinite(value) ? Math.min(props.max, Math.max(props.min, Math.round(value))) : props.min;
  input.value = String(model.value);
}
</script>

<template>
  <label class="opt-field">
    <span class="opt-label">{{ label }}</span>
    <input type="number" :min="min" :max="max" :value="model" @change="onChange" />
    <small v-if="hint" class="opt-hint">{{ hint }}</small>
  </label>
</template>
