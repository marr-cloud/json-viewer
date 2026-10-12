// A callback name, optionally dotted ("jQuery.cb", "a.b_1"), after optional whitespace and the "/**/" some APIs
// prepend; JSON itself can never start this way.
const JSONP_START = /^\s*(?:\/\*\*\/\s*)?([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\(/;

export interface JsonpBounds {
  callback: string;
  /** Start of the wrapped JSON, just after "(". */
  from: number;
  /** End of the wrapped JSON, at the closing ")". */
  to: number;
}

const isSpace = (char: string | undefined) => char !== undefined && /\s/.test(char);

/** Where the JSON sits inside `callback( … );`, or null when `text` isn't wrapped that way. */
export function jsonpBounds(text: string): JsonpBounds | null {
  const match = JSONP_START.exec(text);
  if (!match) return null;
  let end = text.length;
  while (isSpace(text[end - 1])) end--;
  if (text[end - 1] === ';') end--;
  while (isSpace(text[end - 1])) end--;
  if (text[end - 1] !== ')' || end - 1 < match[0].length) return null;
  return { callback: match[1]!, from: match[0].length, to: end - 1 };
}
