<script setup lang="ts">
import { ref, watch } from 'vue';
import { t } from '@/i18n';
import { MAX_EXCLUDED_HOSTS, parseHostList } from '@/settings/hosts';

const hosts = defineModel<string[]>('hosts', { required: true });

const text = ref(hosts.value.join('\n'));
const invalid = ref<string[]>([]);
const dropped = ref(0);

// Reset to defaults (or another tab) replaced the list: show it, unless it's what the text already says.
watch(hosts, (value) => {
  if (value.join('\n') !== parseHostList(text.value).hosts.join('\n')) text.value = value.join('\n');
});

/** Saves as you type (useSettings debounces the writes), so closing the tab loses nothing. */
function onInput(): void {
  const list = parseHostList(text.value);
  if (list.hosts.join('\n') !== hosts.value.join('\n')) hosts.value = list.hosts;
}

/** On change (blur) the text is rewritten in canonical form and problems are reported. */
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
    <h2>{{ t('options.section.sites') }}</h2>
    <label class="opt-field">
      <span class="opt-label">{{ t('options.sites.label') }}</span>
      <textarea
        v-model="text"
        rows="5"
        spellcheck="false"
        placeholder="api.example.com&#10;*.internal.example.com"
        @input="onInput"
        @change="onChange"
      />
      <small class="opt-hint">{{ t('options.sites.hint') }}</small>
    </label>
    <p v-if="invalid.length > 0" class="opt-hint opt-errors" role="alert">
      {{ t('options.sites.invalid', { hosts: invalid.join(', ') }) }}
    </p>
    <p v-if="dropped > 0" class="opt-hint opt-errors" role="alert">
      {{ t('options.sites.dropped', { max: MAX_EXCLUDED_HOSTS }) }}
    </p>
  </section>
</template>
