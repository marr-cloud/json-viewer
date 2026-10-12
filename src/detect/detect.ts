export type JsonKind = 'json';

export interface Detection {
  kind: JsonKind;
}

const JSON_TYPES = new Set(['application/json', 'text/json']);
const SUFFIX_JSON = /^application\/[\w.+-]+\+json$/;

export function normalizeContentType(contentType: string): string {
  return (contentType.split(';')[0] ?? '').trim().toLowerCase();
}

export function isJsonContentType(contentType: string): boolean {
  const type = normalizeContentType(contentType);
  return JSON_TYPES.has(type) || SUFFIX_JSON.test(type);
}

/**
 * JSON content types are always shown (invalid bodies get an error banner).
 * text/plain is only claimed when the body is an object or array that parses,
 * so plain logs like "[INFO] …" are left alone.
 */
export function detect(contentType: string, text: string): Detection | null {
  if (isJsonContentType(contentType)) return { kind: 'json' };
  if (normalizeContentType(contentType) === 'text/plain' && isJsonContainer(text)) {
    return { kind: 'json' };
  }
  return null;
}

function isJsonContainer(text: string): boolean {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (trimmed[0] !== '{' && trimmed[0] !== '[') return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}
