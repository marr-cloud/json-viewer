import { formatJson } from '@/parse/format';
import { parseJson, stripBom, type ParseError } from '@/parse/parse';
import type { ViewerOptions } from './options';

export type PreparedDocument =
  | { ok: true; text: string; value: unknown }
  | { ok: false; text: string; error: ParseError };

const TOO_DEEP = 'Document is nested too deeply to format';

/** Parses and formats the raw response. Never throws: failures carry the raw text. */
export function prepareDocument(
  raw: string,
  options: Pick<ViewerOptions, 'tabSize' | 'sortKeys' | 'indentCStyle'>,
): PreparedDocument {
  const parsed = parseJson(raw);
  if (!parsed.ok) return { ok: false, text: stripBom(raw), error: parsed.error };

  try {
    const text = formatJson(parsed.value, {
      indent: options.tabSize,
      sortKeys: options.sortKeys,
      cStyle: options.indentCStyle,
    });
    return { ok: true, text, value: parsed.value };
  } catch (e) {
    const message = e instanceof RangeError ? TOO_DEEP : String(e);
    return { ok: false, text: stripBom(raw), error: { message, line: null, column: null, offset: null } };
  }
}
