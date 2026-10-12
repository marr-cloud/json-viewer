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

  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = decorator.createDeco(view);
      }
      update(update: ViewUpdate) {
        this.decorations = decorator.updateDeco(update, this.decorations);
      }
    },
    { decorations: (instance) => instance.decorations },
  );

  // The editor is contenteditable, so anchors don't navigate on their own.
  // The first click of a double-click has detail 1 too, so navigation waits briefly:
  // a follow-up click (detail > 1) or a drag selection cancels it.
  let pending: ReturnType<typeof setTimeout> | undefined;
  const cancelPending = (): void => {
    clearTimeout(pending);
    pending = undefined;
  };
  const clicks = EditorView.domEventHandlers({
    click(event, view) {
      if (event.button !== 0) return false;
      if (event.detail > 1 || !view.state.selection.main.empty) {
        cancelPending();
        return false;
      }
      const link = (event.target as HTMLElement | null)?.closest?.<HTMLElement>('.cm-url');
      const url = link?.dataset.url;
      if (!url) return false;
      event.preventDefault();
      cancelPending();
      pending = setTimeout(() => {
        pending = undefined;
        if (linkTarget(opts) === '_blank') window.open(url, '_blank', 'noopener');
        else window.location.href = url;
      }, DOUBLE_CLICK_GRACE_MS);
      return true;
    },
  });

  return [plugin, clicks];
}
