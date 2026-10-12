<script setup lang="ts">
defineProps<{ source?: { url: string; loadedAt: Date } }>();
const mode = defineModel<'code' | 'raw'>('mode', { required: true });
</script>

<template>
  <header class="jv-toolbar">
    <div class="jv-modes" role="tablist">
      <button type="button" role="tab" :aria-selected="mode === 'code'" @click="mode = 'code'">Code</button>
      <button type="button" role="tab" :aria-selected="mode === 'raw'" @click="mode = 'raw'">Raw</button>
    </div>
    <div v-if="source" class="jv-source" :title="source.url">
      <span class="jv-url">{{ source.url }}</span>
      <time :datetime="source.loadedAt.toISOString()">{{ source.loadedAt.toLocaleString() }}</time>
    </div>
  </header>
</template>
