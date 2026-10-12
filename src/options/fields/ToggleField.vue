<script setup lang="ts">
defineProps<{ label: string; hint?: string }>();
const model = defineModel<boolean>({ required: true });
</script>

<template>
  <label class="opt-field opt-toggle">
    <input v-model="model" type="checkbox" role="switch" />
    <span class="opt-label">{{ label }}</span>
    <small v-if="hint" class="opt-hint">{{ hint }}</small>
  </label>
</template>
