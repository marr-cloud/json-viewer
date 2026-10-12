import { describe, expect, it } from 'vitest';
import { formatPath } from '@/editor/cursorPath';
import { parseJson } from '@/parse/parse';
import { filterDocument } from './jsonPath';

const FORMAT = { indent: 2, sortKeys: false, cStyle: false };
const DOC = { a: { list: [{ id: 1, n: 'x' }, { id: 2, n: 'y' }, { id: 3 }] } };

describe('filterDocument', () => {
  it('returns the matches as a formatted array', () => {
    expect(filterDocument(DOC, '$.a.list[*].id', FORMAT)).toEqual({
      ok: true,
      text: '[\n  1,\n  2,\n  3\n]',
      value: [1, 2, 3],
      count: 3,
    });
  });

  it('evaluates filter expressions without eval', () => {
    const result = filterDocument(DOC, '$.a.list[?(@.id > 1)].n', FORMAT);
    expect(result).toMatchObject({ ok: true, value: ['y'], count: 1 });
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterDocument(DOC, '$.nope', FORMAT)).toEqual({ ok: true, text: '[]', value: [], count: 0 });
  });

  it('reports syntax errors', () => {
    const result = filterDocument(DOC, '$.a.list[?(@.id >', FORMAT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).not.toBe('');
  });

  it('cannot reach globals or constructors from a filter', () => {
    for (const path of ['$.a.list[?(alert(1))]', '$.a.list[?(@.constructor.constructor("return 1")())]']) {
      expect(filterDocument(DOC, path, FORMAT).ok).toBe(false);
    }
  });

  it('keeps big numbers exact', () => {
    const parsed = parseJson('{"big":12345678901234567890}');
    if (!parsed.ok) throw new Error('fixture must parse');
    expect(filterDocument(parsed.value, '$.big', FORMAT)).toMatchObject({ ok: true, text: '[\n  12345678901234567890\n]' });
  });

  it('formats with the viewer options', () => {
    const result = filterDocument({ b: 1, a: 2 }, '$', { indent: 4, sortKeys: true, cStyle: false });
    expect(result).toMatchObject({ ok: true, text: '[\n    {\n        "a": 2,\n        "b": 1\n    }\n]' });
  });

  it('finds the value at a copied cursor path', () => {
    const keys = ['a-b', 'k"q', 'a b', 'ñ', '$ref', '', 'a.b', '0', 'x(y)'];
    const doc = Object.fromEntries(keys.map((key, i) => [key, { v: [i, { w: i }] }]));
    keys.forEach((key, i) => {
      expect(filterDocument(doc, formatPath([key, 'v', 1, 'w']), FORMAT)).toMatchObject({ ok: true, value: [i] });
    });
  });

  it('works on documents that are not objects', () => {
    expect(filterDocument(5, '$', FORMAT)).toMatchObject({ ok: true, value: [5] });
    expect(filterDocument([null], '$[0]', FORMAT)).toMatchObject({ ok: true, value: [null] });
  });
});
