<script setup lang="ts">
import { n, t } from '@/i18n';

withDefaults(
  defineProps<{
    path: string | null;
    size: string;
    lines: string;
    format: string;
    note?: string;
    message?: string;
    /** The light mode threshold in MB when light mode is on, else null. */
    lightMode?: number | null;
  }>(),
  { note: undefined, message: '', lightMode: null },
);
const emit = defineEmits<{ copyPath: [] }>();
</script>

<template>
  <footer class="jv-status">
    <button
      v-if="path !== null"
      type="button"
      class="jv-path"
      :aria-label="t('viewer.status.copyPathOf', { path })"
      :title="t('viewer.status.copyPath')"
      @click="emit('copyPath')"
    >
      {{ path }}
    </button>
    <span class="jv-status-message" role="status">{{ message }}</span>
    <span class="jv-status-info">
      <span
        v-if="lightMode !== null"
        class="jv-light-mode"
        :title="t('viewer.status.lightModeHint', { mb: n(lightMode) })"
        >{{ t('viewer.status.lightMode') }}</span
      >
      <span v-if="note">{{ note }}</span>
      <span>{{ size }}</span>
      <span>{{ lines }}</span>
      <span>{{ format }}</span>
    </span>
  </footer>
</template>
