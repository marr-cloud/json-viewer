// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { readRawText } from './readRawText';

function docWith(bodyHtml: string): Document {
  document.body.innerHTML = bodyHtml;
  return document;
}

describe('readRawText', () => {
  it('reads a lone <pre>', () => {
    expect(readRawText(docWith('<pre>{"a":1}</pre>'))).toBe('{"a":1}');
  });

  it('accepts the native JSON viewer container next to the <pre>', () => {
    expect(
      readRawText(docWith('<pre>{"a":1}</pre><div class="json-formatter-container"></div>')),
    ).toBe('{"a":1}');
    expect(
      readRawText(docWith('<div class="json-formatter-container"></div><pre>[1]</pre>')),
    ).toBe('[1]');
  });

  it('keeps whitespace and newlines', () => {
    expect(readRawText(docWith('<pre>{\n  "a": 1\n}</pre>'))).toBe('{\n  "a": 1\n}');
  });

  it.each([
    ['regular html', '<h1>Hi</h1>'],
    ['pre plus other element', '<pre>a</pre><p>b</p>'],
    ['two pres', '<pre>a</pre><pre>b</pre>'],
    ['empty body', ''],
    ['other div', '<pre>a</pre><div class="something"></div>'],
  ])('returns null for %s', (_label, html) => {
    expect(readRawText(docWith(html))).toBeNull();
  });
});
