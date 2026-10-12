<script setup lang="ts">
const props = withDefaults(defineProps<{ label: string; min: number; max: number; step?: number; hint?: string }>(), {
  step: 1,
  hint: undefined,
});
const model = defineModel<number>({ required: true });

function onChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  const stepped = Number.isFinite(value) ? Number((Math.round(value / props.step) * props.step).toFixed(2)) : props.min;
  model.value = Math.min(props.max, Math.max(props.min, stepped));
  input.value = String(model.value);
}
</script>

<template>
  <label class="opt-field">
    <span class="opt-label">{{ label }}</span>
    <input type="number" :min="min" :max="max" :step="step" :value="model" @change="onChange" />
    <small v-if="hint" class="opt-hint">{{ hint }}</small>
  </label>
</template>
