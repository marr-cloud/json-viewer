// @vitest-environment happy-dom
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { clickableUrls, linkMarkSpec, linkTarget, RELATIVE_URL_PATTERN, URL_PATTERN } from './urls';

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

describe('RELATIVE_URL_PATTERN', () => {
  const paths = (text: string) => text.match(RELATIVE_URL_PATTERN) ?? [];

  it('finds string values that are root-relative paths', () => {
    expect(paths('"breads": "/breads",')).toEqual(['/breads']);
    expect(paths('"byId": "/breads/:id", "q": "/search?q=a#top"')).toEqual(['/breads/:id', '/search?q=a#top']);
  });

  it('ignores keys, protocol-relative URLs, a lone slash and other text', () => {
    expect(paths('"/breads": 1')).toEqual([]);
    expect(paths('"/breads" : 1')).toEqual([]);
    expect(paths('"//cdn.test/a.js" "/" "a/b" "1/2/2026"')).toEqual([]);
  });

  it('only takes whole values', () => {
    expect(paths('"/a b" "see /docs"')).toEqual([]);
    expect(paths('"x\\"/y"')).toEqual([]);
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

describe('clickableUrls click handling', () => {
  let view: EditorView | undefined;
  let open: MockInstance<typeof window.open>;

  beforeEach(() => {
    vi.useFakeTimers();
    open = vi.spyOn(window, 'open').mockReturnValue(null);
  });

  afterEach(() => {
    view?.destroy();
    view = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  function mountLink(): HTMLElement {
    view = new EditorView({
      state: EditorState.create({
        doc: '"https://example.com/a"',
        extensions: clickableUrls({ wrapLinkWithAnchorTag: false, openLinksInNewWindow: true }),
      }),
      parent: document.body,
    });
    return view.dom.querySelector<HTMLElement>('.cm-url')!;
  }

  function linksIn(doc: string, baseUrl?: string): string[] {
    view = new EditorView({
      state: EditorState.create({
        doc,
        extensions: clickableUrls({ wrapLinkWithAnchorTag: true, openLinksInNewWindow: true }, baseUrl),
      }),
      parent: document.body,
    });
    return [...view.dom.querySelectorAll<HTMLAnchorElement>('.cm-url')].map((link) => link.getAttribute('href')!);
  }

  it('links root-relative paths against the page URL', () => {
    expect(linksIn('{"all": "/breads", "one": "/breads/:id"}', 'https://api.test/v1/x?y=1')).toEqual([
      'https://api.test/breads',
      'https://api.test/breads/:id',
    ]);
  });

  it('leaves relative paths alone without an http(s) page URL', () => {
    expect(linksIn('{"all": "/breads", "u": "https://a.test/"}')).toEqual(['https://a.test/']);
    expect(linksIn('{"all": "/breads"}', 'chrome-extension://abc/scratchpad.html')).toEqual([]);
  });

  const click = (target: HTMLElement) =>
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, detail: 1 }));

  it('opens the link after the double-click grace period', () => {
    click(mountLink());
    vi.advanceTimersByTime(399);
    expect(open).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(open).toHaveBeenCalledWith('https://example.com/a', '_blank', 'noopener');
  });

  it('does not open the link once the view is destroyed', () => {
    click(mountLink());
    view!.destroy();
    view = undefined;
    vi.advanceTimersByTime(1000);
    expect(open).not.toHaveBeenCalled();
  });

  it('does not open the link when a selection follows the click', () => {
    click(mountLink());
    view!.dispatch({ selection: { anchor: 1, head: 6 } });
    vi.advanceTimersByTime(1000);
    expect(open).not.toHaveBeenCalled();
  });
});
