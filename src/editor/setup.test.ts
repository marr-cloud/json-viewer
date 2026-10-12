// @vitest-environment happy-dom
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultTheme } from '@/themes/builtin';
import { defaultViewerOptions, NO_RICH_VALUES, type RichValues, type ViewerOptions } from '@/viewer/options';
import type { ErrorLocation } from './errorLine';
import { buildExtensions } from './setup';

const create = (options: ViewerOptions, error: ErrorLocation | null = null) =>
  EditorState.create({
    doc: '{\n  "a": "https://example.com"\n}',
    extensions: buildExtensions({ options, theme: defaultTheme, error }),
  });

describe('buildExtensions', () => {
  it('creates a read-only state with the configured tab size', () => {
    const state = create({ ...defaultViewerOptions, tabSize: 4 });
    expect(state.readOnly).toBe(true);
    expect(state.tabSize).toBe(4);
  });

  it('accepts every feature switched on', () => {
    const all = { ...defaultViewerOptions, showArraySize: true, wrapLinkWithAnchorTag: true };
    expect(() => create(all, { line: 2, column: 1 })).not.toThrow();
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
  const mount = (options: ViewerOptions, error: ErrorLocation | null = null) => {
    view = new EditorView({ state: create(options, error), parent: document.body });
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
    const v = mount(defaultViewerOptions, { line: 2, column: null });
    const marked = v.dom.querySelectorAll('.cm-jv-error-line');
    expect(marked).toHaveLength(1);
    expect(v.dom.querySelectorAll('.cm-line')[1]).toBe(marked[0]);
  });

  it('marks the character at the error column', () => {
    const v = mount(defaultViewerOptions, { line: 2, column: 1 });
    const chars = v.dom.querySelectorAll('.cm-jv-error-char');
    expect(chars).toHaveLength(1);
    expect(chars[0]?.textContent).toBe(' ');
    expect(v.dom.querySelectorAll('.cm-jv-error-line')).toHaveLength(1);
  });

  it('does not paint a very long line, only the offending character', () => {
    const doc = '[' + '1,'.repeat(2000) + ']';
    view = new EditorView({
      state: EditorState.create({
        doc,
        extensions: buildExtensions({
          options: defaultViewerOptions,
          theme: defaultTheme,
          error: { line: 1, column: 101 },
        }),
      }),
      parent: document.body,
    });
    expect(view.dom.querySelectorAll('.cm-jv-error-line')).toHaveLength(0);
    expect(view.dom.querySelectorAll('.cm-jv-error-char')).toHaveLength(1);
  });

  const mountRich = (rich: RichValues | undefined) => {
    view = new EditorView({
      state: EditorState.create({
        doc: '["#ff0000"]',
        extensions: buildExtensions({ options: defaultViewerOptions, theme: defaultTheme, error: null, rich }),
      }),
      parent: document.body,
    });
    return view;
  };

  it('adds color swatches only when asked to', () => {
    expect(mountRich({ ...NO_RICH_VALUES, colorSwatches: true }).dom.querySelectorAll('.cm-jv-swatch')).toHaveLength(1);
    view?.destroy();
    expect(mountRich(NO_RICH_VALUES).dom.querySelectorAll('.cm-jv-swatch')).toHaveLength(0);
    view?.destroy();
    expect(mountRich(undefined).dom.querySelectorAll('.cm-jv-swatch')).toHaveLength(0);
  });

  it('accepts every value decoration switched on', () => {
    expect(() => mountRich({ colorSwatches: true, dateTooltips: true, imagePreview: true })).not.toThrow();
  });
});
