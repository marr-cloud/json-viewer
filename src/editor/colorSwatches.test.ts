// @vitest-environment happy-dom
import { json } from '@codemirror/lang-json';
import { ensureSyntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { colorSwatches, cssColor } from './colorSwatches';

describe('cssColor', () => {
  it('accepts hex, rgb() and hsl() colors in both syntaxes', () => {
    for (const color of [
      '#fff',
      '#FFAA00',
      '#ff550080',
      'rgb(1, 2, 3)',
      'rgba(1,2,3,0.5)',
      'rgb(1 2 3 / 50%)',
      'RGB(10%,20%,30%)',
      'hsl(120, 50%, 50%)',
      'hsla(120deg,50%,50%,.3)',
      'hsl(0.5turn 50% 50% / 0.2)',
    ]) {
      expect(cssColor(color), color).toBe(color);
    }
  });

  it('rejects anything else', () => {
    for (const value of [
      '#ff',
      '#ffff',
      '#fffff',
      '#ggg',
      'rgb(1,2)',
      'red',
      'rgb(1,2,3',
      'url(x)',
      'rgb(1,2,3);color:red',
      'hsl(1,2,3)',
      ' #fff',
      '',
    ]) {
      expect(cssColor(value), value).toBeNull();
    }
  });
});

describe('colorSwatches', () => {
  let view: EditorView | undefined;
  afterEach(() => {
    view?.destroy();
    view = undefined;
  });

  const mount = (doc: string) => {
    const state = EditorState.create({ doc, extensions: [json(), colorSwatches()] });
    ensureSyntaxTree(state, doc.length, 5000);
    // A no-op transaction moves the finished parse into the state.
    view = new EditorView({ state: state.update({}).state, parent: document.body });
    return view;
  };
  const swatches = (v: EditorView) =>
    [...v.dom.querySelectorAll<HTMLElement>('.cm-jv-swatch')].map((swatch) => swatch.style.backgroundColor);

  it('puts a swatch inside color values, not keys or other strings', () => {
    const v = mount('{\n  "#fff": "#ff5500",\n  "c": "rgb(1, 2, 3)",\n  "x": "#ggg",\n  "t": "see #fff"\n}');
    expect(swatches(v)).toEqual(['#ff5500', 'rgb(1, 2, 3)']);
  });

  it('draws the swatch right after the opening quote and hides it from screen readers', () => {
    const v = mount('["#00ff00"]');
    const swatch = v.dom.querySelector('.cm-jv-swatch')!;
    expect(swatch.getAttribute('aria-hidden')).toBe('true');
    expect(v.posAtDOM(swatch)).toBe(2);
  });

  it('follows document changes', () => {
    const v = mount('["#000"]');
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: '["#111", "#222"]' } });
    expect(swatches(v)).toHaveLength(2);
  });
});
