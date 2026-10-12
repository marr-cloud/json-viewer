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

export function clickableUrls(opts: LinkOptions): Extension {
  const decorator = new MatchDecorator({
    regexp: URL_PATTERN,
    decoration: (match) => Decoration.mark(linkMarkSpec(match[0], opts)),
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
