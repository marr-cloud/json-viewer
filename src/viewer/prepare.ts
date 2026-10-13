import type { JsonKind } from '@/detect/detect';
import { formatJson } from '@/parse/format';
import { parseDocument } from '@/parse/formats';
import { stripBom, type ParseError } from '@/parse/parse';
import { t } from '@/i18n';
import type { ViewerOptions } from './options';

/** `kind` is the format actually shown, which can differ from the one asked for (see prepareDocument). */
export type PreparedDocument = (
  | { ok: true; text: string; value: unknown }
  | { ok: false; text: string; error: ParseError }
) & { kind: JsonKind };

/**
 * JSON that fails but whose first line is a whole object or array, with more lines after it, can only be NDJSON
 * (some APIs send it as application/json): JSON can't hold two values.
 */
function looksLikeNdjson(raw: string): boolean {
  const text = stripBom(raw).trimStart();
  const firstBreak = text.indexOf('\n');
  // A single line (a big minified document) is never NDJSON: don't parse it again.
  if (firstBreak === -1 || text.slice(firstBreak).trim() === '') return false;
  const first = text.slice(0, firstBreak).trim();
  if (first[0] !== '{' && first[0] !== '[') return false;
  try {
    JSON.parse(first);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parses and formats the raw response. Never throws: failures carry the raw text.
 * JSON that doesn't parse but looks like NDJSON is parsed and shown as NDJSON, errors included ("Line 3: …").
 */
export function prepareDocument(
  raw: string,
  options: Pick<ViewerOptions, 'tabSize' | 'sortKeys' | 'indentCStyle'>,
  kind: JsonKind = 'json',
): PreparedDocument {
  let shown = kind;
  let parsed = parseDocument(raw, kind);
  if (!parsed.ok && kind === 'json' && looksLikeNdjson(raw)) {
    shown = 'ndjson';
    parsed = parseDocument(raw, 'ndjson');
  }
  if (!parsed.ok) return { ok: false, text: stripBom(raw), error: parsed.error, kind: shown };

  try {
    const text = formatJson(parsed.value, {
      indent: options.tabSize,
      sortKeys: options.sortKeys,
      cStyle: options.indentCStyle,
    });
    return { ok: true, text, value: parsed.value, kind: shown };
  } catch (e) {
    const message = e instanceof RangeError ? t('parse.tooDeep') : String(e);
    return { ok: false, text: stripBom(raw), error: { message, line: null, column: null, offset: null }, kind: shown };
  }
}
