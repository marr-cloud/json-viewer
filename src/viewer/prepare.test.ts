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
    });
  });
});

describe('prepareDocument', () => {
  it('formats valid JSON with the configured tab size', () => {
    expect(prepareDocument('{"a":[1]}', defaultViewerOptions)).toEqual({
      ok: true,
      text: '{\n  "a": [\n    1\n  ]\n}',
    });
    expect(prepareDocument('{"a":1}', { ...defaultViewerOptions, tabSize: 4 })).toEqual({
      ok: true,
      text: '{\n    "a": 1\n}',
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
    expect(prepareDocument(raw, defaultViewerOptions)).toEqual({ ok: true, text });
  });

  it('reports an empty body as an error', () => {
    const result = prepareDocument('', defaultViewerOptions);
    expect(result.ok).toBe(false);
  });
});
