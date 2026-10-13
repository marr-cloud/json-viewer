import { detect, isJsonContentType } from '@/detect/detect';
import { describeBody, readRawText } from '@/detect/readRawText';
import { JSON_DETECTED, type JsonDetectedMessage } from '@/messages';

// Runs on every page: keep this free of Vue/CodeMirror imports.
export default defineContentScript({
  matches: ['<all_urls>'],
  // Avoid broadcasting the extension ID to every page via window.postMessage.
  noScriptStartedPostMessage: true,
  runAt: 'document_end',
  main() {
    const text = readRawText(document);
    if (text === null) {
      // A JSON response the browser didn't render as plain text (its own viewer changed?): say what was there,
      // so the case shows up in the extension's error list instead of failing silently.
      if (isJsonContentType(document.contentType)) {
        console.error('[json-viewer] JSON response left alone: unexpected page structure:', describeBody(document));
      }
      return;
    }
    if (!detect(document.contentType, text)) return;
    const message: JsonDetectedMessage = { type: JSON_DETECTED };
    browser.runtime
      .sendMessage(message)
      .catch((error: unknown) => console.error('[json-viewer] could not ask the extension to open the viewer:', error));
  },
});
