import { describe, expect, it } from 'vitest';
import { findErrorOffset, locateError, offsetToLineColumn, parseJson, stripBom } from './parse';

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

  it('keeps non-canonical short numbers plain even when a big number is present', () => {
    const result = parseJson('{"f":1.0,"e":1e2,"big":12345678901234567890}');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const value = result.value as { f: unknown; e: unknown; big: unknown };
    expect(value.f).toBe(1);
    expect(value.e).toBe(100);
    expect(JSON.isRawJSON(value.big)).toBe(true);
  });

  it('round-trips a decimal with more than 15 significant digits', () => {
    const result = parseJson('{"d":0.12345678901234567891}');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(result.value)).toBe('{"d":0.12345678901234567891}');
  });

  it('round-trips a big integer at the root', () => {
    const result = parseJson('12345678901234567890');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.isRawJSON(result.value)).toBe(true);
    expect(JSON.stringify(result.value)).toBe('12345678901234567890');
  });

  it('round-trips a big integer inside an array', () => {
    const result = parseJson('[12345678901234567890]');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(result.value)).toBe('[12345678901234567890]');
  });

  it.each([
    ['{"a":1,}', 1, 8],
    ['{\n  "a": 1,\n}', 3, 1],
    ['[1,2', 1, 5],
    ['', 1, 1],
    ['abc', 1, 1],
    ['{"a": undefined}', 1, 7],
    ['{"a":NaN}', 1, 6],
    ['[1,\n2,\n  oops]', 3, 3],
    ['x position 3 y', 1, 1],
    ['{"a":1} x', 1, 9],
    ['"tab\there"', 1, 5],
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

describe('findErrorOffset', () => {
  it('returns -1 for valid JSON', () => {
    expect(findErrorOffset('{"a":[1,{"b":null}]}')).toBe(-1);
  });

  it('accepts an escaped backslash', () => {
    expect(findErrorOffset('["\\\\"]')).toBe(-1);
  });

  it('reports a trailing comma after an escaped backslash', () => {
    expect(findErrorOffset('{"p":"C:\\\\x",}')).toBe(13);
  });

  it('returns -1 for deeply nested valid JSON without recursion', () => {
    expect(findErrorOffset('['.repeat(100000) + ']'.repeat(100000))).toBe(-1);
  });

  it('returns the depth reached for deeply nested truncated JSON', () => {
    expect(findErrorOffset('['.repeat(100000))).toBe(100000);
  });

  it('points at the backslash of an invalid escape', () => {
    expect(findErrorOffset('"\\x"')).toBe(1);
  });

  it('points at the end when the input ends early', () => {
    expect(findErrorOffset('[1,2')).toBe(4);
  });
});

describe('locateError', () => {
  it('returns nulls for valid JSON', () => {
    expect(locateError('{"a":1}')).toEqual({ line: null, column: null });
  });

  it('locates the first offending character', () => {
    expect(locateError('a\nbc')).toEqual({ line: 1, column: 1 });
  });
});

describe('offsetToLineColumn', () => {
  it('counts lines and 1-based columns', () => {
    expect(offsetToLineColumn('ab\ncd\nef', 7)).toEqual({ line: 3, column: 2 });
  });
});
