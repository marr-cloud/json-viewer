<script setup lang="ts">
withDefaults(
  defineProps<{ source?: { url: string; loadedAt: Date }; themeType: 'dark' | 'light'; toggleLabel?: string }>(),
  { source: undefined, toggleLabel: 'Toggle light/dark theme' },
);
const emit = defineEmits<{ toggleTheme: []; openSettings: [] }>();
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
    <div class="jv-actions">
      <button
        type="button"
        class="jv-icon-button"
        :aria-label="toggleLabel"
        :title="themeType === 'dark' ? 'Switch to a light theme' : 'Switch to a dark theme'"
        @click="emit('toggleTheme')"
      >
        {{ themeType === 'dark' ? '☀' : '☾' }}
      </button>
      <button type="button" class="jv-icon-button" aria-label="Open settings" title="Settings" @click="emit('openSettings')">
        ⚙
      </button>
    </div>
  </header>
</template>
