import { describe, expect, it } from 'vitest';
import { locateError, offsetToLineColumn, parseJson, stripBom } from './parse';

describe('parseJson', () => {
  it('parses valid JSON', () => {
    expect(parseJson('{"a":[1,true,null]}')).toEqual({ ok: true, value: { a: [1, true, null] } });
  });

  it('ignores a leading UTF-8 BOM', () => {
    expect(parseJson('﻿{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it('preserves integers beyond Number.MAX_SAFE_INTEGER verbatim', () => {
    const result = parseJson('{"big":12345678901234567890,"small":7}');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const value = result.value as { big: unknown; small: unknown };
    expect(JSON.isRawJSON(value.big)).toBe(true);
    expect(value.small).toBe(7);
    expect(JSON.stringify(value)).toBe('{"big":12345678901234567890,"small":7}');
  });

  it('returns plain numbers when no long digit run exists', () => {
    const result = parseJson('{"f":1.0}');
    expect(result).toEqual({ ok: true, value: { f: 1 } });
  });

  it.each([
    ['{"a":1,}', 1, 8],
    ['{\n  "a": 1,\n}', 3, 1],
    ['[1,2', 1, 5],
    ['', 1, 1],
  ])('locates the error in %j at line %i column %i', (text, line, column) => {
    const result = parseJson(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.line).toBe(line);
    expect(result.error.column).toBe(column);
    expect(result.error.message.length).toBeGreaterThan(0);
  });
});

describe('stripBom', () => {
  it('removes only a leading BOM', () => {
    expect(stripBom('﻿a﻿')).toBe('a﻿');
    expect(stripBom('abc')).toBe('abc');
  });
});

describe('locateError', () => {
  it('prefers explicit line/column in the message', () => {
    expect(locateError('x', 'bad at position 0 (line 4 column 2)')).toEqual({ line: 4, column: 2 });
  });

  it('falls back to the position', () => {
    expect(locateError('a\nbc', 'bad at position 3')).toEqual({ line: 2, column: 2 });
  });

  it('returns nulls when the message has no location', () => {
    expect(locateError('abc', 'Unexpected token')).toEqual({ line: null, column: null });
  });
});

describe('offsetToLineColumn', () => {
  it('counts lines and 1-based columns', () => {
    expect(offsetToLineColumn('ab\ncd\nef', 7)).toEqual({ line: 3, column: 2 });
  });
});
