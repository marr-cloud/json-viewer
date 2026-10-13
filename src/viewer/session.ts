import { computed, reactive, watchEffect, type ComputedRef } from 'vue';
import { createFontLoader, type FontFaceTarget } from '@/fonts/loader';
import { trackStoredFont } from '@/fonts/track';
import { applyLocaleSetting } from '@/i18n';
import type { Settings } from '@/settings/schema';
import { customCssItem, loadSettings, watchSettings } from '@/settings/storage';
import { activeTheme, pickThemeKind, toggledKind, type ThemeKind } from '@/themes/active';
import { listCustomThemes, watchCustomThemes } from '@/themes/store';
import type { Theme } from '@/themes/types';

export interface ViewerSessionState {
  settings: Settings;
  customCss: string;
  customThemes: Theme[];
  prefersDark: boolean;
  /** The toolbar's light/dark toggle, for this page only. */
  override: ThemeKind | null;
}

export interface ViewerSession {
  /** Replaced (never mutated) as storage changes, so it can go straight to JsonViewer's props. */
  readonly state: ViewerSessionState;
  readonly theme: ComputedRef<Theme>;
  readonly kind: ComputedRef<ThemeKind>;
  toggleTheme(): void;
  /** Stops following storage, the color scheme and the font. */
  stop(): void;
}

/**
 * Loads what a full-page viewer needs (settings, custom CSS and themes, the downloaded font) and keeps it in sync
 * with storage and the system color scheme. It also sets the page's language from the settings. Used by the content script and the scratchpad.
 */
export async function createViewerSession(
  fonts: FontFaceTarget,
  media: MediaQueryList = window.matchMedia('(prefers-color-scheme: dark)'),
): Promise<ViewerSession> {
  const [settings, customCss, customThemes] = await Promise.all([
    loadSettings(),
    customCssItem.getValue(),
    listCustomThemes(),
  ]);
  const state = reactive<ViewerSessionState>({
    settings,
    customCss,
    customThemes,
    prefersDark: media.matches,
    override: null,
  });
  const theme = computed(() => activeTheme(state.settings, state.customThemes, state.prefersDark, state.override));
  const kind = computed(() => pickThemeKind(state.settings.themeMode, state.prefersDark, state.override));

  const onMediaChange = (event: MediaQueryListEvent) => {
    state.prefersDark = event.matches;
  };
  media.addEventListener('change', onMediaChange);
  const stops = [
    watchEffect(() => applyLocaleSetting(state.settings.locale)),
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
    // Faces go on the page's document.fonts, which a viewer in a shadow root uses too.
    trackStoredFont(
      () => (state.settings.font.source === 'google' ? state.settings.font.family : ''),
      createFontLoader(fonts),
    ),
    () => media.removeEventListener('change', onMediaChange),
  ];

  return {
    state,
    theme,
    kind,
    toggleTheme() {
      state.override = toggledKind(state.settings.themeMode, state.prefersDark, state.override);
    },
    stop() {
      for (const stop of stops) {
        try {
          stop();
        } catch (error) {
          // Once the extension is reloaded or disabled its APIs throw ("Extension context invalidated"); those
          // listeners died with the context anyway. Keep going, so the page-side listeners are removed too.
          console.debug('[json-viewer] cleanup skipped', error);
        }
      }
    },
  };
}
