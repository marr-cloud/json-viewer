export interface ParseError {
  message: string;
  line: number | null;
  column: number | null;
}

export type ParseResult = { ok: true; value: unknown } | { ok: false; error: ParseError };

// Integers this long may exceed Number.MAX_SAFE_INTEGER; only then pay for a reviver.
const LONG_DIGIT_RUN = /\d{16,}/;

export function parseJson(text: string): ParseResult {
  const source = stripBom(text);
  try {
    const value = LONG_DIGIT_RUN.test(source)
      ? JSON.parse(source, preserveNumber)
      : JSON.parse(source);
    return { ok: true, value };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: { message, ...locateError(source, message) } };
  }
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function preserveNumber(_key: string, value: unknown, context?: { source?: string }): unknown {
  if (typeof value === 'number' && context?.source !== undefined && String(value) !== context.source) {
    return JSON.rawJSON(context.source);
  }
  return value;
}

export function locateError(
  text: string,
  message: string,
): { line: number | null; column: number | null } {
  const lineColumn = /\(line (\d+) column (\d+)\)/.exec(message);
  if (lineColumn) return { line: Number(lineColumn[1]), column: Number(lineColumn[2]) };

  const position = /position (\d+)/.exec(message);
  const offset = position
    ? Number(position[1])
    : /end of JSON input/.test(message)
      ? text.length
      : null;
  if (offset === null) return { line: null, column: null };
  return offsetToLineColumn(text, offset);
}

export function offsetToLineColumn(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}
