<script setup lang="ts">
import { getLocale, t } from '@/i18n';
import { foldLevelLabel } from '@/viewer/foldLevelLabel';
import { FOLD_LEVELS } from '@/viewer/options';

withDefaults(
  defineProps<{
    source?: { url: string; loadedAt: Date };
    kind: 'dark' | 'light';
    toggleLabel?: string;
    sorted: boolean;
    canFold: boolean;
    canMinify: boolean;
  }>(),
  { source: undefined, toggleLabel: undefined },
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
      <button type="button" role="tab" :aria-selected="mode === 'code'" @click="mode = 'code'">{{ t('viewer.mode.code') }}</button>
      <button type="button" role="tab" :aria-selected="mode === 'raw'" @click="mode = 'raw'">{{ t('viewer.mode.raw') }}</button>
    </div>
    <slot name="filter" />
    <div v-if="source" class="jv-source" :title="source.url">
      <span class="jv-url">{{ source.url }}</span>
      <time :datetime="source.loadedAt.toISOString()">{{ source.loadedAt.toLocaleString(getLocale()) }}</time>
    </div>
    <div class="jv-actions">
      <div class="jv-group" role="group" :aria-label="t('viewer.fold.group')">
        <button
          type="button"
          class="jv-icon-button"
          :aria-label="t('viewer.fold.all')"
          :title="t('viewer.fold.all')"
          :disabled="!canFold"
          @click="emit('foldAll')"
        >
          ⊟
        </button>
        <button
          type="button"
          class="jv-icon-button"
          :aria-label="t('viewer.fold.none')"
          :title="t('viewer.fold.none')"
          :disabled="!canFold"
          @click="emit('unfoldAll')"
        >
          ⊞
        </button>
        <select
          class="jv-fold-level"
          :aria-label="t('viewer.fold.toLevel')"
          :title="t('viewer.fold.toLevel')"
          :disabled="!canFold"
          @change="onFoldLevel"
        >
          <option value="">{{ t('viewer.fold.levels') }}</option>
          <option v-for="level in FOLD_LEVELS" :key="level" :value="String(level)">{{ foldLevelLabel(level) }}</option>
        </select>
      </div>
      <div class="jv-group" role="group" :aria-label="t('viewer.export.group')">
        <button
          type="button"
          class="jv-icon-button"
          :aria-label="t('viewer.copy.formatted')"
          :title="t('viewer.copy.formatted')"
          @click="emit('copy', 'formatted')"
        >
          ⧉
        </button>
        <button
          type="button"
          class="jv-icon-button jv-wide"
          :aria-label="t('viewer.copy.minified')"
          :title="t('viewer.copy.minified')"
          :disabled="!canMinify"
          @click="emit('copy', 'minified')"
        >
          ⧉<small>min</small>
        </button>
        <button
          type="button"
          class="jv-icon-button"
          :aria-label="t('viewer.download')"
          :title="t('viewer.download')"
          @click="emit('download')"
        >
          ⬇
        </button>
      </div>
      <button
        type="button"
        class="jv-icon-button"
        :aria-label="t('viewer.sort.label')"
        :title="t('viewer.sort.title')"
        :aria-pressed="sorted"
        @click="emit('toggleSort')"
      >
        ⇅
      </button>
      <button
        type="button"
        class="jv-icon-button"
        :aria-label="toggleLabel ?? t('viewer.theme.toggle')"
        :title="kind === 'dark' ? t('viewer.theme.toLight') : t('viewer.theme.toDark')"
        @click="emit('toggleTheme')"
      >
        {{ kind === 'dark' ? '☀' : '☾' }}
      </button>
      <button
        type="button"
        class="jv-icon-button"
        :aria-label="t('viewer.settings.label')"
        :title="t('viewer.settings.title')"
        @click="emit('openSettings')"
      >
        ⚙
      </button>
    </div>
  </header>
</template>
