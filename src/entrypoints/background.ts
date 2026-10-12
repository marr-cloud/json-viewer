import { openScratchpad } from '@/background/scratchpad';
import { onJsonDetected } from '@/background/viewer';
import { isJsonDetectedMessage, isOpenOptionsMessage } from '@/messages';

export default defineBackground(() => {
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
