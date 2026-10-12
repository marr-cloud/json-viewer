// @vitest-environment happy-dom
import { json } from '@codemirror/lang-json';
import { ensureSyntaxTree, foldAll, foldEffect } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { foldSummaries, formatFoldSummary, summarizeFold } from './foldSummary';

// Offsets: "{" 0, "[" 9, inner "{" 16, outer "c" value "{" 37
const doc = '{\n  "a": [1, 2, {"b": null}],\n  "c": {}\n}';
const state = EditorState.create({ doc, extensions: [json()] });
ensureSyntaxTree(state, state.doc.length);

describe('summarizeFold', () => {
  it('counts array items', () => {
    expect(summarizeFold(state, 10)).toEqual({ type: 'array', count: 3 });
  });

  it('counts object keys', () => {
    expect(summarizeFold(state, 1)).toEqual({ type: 'object', count: 2 });
    expect(summarizeFold(state, 17)).toEqual({ type: 'object', count: 1 });
  });

  it('returns null when the position does not follow a bracket', () => {
    expect(summarizeFold(state, 5)).toBeNull();
  });
});

describe('formatFoldSummary', () => {
  it('pluralizes', () => {
    expect(formatFoldSummary({ type: 'array', count: 1 })).toBe('1 item');
    expect(formatFoldSummary({ type: 'array', count: 3 })).toBe('3 items');
    expect(formatFoldSummary({ type: 'object', count: 1 })).toBe('1 key');
    expect(formatFoldSummary({ type: 'object', count: 2 })).toBe('2 keys');
  });
});

describe('foldSummaries in a mounted view', () => {
  let view: EditorView | undefined;
  const mount = () => {
    view = new EditorView({
      state: EditorState.create({
        doc: '{\n  "a": [1, 2, 3]\n}',
        extensions: [json(), foldSummaries()],
      }),
      parent: document.body,
    });
    ensureSyntaxTree(view.state, view.state.doc.length);
    return view;
  };
  afterEach(() => {
    view?.destroy();
    view = undefined;
  });

  it('shows the key count when the object is folded', () => {
    const v = mount();
    v.dispatch({ effects: foldEffect.of({ from: 1, to: v.state.doc.length - 1 }) });
    expect(v.dom.querySelector('.cm-foldPlaceholder')?.textContent).toBe('… 1 key');
  });

  it('shows the item count when the array is folded', () => {
    const v = mount();
    const text = v.state.doc.toString();
    v.dispatch({ effects: foldEffect.of({ from: text.indexOf('[') + 1, to: text.indexOf(']') }) });
    expect(v.dom.querySelector('.cm-foldPlaceholder')?.textContent).toBe('… 3 items');
  });

  it('folds everything via foldAll', () => {
    const v = mount();
    expect(foldAll(v)).toBe(true);
    expect(v.dom.querySelector('.cm-foldPlaceholder')).not.toBeNull();
  });
});
