import '@/components/viewer.css';
import { browser } from 'wxt/browser';
import { createApp, h } from 'vue';
import JsonViewer from '@/components/JsonViewer.vue';
import { sniffKind } from '@/detect/detect';
import { readRawText } from '@/detect/readRawText';
import { FORCE_VIEWER_FLAG, OPEN_OPTIONS, VIEWER_GUARD as GUARD, type OpenOptionsMessage } from '@/messages';
import { hideOriginal } from '@/viewer/hideOriginal';
import { createViewerSession, type ViewerSession } from '@/viewer/session';

/** "View as JSON" sets this on the content scripts' isolated world before injecting the viewer. */
function isForced(): boolean {
  return (globalThis as unknown as Record<string, unknown>)[FORCE_VIEWER_FLAG] === true;
}

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
    // A forced viewer takes whatever text the page shows when it isn't a plain text response.
    const raw = readRawText(document) ?? (isForced() ? body.innerText : null);
    if (raw === null) return;
    root.setAttribute(GUARD, '');
    // The detector already validated the body; this only tells the format apart, without parsing it all again.
    const format = sniffKind(raw, document.contentType);

    let restore: (() => void) | undefined;
    let ui: Awaited<ReturnType<typeof createShadowRootUi>> | undefined;
    let session: ViewerSession | undefined;
    let failed = false;
    const fail = (error: unknown): void => {
      if (failed) return;
      failed = true;
      restore?.();
      ui?.remove();
      session?.stop();
      root.removeAttribute(GUARD);
      console.warn('[json-viewer] viewer failed to render', error);
    };

    try {
      const current = await createViewerSession(document.fonts);
      session = current;
      ctx.onInvalidated(() => current.stop());
      const { state } = current;
      const source = { url: location.href, loadedAt: new Date() };

      const openSettings = () => {
        const message: OpenOptionsMessage = { type: OPEN_OPTIONS };
        void browser.runtime.sendMessage(message).catch(() => {});
      };

      ui = await createShadowRootUi(ctx, {
        name: 'json-viewer-app',
        position: 'inline',
        anchor: 'body',
        onMount(container) {
          const app = createApp({
            render: () =>
              h('div', { class: 'jv-page' }, [
                h(JsonViewer, {
                  raw,
                  format,
                  options: state.settings.viewer,
                  font: state.settings.font,
                  shortcuts: state.settings.shortcuts,
                  features: state.settings.features,
                  documentShortcuts: true,
                  theme: current.theme.value,
                  kind: current.kind.value,
                  customCss: state.customCss,
                  source,
                  onToggleTheme: current.toggleTheme,
                  onOpenSettings: openSettings,
                }),
              ]),
          });
          app.config.errorHandler = fail;
          app.mount(container);
          return app;
        },
        onRemove(app) {
          app?.unmount();
        },
      });
      // Hide (don't remove) the page's own rendering so the original stays recoverable.
      restore = hideOriginal(body);
      ui.mount();
    } catch (error) {
      fail(error);
    }
  },
});
