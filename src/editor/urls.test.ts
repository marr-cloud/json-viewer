// @vitest-environment happy-dom
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { clickableUrls, linkMarkSpec, linkTarget, URL_PATTERN } from './urls';

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
