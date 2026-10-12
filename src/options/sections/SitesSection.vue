<script setup lang="ts">
import { ref, watch } from 'vue';
import { MAX_EXCLUDED_HOSTS, parseHostList } from '@/settings/hosts';

const hosts = defineModel<string[]>('hosts', { required: true });

const text = ref(hosts.value.join('\n'));
const invalid = ref<string[]>([]);
const dropped = ref(0);

// Reset to defaults (or another tab) replaced the list: show it, unless it's what the text already says.
watch(hosts, (value) => {
  if (value.join('\n') !== parseHostList(text.value).hosts.join('\n')) text.value = value.join('\n');
});

/** Saves on change (blur), not per key; the text is rewritten in canonical form. */
function onChange(): void {
  const list = parseHostList(text.value);
  invalid.value = list.invalid;
  dropped.value = list.dropped;
  hosts.value = list.hosts;
  text.value = list.hosts.join('\n');
}
</script>

<template>
  <section id="sites" class="opt-section">
    <h2>Sites</h2>
    <label class="opt-field">
      <span class="opt-label">Don't open the viewer on</span>
      <textarea
        v-model="text"
        rows="5"
        spellcheck="false"
        placeholder="api.example.com&#10;*.internal.example.com"
        @change="onChange"
      />
      <small class="opt-hint">
        One host per line. *.example.com also matches example.com, and * matches anything. Right-click a page and
        choose View as JSON to open it there anyway.
      </small>
    </label>
    <p v-if="invalid.length > 0" class="opt-hint opt-errors" role="alert">
      Not a host, left out: {{ invalid.join(', ') }}
    </p>
    <p v-if="dropped > 0" class="opt-hint opt-errors" role="alert">Only the first {{ MAX_EXCLUDED_HOSTS }} hosts are kept.</p>
  </section>
</template>
