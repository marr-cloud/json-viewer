import { isJsonDetectedMessage, isOpenOptionsMessage } from '@/messages';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender) => {
    if (isOpenOptionsMessage(message)) {
      void browser.runtime.openOptionsPage();
      return;
    }
    if (!isJsonDetectedMessage(message)) return;
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    browser.scripting
      .executeScript({
        target: { tabId, frameIds: [sender.frameId ?? 0] },
        files: ['/content-scripts/viewer.js'],
      })
      .catch((error: unknown) => console.warn('[json-viewer] viewer injection failed', error));
  });
});
