// @vitest-environment happy-dom
import { json } from '@codemirror/lang-json';
import { ensureSyntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { imageTooltipAt, imageUrl } from './imagePreview';

describe('imageUrl', () => {
  it('accepts http(s) URLs whose path ends in an image extension', () => {
    for (const url of [
      'https://example.com/a.png',
      'http://example.com/b/c.JPG',
      'https://example.com/d.jpeg?size=2#x',
      'https://example.com/e.gif',
      'https://example.com/f.webp',
      'https://upload.wikimedia.org/wikipedia/commons/c/c9/JSON_vector_logo.svg',
      'https://example.com/g.avif',
    ]) {
      expect(imageUrl(url), url).toBe(new URL(url).href);
    }
  });

  it('rejects other URLs and schemes', () => {
    for (const value of [
      'https://example.com/a.png.html',
      'https://example.com/?file=a.png',
      'ftp://example.com/a.png',
      'data:image/png;base64,AAAA',
      'javascript:alert(1)//.png',
      'a.png',
      '',
    ]) {
      expect(imageUrl(value), value).toBeNull();
    }
  });
});

describe('imageTooltipAt', () => {
  let view: EditorView | undefined;
  afterEach(() => {
    view?.destroy();
    view = undefined;
  });

  const DOC = '{\n  "icon": "https://example.com/i.png",\n  "https://example.com/k.png": 1,\n  "page": "https://example.com/"\n}';
  const mount = () => {
    const state = EditorState.create({ doc: DOC, extensions: [json()] });
    ensureSyntaxTree(state, DOC.length, 5000);
    view = new EditorView({ state: state.update({}).state, parent: document.body });
    return view;
  };
  const tooltipAt = (v: EditorView, needle: string) => imageTooltipAt(v, DOC.indexOf(needle) + 3, 1);

  it('shows the image for image URLs, without a referrer', () => {
    const v = mount();
    const dom = tooltipAt(v, '"https://example.com/i.png"')!.create(v).dom;
    const img = dom.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://example.com/i.png');
    expect(img.referrerPolicy).toBe('no-referrer');
    expect(dom.textContent).toContain('Loading…');
  });

  it('says so when the image fails to load', () => {
    const v = mount();
    const dom = tooltipAt(v, '"https://example.com/i.png"')!.create(v).dom;
    dom.querySelector('img')!.dispatchEvent(new Event('error'));
    expect(dom.querySelector('img')).toBeNull();
    expect(dom.textContent).toBe('The image could not be loaded.');
  });

  it('shows the natural size once the image loads', () => {
    const v = mount();
    const dom = tooltipAt(v, '"https://example.com/i.png"')!.create(v).dom;
    const img = dom.querySelector('img')!;
    Object.defineProperty(img, 'naturalWidth', { value: 2 });
    Object.defineProperty(img, 'naturalHeight', { value: 3 });
    img.dispatchEvent(new Event('load'));
    expect(dom.querySelector('.cm-jv-image-info')!.textContent).toBe('2 × 3');
    expect(dom.querySelector('img')).not.toBeNull();
  });

  it('ignores keys and URLs that are not images', () => {
    const v = mount();
    expect(tooltipAt(v, '"https://example.com/k.png"')).toBeNull();
    expect(tooltipAt(v, '"https://example.com/"')).toBeNull();
  });
});
