import type { JsonKind } from '@/detect/detect';
import { jsonpBounds } from '@/detect/jsonp';
import { t } from '@/i18n';
import { offsetToLineColumn, parseJson, stripBom, type ParseError, type ParseResult } from './parse';

/** Parses a response of the given kind. Error offsets, lines and columns refer to the BOM-stripped text. */
export function parseDocument(text: string, kind: JsonKind): ParseResult {
  if (kind === 'jsonp') return parseJsonp(text);
  if (kind === 'ndjson') return parseNdjson(text);
  return parseJson(text);
}

/** The JSON inside `callback( … );`. */
export function parseJsonp(text: string): ParseResult {
  const source = stripBom(text);
  const bounds = jsonpBounds(source);
  if (bounds === null) {
    return { ok: false, error: { message: t('parse.notJsonp'), line: 1, column: 1, offset: 0 } };
  }
  const inner = parseJson(source.slice(bounds.from, bounds.to));
  if (inner.ok) return inner;
  return { ok: false, error: shift(inner.error, source, bounds.from) };
}

/** One JSON value per line (blank lines skipped), as an array of the values. */
export function parseNdjson(text: string): ParseResult {
  const source = stripBom(text);
  const values: unknown[] = [];
  let start = 0;
  let line = 1;
  while (start < source.length) {
    let end = source.indexOf('\n', start);
    if (end === -1) end = source.length;
    // A trailing \r (CRLF) is whitespace to JSON.parse, so it can stay.
    const lineText = source.slice(start, end);
    if (lineText.trim() !== '') {
      const result = parseJson(lineText);
      if (!result.ok) {
        const error = shift(result.error, source, start);
        return { ok: false, error: { ...error, message: t('parse.ndjsonLine', { line, message: result.error.message }) } };
      }
      values.push(result.value);
    }
    start = end + 1;
    line++;
  }
  if (values.length === 0) {
    return { ok: false, error: { message: t('parse.noValues'), line: null, column: null, offset: null } };
  }
  return { ok: true, value: values };
}

/** Moves an error found in `source.slice(from)` to its place in `source`. */
function shift(error: ParseError, source: string, from: number): ParseError {
  if (error.offset === null) return error;
  const offset = from + error.offset;
  return { ...error, ...offsetToLineColumn(source, offset), offset };
}
