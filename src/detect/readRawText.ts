const NATIVE_VIEWER_CONTAINER = 'json-formatter-container';

/**
 * Returns the raw response text when the page is a browser-rendered text
 * response: <body> holds exactly one <pre>, optionally next to the empty
 * container Chrome/Edge add for their built-in JSON viewer.
 * See docs/notes/native-viewers.md.
 */
export function readRawText(doc: Document): string | null {
  const body = doc.body;
  if (!body) return null;

  let pre: HTMLPreElement | null = null;
  for (const el of Array.from(body.children)) {
    if (el.tagName === 'PRE' && !pre) {
      pre = el as HTMLPreElement;
    } else if (el.tagName === 'DIV' && el.classList.contains(NATIVE_VIEWER_CONTAINER)) {
      continue;
    } else {
      return null;
    }
  }
  return pre ? (pre.textContent ?? '') : null;
}
