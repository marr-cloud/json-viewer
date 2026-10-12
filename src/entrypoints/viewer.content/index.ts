import './style.css';
import { createApp } from 'vue';
import JsonViewer from '@/components/JsonViewer.vue';
import { readRawText } from '@/detect/readRawText';
import { defaultTheme } from '@/themes/builtin';
import { hideOriginal } from '@/viewer/hideOriginal';
import { defaultViewerOptions } from '@/viewer/options';

const GUARD = 'data-json-viewer';

export default defineContentScript({
  matches: ['<all_urls>'],
  // Avoid broadcasting the extension ID to every page via window.postMessage.
  noScriptStartedPostMessage: true,
  registration: 'runtime',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const root = document.documentElement;
    const body = document.body;
    if (!body || root.hasAttribute(GUARD)) return;
    const raw = readRawText(document);
    if (raw === null) return;
    root.setAttribute(GUARD, '');

    let restore: (() => void) | undefined;
    let ui: Awaited<ReturnType<typeof createShadowRootUi>> | undefined;
    let failed = false;
    const fail = (error: unknown): void => {
      if (failed) return;
      failed = true;
      restore?.();
      ui?.remove();
      root.removeAttribute(GUARD);
      console.warn('[json-viewer] viewer failed to render', error);
    };

    try {
      ui = await createShadowRootUi(ctx, {
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
          app.config.errorHandler = fail;
          app.mount(container);
          return app;
        },
        onRemove(app) {
          app?.unmount();
        },
      });
      // Hide (don't remove) the browser's rendering so the original stays recoverable.
      restore = hideOriginal(body);
      ui.mount();
    } catch (error) {
      fail(error);
    }
  },
});
