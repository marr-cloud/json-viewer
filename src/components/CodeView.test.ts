// @vitest-environment happy-dom
import { foldAll, foldEffect, foldedRanges } from '@codemirror/language';
import type { TransactionSpec } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, reactive, ref, type App } from 'vue';
import type { ErrorLocation } from '@/editor/errorLine';
import { defaultTheme } from '@/themes/builtin';
import { defaultViewerOptions, type ViewerOptions } from '@/viewer/options';
import CodeView from './CodeView.vue';

let app: App | undefined;
let host: HTMLElement | undefined;

function mount(doc: string, error: ErrorLocation | null = null, options: Partial<ViewerOptions> = {}) {
  host = document.createElement('div');
  document.body.append(host);
  const state = reactive({ doc, options: { ...defaultViewerOptions, ...options }, error });
  const component = ref<InstanceType<typeof CodeView>>();
  app = createApp({
    render: () =>
      h(CodeView, { ref: component, doc: state.doc, options: state.options, theme: defaultTheme, error: state.error }),
  });
  app.mount(host);
  const editor = host.querySelector<HTMLElement>('.cm-editor')!;
  return { state, editor, view: EditorView.findFromDOM(editor)!, component };
}

const NESTED = '{\n  "a": {\n    "b": [\n      1\n    ]\n  }\n}';
const foldCount = (view: EditorView) => foldedRanges(view.state).size;

afterEach(() => {
  app?.unmount();
  host?.remove();
  document.body.innerHTML = '';
});

describe('CodeView', () => {
  it('folds from the configured level on open', () => {
    const { view } = mount(NESTED, null, { foldFromLevel: 2 });
    expect(foldCount(view)).toBe(2);
  });

  it('folds again when the document is replaced', async () => {
    const { state, view } = mount(NESTED, null, { foldFromLevel: 3 });
    state.doc = '{\n  "x": {\n    "y": [\n      2\n    ]\n  }\n}';
    await nextTick();
    expect(foldCount(view)).toBe(1);
  });

  it('folds once when the document and the level change together', async () => {
    const { state, view } = mount(NESTED);
    const dispatch = vi.spyOn(view, 'dispatch');
    state.doc = '{\n  "x": {\n    "y": [\n      2\n    ]\n  }\n}';
    state.options = { ...state.options, foldFromLevel: 2 };
    await nextTick();
    const folding = dispatch.mock.calls.filter(([spec]) =>
      [(spec as TransactionSpec).effects ?? []].flat().some((effect) => effect.is(foldEffect)),
    );
    expect(folding).toHaveLength(1);
    expect(foldCount(view)).toBe(2);
  });

  it('applies a new level live and unfolds at 0', async () => {
    const { state, view } = mount(NESTED);
    expect(foldCount(view)).toBe(0);
    state.options = { ...state.options, foldFromLevel: 2 };
    await nextTick();
    expect(foldCount(view)).toBe(2);
    state.options = { ...state.options, foldFromLevel: 0 };
    await nextTick();
    expect(foldCount(view)).toBe(0);
  });

  it('does not fold an invalid document', () => {
    const { view } = mount('{\n  "a": {\n    "b": 1,\n  }\n}', { line: 4, column: 3 }, { foldFromLevel: 1 });
    expect(foldCount(view)).toBe(0);
  });

  it('exposes folding by level and unfolding', () => {
    const { view, component } = mount(NESTED);
    component.value!.foldFromLevel(3);
    expect(foldCount(view)).toBe(1);
    component.value!.unfoldAll();
    expect(foldCount(view)).toBe(0);
  });

  it('keeps the same editor and its folds when options change', async () => {
    const { state, editor, view } = mount('{\n  "a": [\n    1,\n    2\n  ]\n}');
    foldAll(view);
    expect(editor.querySelectorAll('.cm-foldPlaceholder').length).toBeGreaterThan(0);
    state.options = { ...state.options, lineNumbers: false };
    await nextTick();
    expect(host!.querySelector('.cm-editor')).toBe(editor);
    expect(editor.querySelector('.cm-lineNumbers')).toBeNull();
    expect(editor.querySelectorAll('.cm-foldPlaceholder').length).toBeGreaterThan(0);
  });

  it('focuses the editor on mount but not when options change', async () => {
    const { state, view } = mount('{"a": 1}');
    expect(document.activeElement).toBe(view.contentDOM);
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    state.options = { ...state.options, tabSize: 4 };
    await nextTick();
    expect(document.activeElement).toBe(input);
  });

  it('replaces the document when it changes', async () => {
    const { state, view } = mount('{"a": 1}');
    state.doc = '[1, 2]';
    await nextTick();
    expect(view.state.doc.toString()).toBe('[1, 2]');
  });

  it('puts the cursor on the error', () => {
    const { view } = mount('{\n  "a": 1,\n}', { line: 3, column: 1 });
    expect(view.state.selection.main.head).toBe(12);
  });

  it('emits the cursor path', async () => {
    host = document.createElement('div');
    document.body.append(host);
    const paths: string[] = [];
    app = createApp({
      render: () =>
        h(CodeView, {
          doc: '{\n  "a": [\n    1\n  ]\n}',
          options: defaultViewerOptions,
          theme: defaultTheme,
          error: null,
          onPath: (path: string) => paths.push(path),
        }),
    });
    app.mount(host);
    const view = EditorView.findFromDOM(host.querySelector<HTMLElement>('.cm-editor')!)!;
    expect(paths).toEqual(['$']);
    // happy-dom fires selectionchange synchronously, which re-enters a focused editor's update.
    view.contentDOM.blur();
    view.dispatch({ selection: { anchor: view.state.doc.toString().indexOf('1') } });
    expect(paths.at(-1)).toBe('$.a[0]');
  });
});
