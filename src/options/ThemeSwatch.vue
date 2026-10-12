<script setup lang="ts">
import { computed } from 'vue';
import { resolveColors } from '@/themes/resolve';
import type { Theme } from '@/themes/types';

const props = defineProps<{ theme: Theme }>();
const colors = computed(() => resolveColors(props.theme));
</script>

<template>
  <span class="opt-swatch" :style="{ background: colors.background, borderColor: colors.border }" aria-hidden="true">
    <i :style="{ background: colors.key }" />
    <i :style="{ background: colors.string }" />
    <i :style="{ background: colors.number }" />
    <i :style="{ background: colors.boolean }" />
  </span>
</template>
