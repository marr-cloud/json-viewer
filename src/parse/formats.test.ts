import { describe, expect, it } from 'vitest';
import { setLocale } from '@/i18n';
import { parseDocument, parseJsonp, parseNdjson } from './formats';

const BOM = String.fromCharCode(0xfeff);

describe('parseJsonp', () => {
  it('parses the wrapped JSON', () => {
    expect(parseJsonp('cb({"a":1});')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseJsonp(BOM + '/**/ jQuery.cb([1, 2])')).toEqual({ ok: true, value: [1, 2] });
  });

  it('keeps big numbers', () => {
    const result = parseJsonp('cb({"id":12345678901234567890})');
    expect(result.ok && JSON.stringify(result.value)).toBe('{"id":12345678901234567890}');
  });

  it('reports errors where they are in the whole response', () => {
    const text = 'cb({\n  "a": 1,\n})';
    const result = parseJsonp(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ line: 3, column: 1, offset: text.indexOf('}') });
  });

  it('says so when the text is not JSONP', () => {
    expect(parseJsonp('{"a":1}')).toMatchObject({ ok: false, error: { line: 1, column: 1, offset: 0 } });
  });
});

describe('parseNdjson', () => {
  it('returns the values in order, skipping blank lines', () => {
    expect(parseNdjson('{"a":1}\n\n[2]\r\n"x"\n')).toEqual({ ok: true, value: [{ a: 1 }, [2], 'x'] });
    expect(parseNdjson(BOM + '1')).toEqual({ ok: true, value: [1] });
  });

  it('reports the line, column and offset of the first bad line', () => {
    const text = '{"a":1}\n{"b":}\n{"c":3}';
    const result = parseNdjson(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/^Line 2: /);
    expect(result.error).toMatchObject({ line: 2, column: 6, offset: text.indexOf('}', 8) });
  });

  it('fails on an empty document', () => {
    expect(parseNdjson(' \n\n')).toMatchObject({ ok: false, error: { message: 'No JSON values found' } });
  });

  it('words its own errors in the page language', () => {
    setLocale('es');
    try {
      expect(parseNdjson(' \n\n')).toMatchObject({ ok: false, error: { message: 'No se encontró ningún valor JSON' } });
      const result = parseNdjson('{"a":1}\n{"b":}');
      expect(!result.ok && result.error.message).toMatch(/^Línea 2: /);
    } finally {
      setLocale('en');
    }
  });
});

describe('parseDocument', () => {
  it('picks the parser for the kind', () => {
    expect(parseDocument('{"a":1}', 'json')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseDocument('cb(1)', 'jsonp')).toEqual({ ok: true, value: 1 });
    expect(parseDocument('1\n2', 'ndjson')).toEqual({ ok: true, value: [1, 2] });
    expect(parseDocument('1\n2', 'json').ok).toBe(false);
  });
});
