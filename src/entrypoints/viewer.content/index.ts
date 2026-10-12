import './style.css';
import { createApp } from 'vue';
import JsonViewer from '@/components/JsonViewer.vue';
import { readRawText } from '@/detect/readRawText';
import { defaultTheme } from '@/themes/builtin';
import { defaultViewerOptions } from '@/viewer/options';

const GUARD = 'data-json-viewer';

export default defineContentScript({
  matches: ['<all_urls>'],
  registration: 'runtime',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const root = document.documentElement;
    if (root.hasAttribute(GUARD)) return;
    const raw = readRawText(document);
    if (raw === null) return;
    root.setAttribute(GUARD, '');

    // Hide (don't remove) the browser's rendering so the original stays recoverable.
    for (const el of Array.from(document.body.children)) {
      (el as HTMLElement).style.display = 'none';
    }

    const ui = await createShadowRootUi(ctx, {
      name: 'json-viewer-app',
      position: 'inline',
      anchor: 'body',
      onMount(container) {
        const app = createApp(JsonViewer, {
          raw,
          options: defaultViewerOptions,
          theme: defaultTheme,
          source: { url: location.href, loadedAt: new Date() },
        });
        app.mount(container);
        return app;
      },
      onRemove(app) {
        app?.unmount();
      },
    });
    ui.mount();
  },
});
