import { describe, expect, it } from 'vitest';
import { formatJson } from './format';
import { parseJson } from './parse';

const plain = { indent: 2, sortKeys: false, cStyle: false };
const sample = { a: 1, b: [1, { c: null }], d: {}, e: [] };

describe('formatJson', () => {
  it('matches JSON.stringify for the default options', () => {
    expect(formatJson(sample, plain)).toBe(JSON.stringify(sample, null, 2));
  });

  it('respects the indent size', () => {
    expect(formatJson({ a: [1] }, { ...plain, indent: 4 })).toBe('{\n    "a": [\n        1\n    ]\n}');
  });

  it('sorts keys recursively', () => {
    const out = formatJson({ b: 1, a: { d: 1, c: 2 } }, { ...plain, sortKeys: true });
    expect(out).toBe('{\n  "a": {\n    "c": 2,\n    "d": 1\n  },\n  "b": 1\n}');
  });

  it('produces the same layout as JSON.stringify when sorting already-sorted input', () => {
    const sorted = { a: 1, b: [1, { c: null }], d: {}, e: [] };
    expect(formatJson(sorted, { ...plain, sortKeys: true })).toBe(JSON.stringify(sorted, null, 2));
  });

  it('puts non-empty container values on their own line in C style', () => {
    expect(formatJson(sample, { ...plain, cStyle: true })).toBe(
      [
        '{',
        '  "a": 1,',
        '  "b":',
        '  [',
        '    1,',
        '    {',
        '      "c": null',
        '    }',
        '  ],',
        '  "d": {},',
        '  "e": []',
        '}',
      ].join('\n'),
    );
  });

  it('keeps big numbers verbatim in every mode', () => {
    const parsed = parseJson('{"n":12345678901234567890}');
    if (!parsed.ok) throw new Error('fixture must parse');
    for (const options of [plain, { ...plain, sortKeys: true }, { ...plain, cStyle: true }]) {
      expect(formatJson(parsed.value, options)).toContain('"n": 12345678901234567890');
    }
  });

  it('keeps __proto__ and constructor keys', () => {
    const parsed = parseJson('{"constructor":2,"__proto__":{"x":1}}');
    if (!parsed.ok) throw new Error('fixture must parse');
    const out = formatJson(parsed.value, { ...plain, sortKeys: true });
    expect(out).toBe('{\n  "__proto__": {\n    "x": 1\n  },\n  "constructor": 2\n}');
  });

  it('formats primitives at the root', () => {
    expect(formatJson(42, plain)).toBe('42');
    expect(formatJson('s', plain)).toBe('"s"');
    expect(formatJson(null, { ...plain, cStyle: true })).toBe('null');
  });
});
