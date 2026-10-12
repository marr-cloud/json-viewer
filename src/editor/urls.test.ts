import { describe, expect, it } from 'vitest';
import { linkMarkSpec, linkTarget, URL_PATTERN } from './urls';

const urls = (text: string) => text.match(URL_PATTERN) ?? [];

describe('URL_PATTERN', () => {
  it('finds http(s) URLs inside JSON strings', () => {
    expect(urls('"u": "https://example.com/a?b=1#c",')).toEqual(['https://example.com/a?b=1#c']);
    expect(urls('"http://localhost:3000/x" "https://a.b"')).toEqual([
      'http://localhost:3000/x',
      'https://a.b',
    ]);
  });

  it('stops at quotes, whitespace and escapes', () => {
    expect(urls('"https://a.b/c\\"d"')).toEqual(['https://a.b/c']);
    expect(urls('"https://a.b/c d"')).toEqual(['https://a.b/c']);
  });

  it('ignores other schemes', () => {
    expect(urls('"ftp://a.b" "mailto:x@y.z"')).toEqual([]);
  });
});

describe('linkTarget', () => {
  it('follows openLinksInNewWindow', () => {
    expect(linkTarget({ openLinksInNewWindow: true })).toBe('_blank');
    expect(linkTarget({ openLinksInNewWindow: false })).toBe('_self');
  });
});

describe('linkMarkSpec', () => {
  it('builds a real anchor when wrapLinkWithAnchorTag is on', () => {
    expect(
      linkMarkSpec('https://a.b', { wrapLinkWithAnchorTag: true, openLinksInNewWindow: true }),
    ).toEqual({
      tagName: 'a',
      class: 'cm-url',
      attributes: {
        href: 'https://a.b',
        target: '_blank',
        rel: 'noopener noreferrer',
        'data-url': 'https://a.b',
      },
    });
  });

  it('builds a span otherwise', () => {
    expect(
      linkMarkSpec('https://a.b', { wrapLinkWithAnchorTag: false, openLinksInNewWindow: false }),
    ).toEqual({ tagName: 'span', class: 'cm-url', attributes: { 'data-url': 'https://a.b' } });
  });
});
