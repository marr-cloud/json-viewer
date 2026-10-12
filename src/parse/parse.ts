export interface ParseError {
  message: string;
  line: number | null;
  column: number | null;
}

export type ParseResult = { ok: true; value: unknown } | { ok: false; error: ParseError };

// Cheap prefilter: a number needs more than 15 significant digits to lose precision.
const LONG_NUMBER = /\d[\d.]{15,}/;

export function parseJson(text: string): ParseResult {
  const source = stripBom(text);
  try {
    const value = LONG_NUMBER.test(source) ? JSON.parse(source, preserveNumber) : JSON.parse(source);
    return { ok: true, value };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: { message, ...locateError(source) } };
  }
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function preserveNumber(_key: string, value: unknown, context?: { source?: string }): unknown {
  if (
    typeof value === 'number' &&
    context?.source !== undefined &&
    String(value) !== context.source &&
    significantDigits(context.source) > 15
  ) {
    return JSON.rawJSON(context.source);
  }
  return value;
}

function significantDigits(literal: string): number {
  const mantissa = literal.split(/[eE]/)[0] ?? '';
  return mantissa.replace(/[-.]/g, '').replace(/^0+/, '').length;
}

export function locateError(text: string): { line: number | null; column: number | null } {
  const offset = findErrorOffset(text);
  if (offset === -1) return { line: null, column: null };
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

type Scan = { ok: true; end: number } | { ok: false; at: number };
type Frame = '{' | '[';
type Mode = 'value' | 'valueOrEndArray' | 'keyOrEndObject' | 'key' | 'colon' | 'afterValue';

const isWs = (c: number) => c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d;
const isDigit = (c: number) => c >= 0x30 && c <= 0x39;
const isHex = (c: number) =>
  isDigit(c) || (c >= 0x41 && c <= 0x46) || (c >= 0x61 && c <= 0x66);

/**
 * Offset of the first character where `text` stops being valid JSON
 * (text.length if it ends early). Returns -1 if `text` is valid.
 * Iterative: nesting depth is limited only by memory, not the call stack.
 */
export function findErrorOffset(text: string): number {
  const n = text.length;
  const stack: Frame[] = [];
  let mode: Mode = 'value';
  let i = 0;

  while (true) {
    while (i < n && isWs(text.charCodeAt(i))) i++;
    switch (mode) {
      case 'value':
      case 'valueOrEndArray': {
        if (mode === 'valueOrEndArray' && text[i] === ']') {
          stack.pop();
          i++;
          mode = 'afterValue';
          break;
        }
        const c = text[i];
        if (c === undefined) return n;
        if (c === '{') {
          stack.push('{');
          i++;
          mode = 'keyOrEndObject';
        } else if (c === '[') {
          stack.push('[');
          i++;
          mode = 'valueOrEndArray';
        } else if (c === '"') {
          const r = scanString(text, i);
          if (!r.ok) return r.at;
          i = r.end;
          mode = 'afterValue';
        } else if (c === '-' || isDigit(text.charCodeAt(i))) {
          const r = scanNumber(text, i);
          if (!r.ok) return r.at;
          i = r.end;
          mode = 'afterValue';
        } else {
          const word = c === 't' ? 'true' : c === 'f' ? 'false' : c === 'n' ? 'null' : null;
          if (word === null) return i;
          const r = scanLiteral(text, i, word);
          if (!r.ok) return r.at;
          i = r.end;
          mode = 'afterValue';
        }
        break;
      }
      case 'keyOrEndObject':
      case 'key': {
        if (mode === 'keyOrEndObject' && text[i] === '}') {
          stack.pop();
          i++;
          mode = 'afterValue';
          break;
        }
        if (text[i] !== '"') return i;
        const r = scanString(text, i);
        if (!r.ok) return r.at;
        i = r.end;
        mode = 'colon';
        break;
      }
      case 'colon': {
        if (text[i] !== ':') return i;
        i++;
        mode = 'value';
        break;
      }
      case 'afterValue': {
        if (stack.length === 0) return i === n ? -1 : i;
        const top = stack[stack.length - 1];
        const c = text[i];
        if (c === ',') {
          i++;
          mode = top === '{' ? 'key' : 'value';
        } else if (c === (top === '{' ? '}' : ']')) {
          stack.pop();
          i++;
        } else {
          return i;
        }
        break;
      }
    }
  }
}

function scanString(text: string, start: number): Scan {
  const n = text.length;
  let i = start + 1;
  while (i < n) {
    const c = text.charCodeAt(i);
    if (c === 0x22) return { ok: true, end: i + 1 };
    if (c < 0x20) return { ok: false, at: i };
    if (c === 0x5c) {
      const e = text[i + 1];
      if (e === undefined) return { ok: false, at: n };
      if ('"\\/bfnrt'.includes(e)) {
        i += 2;
        continue;
      }
      if (e !== 'u') return { ok: false, at: i };
      for (let k = 2; k <= 5; k++) {
        const h = i + k;
        if (h >= n) return { ok: false, at: n };
        if (!isHex(text.charCodeAt(h))) return { ok: false, at: i };
      }
      i += 6;
      continue;
    }
    i++;
  }
  return { ok: false, at: n };
}

function scanNumber(text: string, start: number): Scan {
  const n = text.length;
  let i = start;
  if (text[i] === '-') i++;
  if (text[i] === '0') {
    i++;
  } else if (isDigit(text.charCodeAt(i))) {
    while (i < n && isDigit(text.charCodeAt(i))) i++;
  } else {
    return { ok: false, at: i };
  }
  if (text[i] === '.') {
    i++;
    if (!isDigit(text.charCodeAt(i))) return { ok: false, at: i };
    while (i < n && isDigit(text.charCodeAt(i))) i++;
  }
  if (text[i] === 'e' || text[i] === 'E') {
    i++;
    if (text[i] === '+' || text[i] === '-') i++;
    if (!isDigit(text.charCodeAt(i))) return { ok: false, at: i };
    while (i < n && isDigit(text.charCodeAt(i))) i++;
  }
  return { ok: true, end: i };
}

function scanLiteral(text: string, start: number, word: string): Scan {
  for (let k = 0; k < word.length; k++) {
    const at = start + k;
    if (at >= text.length) return { ok: false, at: text.length };
    if (text[at] !== word[k]) return { ok: false, at: start };
  }
  return { ok: true, end: start + word.length };
}
