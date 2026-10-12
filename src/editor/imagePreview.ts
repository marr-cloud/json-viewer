import type { Extension } from '@codemirror/state';
import { hoverTooltip, type EditorView, type Tooltip } from '@codemirror/view';
import { valueTokenAt } from './jsonToken';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'];

/** The URL when `value` is an http(s) URL whose path ends in an image extension, else null. */
export function imageUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const path = url.pathname.toLowerCase();
  return IMAGE_EXTENSIONS.some((extension) => path.endsWith(extension)) ? url.href : null;
}

function imageTooltipDom(src: string): HTMLElement {
  const dom = document.createElement('div');
  dom.className = 'cm-jv-image';
  const info = document.createElement('div');
  info.className = 'cm-jv-image-info';
  info.textContent = 'Loading…';
  const img = document.createElement('img');
  img.alt = '';
  // The image is only requested when the tooltip opens, and without the page as referrer.
  img.referrerPolicy = 'no-referrer';
  img.addEventListener('load', () => {
    info.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
  });
  img.addEventListener('error', () => {
    img.remove();
    info.textContent = 'The image could not be loaded.';
  });
  img.src = src;
  dom.append(img, info);
  return dom;
}

/** The image tooltip for the string at `pos`, if it is an image URL. */
export function imageTooltipAt(view: EditorView, pos: number, side: -1 | 1): Tooltip | null {
  const token = valueTokenAt(view.state, pos, side);
  if (token?.kind !== 'string') return null;
  const src = imageUrl(token.value);
  if (src === null) return null;
  return { pos: token.from, end: token.to, above: true, create: () => ({ dom: imageTooltipDom(src) }) };
}

/** Hovering an image URL (.png, .jpg, .jpeg, .gif, .webp, .svg, .avif) shows a thumbnail. */
export function imagePreview(): Extension {
  return hoverTooltip(imageTooltipAt);
}
