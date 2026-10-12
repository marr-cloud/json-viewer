import { isNdjson, type JsonKind } from '@/detect/detect';
import { formatJson } from '@/parse/format';
import { parseDocument } from '@/parse/formats';
import { stripBom, type ParseError } from '@/parse/parse';
import type { ViewerOptions } from './options';

/** `kind` is the format actually shown, which can differ from the one asked for (see prepareDocument). */
export type PreparedDocument = (
  | { ok: true; text: string; value: unknown }
  | { ok: false; text: string; error: ParseError }
) & { kind: JsonKind };

const TOO_DEEP = 'Document is nested too deeply to format';

/**
 * Parses and formats the raw response. Never throws: failures carry the raw text.
 * JSON that doesn't parse but is valid NDJSON (some APIs send NDJSON as application/json) is shown as NDJSON.
 */
export function prepareDocument(
  raw: string,
  options: Pick<ViewerOptions, 'tabSize' | 'sortKeys' | 'indentCStyle'>,
  kind: JsonKind = 'json',
): PreparedDocument {
  let shown = kind;
  let parsed = parseDocument(raw, kind);
  if (!parsed.ok && kind === 'json' && isNdjson(raw)) {
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
    const message = e instanceof RangeError ? TOO_DEEP : String(e);
    return { ok: false, text: stripBom(raw), error: { message, line: null, column: null, offset: null }, kind: shown };
  }
}
