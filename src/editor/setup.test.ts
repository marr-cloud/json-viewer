// @vitest-environment happy-dom
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultTheme } from '@/themes/builtin';
import { defaultViewerOptions, type ViewerOptions } from '@/viewer/options';
import { buildExtensions } from './setup';

const create = (options: ViewerOptions, errorLine: number | null = null) =>
  EditorState.create({
    doc: '{\n  "a": "https://example.com"\n}',
    extensions: buildExtensions({ options, theme: defaultTheme, errorLine }),
  });

describe('buildExtensions', () => {
  it('creates a read-only state with the configured tab size', () => {
    const state = create({ ...defaultViewerOptions, tabSize: 4 });
    expect(state.readOnly).toBe(true);
    expect(state.tabSize).toBe(4);
  });

  it('accepts every feature switched on', () => {
    const all = { ...defaultViewerOptions, showArraySize: true, wrapLinkWithAnchorTag: true };
    expect(() => create(all, 2)).not.toThrow();
  });

  it('accepts every feature switched off', () => {
    const none: ViewerOptions = {
      ...defaultViewerOptions,
      clickableUrls: false,
      lineNumbers: false,
      lineWrapping: false,
      foldGutter: false,
      showArraySize: false,
    };
    expect(() => create(none)).not.toThrow();
  });
});

describe('buildExtensions in a mounted view', () => {
  let view: EditorView | undefined;
  const mount = (options: ViewerOptions, errorLine: number | null = null) => {
    view = new EditorView({ state: create(options, errorLine), parent: document.body });
    return view;
  };
  afterEach(() => {
    view?.destroy();
    view = undefined;
  });

  it('renders line numbers, fold gutter and wrapping when enabled', () => {
    const v = mount({ ...defaultViewerOptions, lineNumbers: true, foldGutter: true, lineWrapping: true });
    expect(v.dom.querySelector('.cm-lineNumbers')).not.toBeNull();
    expect(v.dom.querySelector('.cm-foldGutter')).not.toBeNull();
    expect(v.contentDOM.classList.contains('cm-lineWrapping')).toBe(true);
  });

  it('omits them when disabled', () => {
    const v = mount({ ...defaultViewerOptions, lineNumbers: false, foldGutter: false, lineWrapping: false });
    expect(v.dom.querySelector('.cm-lineNumbers')).toBeNull();
    expect(v.dom.querySelector('.cm-foldGutter')).toBeNull();
    expect(v.contentDOM.classList.contains('cm-lineWrapping')).toBe(false);
  });

  it('marks exactly the requested error line', () => {
    const v = mount(defaultViewerOptions, 2);
    const marked = v.dom.querySelectorAll('.cm-jv-error-line');
    expect(marked).toHaveLength(1);
    expect(v.dom.querySelectorAll('.cm-line')[1]).toBe(marked[0]);
  });
});
