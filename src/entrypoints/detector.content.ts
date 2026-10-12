import { detect } from '@/detect/detect';
import { readRawText } from '@/detect/readRawText';
import { JSON_DETECTED, type JsonDetectedMessage } from '@/messages';

// Runs on every page: keep this free of Vue/CodeMirror imports.
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_end',
  main() {
    const text = readRawText(document);
    if (text === null || !detect(document.contentType, text)) return;
    const message: JsonDetectedMessage = { type: JSON_DETECTED };
    void browser.runtime.sendMessage(message);
  },
});
