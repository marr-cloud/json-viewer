import { describe, expect, it } from 'vitest';
import { defaultViewerOptions } from './options';
import { prepareDocument } from './prepare';

describe('defaultViewerOptions', () => {
  it('mirrors the original extension defaults', () => {
    expect(defaultViewerOptions).toEqual({
      showHeader: true,
      sortKeys: false,
      clickableUrls: true,
      wrapLinkWithAnchorTag: false,
      openLinksInNewWindow: true,
      autoHighlight: true,
      lineNumbers: true,
      lineWrapping: true,
      foldGutter: true,
      tabSize: 2,
      indentCStyle: false,
      showArraySize: false,
      foldFromLevel: 0,
      lightModeThresholdMB: 20,
    });
  });
});

describe('prepareDocument', () => {
  it('formats valid JSON with the configured tab size', () => {
    expect(prepareDocument('{"a":[1]}', defaultViewerOptions)).toEqual({
      ok: true,
      text: '{\n  "a": [\n    1\n  ]\n}',
      value: { a: [1] },
      kind: 'json',
    });
    expect(prepareDocument('{"a":1}', { ...defaultViewerOptions, tabSize: 4 })).toEqual({
      ok: true,
      text: '{\n    "a": 1\n}',
      value: { a: 1 },
      kind: 'json',
    });
  });

  it('returns the raw text and a located error for invalid JSON', () => {
    const result = prepareDocument('{\n  "a": 1,\n}', defaultViewerOptions);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.text).toBe('{\n  "a": 1,\n}');
    expect(result.error).toMatchObject({ line: 3, column: 1 });
  });

  it('strips the BOM from valid and invalid input', () => {
    expect(prepareDocument('\uFEFF{"a":1}', defaultViewerOptions)).toEqual({
      ok: true,
      text: '{\n  "a": 1\n}',
      value: { a: 1 },
      kind: 'json',
    });
    const invalid = prepareDocument('\uFEFF{', defaultViewerOptions);
    expect(invalid.text).toBe('{');
  });

  it('does not throw on extremely deep nesting', () => {
    const depth = 100_000;
    const raw = '['.repeat(depth) + ']'.repeat(depth);
    for (const indentCStyle of [false, true]) {
      const result = prepareDocument(raw, { ...defaultViewerOptions, indentCStyle });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.text).toBe(raw);
      expect(result.error).toEqual({
        message: 'Document is nested too deeply to format',
        line: null,
        column: null,
        offset: null,
      });
    }
  });

  it.each([
    ['42', '42'],
    ['"s"', '"s"'],
    ['null', 'null'],
    ['{}', '{}'],
    ['[]', '[]'],
  ])('handles root value %s', (raw, text) => {
    expect(prepareDocument(raw, defaultViewerOptions)).toEqual({ ok: true, text, value: JSON.parse(raw), kind: 'json' });
  });

  it('reports an empty body as an error', () => {
    const result = prepareDocument('', defaultViewerOptions);
    expect(result.ok).toBe(false);
  });
});

describe('prepareDocument with other formats', () => {
  it('unwraps JSONP and splits NDJSON into an array', () => {
    expect(prepareDocument('cb({"a":1})', defaultViewerOptions, 'jsonp')).toEqual({
      ok: true,
      text: '{\n  "a": 1\n}',
      value: { a: 1 },
      kind: 'jsonp',
    });
    expect(prepareDocument('{"a":1}\n{"a":2}\n', defaultViewerOptions, 'ndjson')).toMatchObject({
      ok: true,
      value: [{ a: 1 }, { a: 2 }],
      kind: 'ndjson',
    });
  });

  it('shows NDJSON sent as JSON as NDJSON', () => {
    expect(prepareDocument('{"a":1}\n{"a":2}', defaultViewerOptions, 'json')).toMatchObject({ ok: true, kind: 'ndjson' });
  });

  it('keeps the asked-for kind when nothing parses, with the raw text', () => {
    expect(prepareDocument('cb({"a":})', defaultViewerOptions, 'jsonp')).toMatchObject({
      ok: false,
      kind: 'jsonp',
      text: 'cb({"a":})',
    });
    expect(prepareDocument('{"a":1}\n{oops}', defaultViewerOptions, 'json')).toMatchObject({ ok: false, kind: 'json' });
  });
});
