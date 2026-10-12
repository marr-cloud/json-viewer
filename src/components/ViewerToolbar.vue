<script setup lang="ts">
import { FOLD_LEVELS, foldLevelLabel } from '@/viewer/options';

withDefaults(
  defineProps<{
    source?: { url: string; loadedAt: Date };
    kind: 'dark' | 'light';
    toggleLabel?: string;
    sorted: boolean;
    canFold: boolean;
    canMinify: boolean;
  }>(),
  { source: undefined, toggleLabel: 'Toggle light/dark theme' },
);
const emit = defineEmits<{
  toggleTheme: [];
  openSettings: [];
  foldAll: [];
  unfoldAll: [];
  foldLevel: [level: number];
  copy: [variant: 'formatted' | 'minified'];
  download: [];
  toggleSort: [];
}>();
const mode = defineModel<'code' | 'raw'>('mode', { required: true });

function onFoldLevel(event: Event): void {
  const select = event.target as HTMLSelectElement;
  const level = Number(select.value);
  // Back to the placeholder, so picking the same level again folds again.
  select.value = '';
  if (level > 0) emit('foldLevel', level);
}
</script>

<template>
  <header class="jv-toolbar">
    <div class="jv-modes" role="tablist">
      <button type="button" role="tab" :aria-selected="mode === 'code'" @click="mode = 'code'">Code</button>
      <button type="button" role="tab" :aria-selected="mode === 'raw'" @click="mode = 'raw'">Raw</button>
    </div>
    <slot name="filter" />
    <div v-if="source" class="jv-source" :title="source.url">
      <span class="jv-url">{{ source.url }}</span>
      <time :datetime="source.loadedAt.toISOString()">{{ source.loadedAt.toLocaleString() }}</time>
    </div>
    <div class="jv-actions">
      <div class="jv-group" role="group" aria-label="Folding">
        <button type="button" class="jv-icon-button" aria-label="Fold all" title="Fold all" :disabled="!canFold" @click="emit('foldAll')">
          ⊟
        </button>
        <button
          type="button"
          class="jv-icon-button"
          aria-label="Unfold all"
          title="Unfold all"
          :disabled="!canFold"
          @click="emit('unfoldAll')"
        >
          ⊞
        </button>
        <select class="jv-fold-level" aria-label="Fold to level" title="Fold to level" :disabled="!canFold" @change="onFoldLevel">
          <option value="">Levels</option>
          <option v-for="level in FOLD_LEVELS" :key="level" :value="String(level)">{{ foldLevelLabel(level) }}</option>
        </select>
      </div>
      <div class="jv-group" role="group" aria-label="Export">
        <button
          type="button"
          class="jv-icon-button"
          aria-label="Copy formatted JSON"
          title="Copy formatted JSON"
          @click="emit('copy', 'formatted')"
        >
          ⧉
        </button>
        <button
          type="button"
          class="jv-icon-button jv-wide"
          aria-label="Copy minified JSON"
          title="Copy minified JSON"
          :disabled="!canMinify"
          @click="emit('copy', 'minified')"
        >
          ⧉<small>min</small>
        </button>
        <button type="button" class="jv-icon-button" aria-label="Download JSON" title="Download JSON" @click="emit('download')">
          ⬇
        </button>
      </div>
      <button
        type="button"
        class="jv-icon-button"
        aria-label="Sort keys"
        title="Sort keys (this tab only)"
        :aria-pressed="sorted"
        @click="emit('toggleSort')"
      >
        ⇅
      </button>
      <button
        type="button"
        class="jv-icon-button"
        :aria-label="toggleLabel"
        :title="kind === 'dark' ? 'Switch to a light theme' : 'Switch to a dark theme'"
        @click="emit('toggleTheme')"
      >
        {{ kind === 'dark' ? '☀' : '☾' }}
      </button>
      <button type="button" class="jv-icon-button" aria-label="Open settings" title="Settings" @click="emit('openSettings')">
        ⚙
      </button>
    </div>
  </header>
</template>
