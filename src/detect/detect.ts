import { jsonpBounds } from './jsonp';

/** How the response wraps its JSON: plain, a JSONP callback, or one value per line (NDJSON / JSON Lines). */
export type JsonKind = 'json' | 'jsonp' | 'ndjson';

export interface Detection {
  kind: JsonKind;
}

const JSON_TYPES = new Set(['application/json', 'text/json']);
const SUFFIX_JSON = /^application\/[\w.+-]+\+json$/;
// Chromium downloads these instead of showing them, so in practice they reach the viewer only in other browsers.
const NDJSON_TYPES = new Set([
  'application/x-ndjson',
  'application/ndjson',
  'application/jsonl',
  'application/x-jsonlines',
  'application/jsonlines',
]);
const SCRIPT_TYPES = new Set(['text/javascript', 'application/javascript', 'application/x-javascript']);

export function normalizeContentType(contentType: string): string {
  return (contentType.split(';')[0] ?? '').trim().toLowerCase();
}

export function isJsonContentType(contentType: string): boolean {
  const type = normalizeContentType(contentType);
  return JSON_TYPES.has(type) || SUFFIX_JSON.test(type);
}

/**
 * JSON and NDJSON content types are always shown (invalid bodies get an error banner).
 * text/plain and JavaScript are only claimed when the body parses: as an object or array, as JSONP,
 * or (text/plain only) as NDJSON. So plain logs like "[INFO] …" and real scripts are left alone.
 */
export function detect(contentType: string, text: string): Detection | null {
  const type = normalizeContentType(contentType);
  if (NDJSON_TYPES.has(type)) return { kind: 'ndjson' };
  // Cheap: JSON content types are claimed without parsing; the viewer parses once.
  if (isJsonContentType(type)) return { kind: jsonpBounds(text) ? 'jsonp' : 'json' };
  const plain = type === 'text/plain';
  if (!plain && !SCRIPT_TYPES.has(type)) return null;
  if (isValidJsonp(text)) return { kind: 'jsonp' };
  if (isJsonContainer(text)) return { kind: 'json' };
  if (plain && isNdjson(text)) return { kind: 'ndjson' };
  return null;
}

/**
 * The kind of a text without parsing it whole: from an NDJSON content type, the JSONP shape or NDJSON lines.
 * For the viewer (the detector already validated the body), pasted text and pages forced into the viewer.
 */
export function sniffKind(text: string, contentType = ''): JsonKind {
  if (NDJSON_TYPES.has(normalizeContentType(contentType))) return 'ndjson';
  if (jsonpBounds(text)) return 'jsonp';
  return isNdjson(text) ? 'ndjson' : 'json';
}

function parses(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function isJsonContainer(text: string): boolean {
  const trimmed = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).trim();
  return (trimmed[0] === '{' || trimmed[0] === '[') && parses(trimmed);
}

function isValidJsonp(text: string): boolean {
  const bounds = jsonpBounds(text);
  return bounds !== null && isJsonContainer(text.slice(bounds.from, bounds.to));
}

/**
 * At least two lines, each an object or array that parses on its own (blank lines are skipped).
 * Stops at the first line that doesn't, so a pretty-printed document fails on its first line.
 */
export function isNdjson(text: string): boolean {
  let start = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  // A single line (a big minified document) can't be NDJSON: don't parse it just to find out.
  const firstBreak = text.indexOf('\n', start);
  if (firstBreak === -1) return false;
  let next = firstBreak + 1;
  while (next < text.length && /\s/.test(text[next]!)) next++;
  if (next === text.length) return false;
  let records = 0;
  while (start < text.length) {
    let end = text.indexOf('\n', start);
    if (end === -1) end = text.length;
    const line = text.slice(start, end).trim();
    start = end + 1;
    if (line === '') continue;
    if ((line[0] !== '{' && line[0] !== '[') || !parses(line)) return false;
    records++;
  }
  return records >= 2;
}
