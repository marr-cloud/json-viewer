import '@/scratchpad/scratchpad.css';
import { createApp } from 'vue';
import { applyLocaleSetting, t } from '@/i18n';
import ScratchpadApp from '@/scratchpad/ScratchpadApp.vue';
import { createViewerSession } from '@/viewer/session';

createViewerSession(document.fonts)
  .then((session) => createApp(ScratchpadApp, { session }).mount('#app'))
  .catch((error: unknown) => {
    console.error('[json-viewer] scratchpad failed to start', error);
    // The settings (and so the chosen language) are what failed to load: use the browser's.
    applyLocaleSetting('auto');
    document.body.textContent = t('scratchpad.loadFailed');
  });
