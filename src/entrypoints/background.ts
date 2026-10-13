import { backgroundLocale } from '@/background/locale';
import { createMenus, labelExtension, onMenuClick } from '@/background/menus';
import { openScratchpad } from '@/background/scratchpad';
import { onJsonDetected } from '@/background/viewer';
import { resolveLocale } from '@/i18n/translate';
import { isJsonDetectedMessage, isOpenOptionsMessage } from '@/messages';
import { watchSettings } from '@/settings/storage';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    backgroundLocale()
      .then(createMenus)
      .catch((error: unknown) => console.warn('[json-viewer] context menus failed', error));
  });
  // The menus and the toolbar tooltip follow the language setting, live.
  const relabel = (locale: Parameters<typeof labelExtension>[0]) =>
    labelExtension(locale).catch((error: unknown) => console.warn('[json-viewer] relabeling failed', error));
  void backgroundLocale().then(relabel);
  watchSettings((settings) => void relabel(resolveLocale(settings.locale, navigator.languages)));
  browser.contextMenus.onClicked.addListener((info, tab) => void onMenuClick(info, tab));
  // The toolbar icon has no popup: a click opens the scratchpad next to the current tab.
  browser.action.onClicked.addListener((tab) => {
    openScratchpad('', tab.index + 1).catch((error: unknown) => console.warn('[json-viewer] scratchpad failed', error));
  });

  browser.runtime.onMessage.addListener((message, sender) => {
    if (isOpenOptionsMessage(message)) {
      void browser.runtime.openOptionsPage();
      return;
    }
    if (!isJsonDetectedMessage(message)) return;
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    onJsonDetected({ tabId, frameId: sender.frameId ?? 0 }, sender.url).catch((error: unknown) =>
      console.warn('[json-viewer] viewer injection failed', error),
    );
  });
});
