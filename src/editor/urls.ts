import type { Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import type { ViewerOptions } from '@/viewer/options';

type LinkOptions = Pick<ViewerOptions, 'wrapLinkWithAnchorTag' | 'openLinksInNewWindow'>;

const DOUBLE_CLICK_GRACE_MS = 400;

export const URL_PATTERN = /\bhttps?:\/\/[^\s"\\<>]+/g;

/** A whole string value that is a root-relative path ("/breads/:id"); not a key, "//host" or a lone "/". */
export const RELATIVE_URL_PATTERN = /(?<=(?:^|[^\\])")\/[^\s"\\<>/][^\s"\\<>]*(?="(?!\s*:))/g;

/** The base root-relative paths resolve against: only an http(s) page has one. */
function linkBase(pageUrl: string | undefined): string | null {
  if (pageUrl === undefined) return null;
  try {
    const url = new URL(pageUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function linkTarget(opts: Pick<ViewerOptions, 'openLinksInNewWindow'>): '_blank' | '_self' {
  return opts.openLinksInNewWindow ? '_blank' : '_self';
}

export function linkMarkSpec(
  url: string,
  opts: LinkOptions,
): { tagName: string; class: string; attributes: Record<string, string> } {
  if (opts.wrapLinkWithAnchorTag) {
    return {
      tagName: 'a',
      class: 'cm-url',
      attributes: { href: url, target: linkTarget(opts), rel: 'noopener noreferrer', 'data-url': url },
    };
  }
  return { tagName: 'span', class: 'cm-url', attributes: { 'data-url': url } };
}

/** Links http(s) URLs, and root-relative paths against `pageUrl` when it is an http(s) page. */
export function clickableUrls(opts: LinkOptions, pageUrl?: string): Extension {
  const base = linkBase(pageUrl);
  const decorator = new MatchDecorator({
    regexp: base === null ? URL_PATTERN : new RegExp(`${URL_PATTERN.source}|${RELATIVE_URL_PATTERN.source}`, 'g'),
    decoration: (match) =>
      Decoration.mark(linkMarkSpec(base === null ? match[0] : new URL(match[0], base).href, opts)),
  });

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      pending: ReturnType<typeof setTimeout> | undefined;

      constructor(view: EditorView) {
        this.decorations = decorator.createDeco(view);
      }

      update(update: ViewUpdate) {
        this.decorations = decorator.updateDeco(update, this.decorations);
        // A selection right after the click (Shift+arrows, a drag) means the user is selecting text.
        if (update.selectionSet && !update.state.selection.main.empty) this.cancel();
      }

      cancel(): void {
        clearTimeout(this.pending);
        this.pending = undefined;
      }

      destroy() {
        this.cancel();
      }
    },
    {
      decorations: (instance) => instance.decorations,
      // The editor is contenteditable, so anchors don't navigate on their own.
      // The first click of a double-click has detail 1 too, so navigation waits briefly:
      // a follow-up click (detail > 1) or a selection cancels it.
      eventHandlers: {
        click(event, view) {
          if (event.button !== 0) return false;
          if (event.detail > 1 || !view.state.selection.main.empty) {
            this.cancel();
            return false;
          }
          const link = (event.target as HTMLElement | null)?.closest?.<HTMLElement>('.cm-url');
          const url = link?.dataset.url;
          if (!url) return false;
          event.preventDefault();
          this.cancel();
          this.pending = setTimeout(() => {
            this.pending = undefined;
            if (linkTarget(opts) === '_blank') window.open(url, '_blank', 'noopener');
            else window.location.href = url;
          }, DOUBLE_CLICK_GRACE_MS);
          return true;
        },
      },
    },
  );
}
