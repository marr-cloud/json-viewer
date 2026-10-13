<script setup lang="ts">
import { computed } from 'vue';
import { messageParts, t, type MessageKey } from '.';

// A message whose {placeholders} are filled with the named slots: <I18nText k="..."><template #link>…</template></I18nText>
const props = defineProps<{ k: MessageKey }>();
const parts = computed(() => messageParts(t(props.k)));
</script>

<template>
  <template v-for="(part, index) in parts" :key="index">
    <template v-if="'slot' in part"><slot :name="part.slot" /></template>
    <template v-else>{{ part.text }}</template>
  </template>
</template>
