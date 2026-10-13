import '@/scratchpad/scratchpad.css';
import { createApp } from 'vue';
import ScratchpadApp from '@/scratchpad/ScratchpadApp.vue';
import { createViewerSession } from '@/viewer/session';

createViewerSession(document.fonts)
  .then((session) => createApp(ScratchpadApp, { session }).mount('#app'))
  .catch((error: unknown) => {
    console.error('[json-viewer] scratchpad failed to start', error);
    document.body.textContent = 'The scratchpad could not load its settings. Reload the page to try again.';
  });
