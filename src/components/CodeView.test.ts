// @vitest-environment happy-dom
import { foldAll } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, reactive, type App } from 'vue';
import type { ErrorLocation } from '@/editor/errorLine';
import { defaultTheme } from '@/themes/builtin';
import { defaultViewerOptions } from '@/viewer/options';
import CodeView from './CodeView.vue';

let app: App | undefined;
let host: HTMLElement | undefined;

function mount(doc: string, error: ErrorLocation | null = null) {
  host = document.createElement('div');
  document.body.append(host);
  const state = reactive({ doc, options: { ...defaultViewerOptions }, error });
  app = createApp({ render: () => h(CodeView, { doc: state.doc, options: state.options, theme: defaultTheme, error: state.error }) });
  app.mount(host);
  const editor = host.querySelector<HTMLElement>('.cm-editor')!;
  return { state, editor, view: EditorView.findFromDOM(editor)! };
}

afterEach(() => {
  app?.unmount();
  host?.remove();
  document.body.innerHTML = '';
});

describe('CodeView', () => {
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
});
