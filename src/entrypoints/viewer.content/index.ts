import '@/components/viewer.css';
import { browser } from 'wxt/browser';
import { computed, createApp, h, reactive } from 'vue';
import JsonViewer from '@/components/JsonViewer.vue';
import { readRawText } from '@/detect/readRawText';
import { createFontLoader } from '@/fonts/loader';
import { trackStoredFont } from '@/fonts/track';
import { OPEN_OPTIONS, type OpenOptionsMessage } from '@/messages';
import { customCssItem, loadSettings, watchSettings } from '@/settings/storage';
import { activeTheme, pickThemeKind, toggledKind, type ThemeKind } from '@/themes/active';
import { listCustomThemes, watchCustomThemes } from '@/themes/store';
import { hideOriginal } from '@/viewer/hideOriginal';

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
      const [settings, customCss, customThemes] = await Promise.all([
        loadSettings(),
        customCssItem.getValue(),
        listCustomThemes(),
      ]);
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const state = reactive({
        settings,
        customCss,
        customThemes,
        prefersDark: media.matches,
        override: null as ThemeKind | null,
      });
      const theme = computed(() => activeTheme(state.settings, state.customThemes, state.prefersDark, state.override));
      const kind = computed(() => pickThemeKind(state.settings.themeMode, state.prefersDark, state.override));
      const source = { url: location.href, loadedAt: new Date() };

      const onMediaChange = (event: MediaQueryListEvent) => {
        state.prefersDark = event.matches;
      };
      media.addEventListener('change', onMediaChange);
      const stops = [
        watchSettings((value) => {
          state.settings = value;
        }),
        customCssItem.watch((value) => {
          state.customCss = value ?? '';
        }),
        watchCustomThemes(() => {
          void listCustomThemes()
            .then((list) => {
              state.customThemes = list;
            })
            .catch((error: unknown) => console.warn('[json-viewer] custom theme reload failed', error));
        }),
        // Faces go on the page's document.fonts, which the viewer's shadow root uses too.
        trackStoredFont(
          () => (state.settings.font.source === 'google' ? state.settings.font.family : ''),
          createFontLoader(document.fonts),
        ),
        () => media.removeEventListener('change', onMediaChange),
      ];
      ctx.onInvalidated(() => stops.forEach((stop) => stop()));

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
                  options: state.settings.viewer,
                  font: state.settings.font,
                  theme: theme.value,
                  kind: kind.value,
                  customCss: state.customCss,
                  source,
                  onToggleTheme: () => {
                    state.override = toggledKind(state.settings.themeMode, state.prefersDark, state.override);
                  },
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
      // Hide (don't remove) the browser's rendering so the original stays recoverable.
      restore = hideOriginal(body);
      ui.mount();
    } catch (error) {
      fail(error);
    }
  },
});
