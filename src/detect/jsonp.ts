// A callback name, optionally dotted ("jQuery.cb", "a.b_1"), after optional whitespace, the "/**/" some APIs
// prepend and Express's `typeof cb === 'function' && ` guard; JSON itself can never start this way.
const NAME = String.raw`[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*`;
const JSONP_START = new RegExp(
  String.raw`^\s*(?:\/\*\*\/\s*)?(?:typeof\s+(${NAME})\s*===?\s*(['"])function\2\s*&&\s*)?(${NAME})\s*\(`,
);

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
  // The guard must test the function it calls.
  if (!match || (match[1] !== undefined && match[1] !== match[3])) return null;
  let end = text.length;
  while (isSpace(text[end - 1])) end--;
  if (text[end - 1] === ';') end--;
  while (isSpace(text[end - 1])) end--;
  if (text[end - 1] !== ')' || end - 1 < match[0].length) return null;
  return { callback: match[3]!, from: match[0].length, to: end - 1 };
}
