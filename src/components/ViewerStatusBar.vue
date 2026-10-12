<script setup lang="ts">
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
      :aria-label="`Copy path ${path}`"
      title="Copy path"
      @click="emit('copyPath')"
    >
      {{ path }}
    </button>
    <span class="jv-status-message" role="status">{{ message }}</span>
    <span class="jv-status-info">
      <span
        v-if="lightMode !== null"
        class="jv-light-mode"
        :title="`Over ${lightMode} MB: color swatches and date and image previews are off.`"
        >Light mode</span
      >
      <span v-if="note">{{ note }}</span>
      <span>{{ size }}</span>
      <span>{{ lines }}</span>
      <span>{{ format }}</span>
    </span>
  </footer>
</template>
