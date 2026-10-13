<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue';
import viewerCss from './viewer.css?inline';

// The viewer's custom CSS is a plain <style>; a shadow root keeps it (and viewer.css) off the host page.
const host = ref<HTMLDivElement>();
const shadowRoot = shallowRef<ShadowRoot>();
onMounted(() => {
  shadowRoot.value = host.value!.attachShadow({ mode: 'open' });
});
</script>

<template>
  <div ref="host" class="jv-shadow-host" />
  <Teleport v-if="shadowRoot" :to="shadowRoot">
    <component :is="'style'">{{ viewerCss }}</component>
    <!-- The JsonViewer to isolate. -->
    <slot />
  </Teleport>
</template>
