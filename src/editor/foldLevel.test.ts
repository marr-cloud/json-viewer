// @vitest-environment happy-dom
import { json } from '@codemirror/lang-json';
import { foldedRanges, foldGutter } from '@codemirror/language';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { foldFromLevel, foldRangesFromLevel } from './foldLevel';

// Levels: root 1; "a" 2; "b" 3; the object inside "b" 4; "g" 2. "e" is empty, "s" fits on one line.
const DOC = [
  '{',
  '  "a": {',
  '    "b": [',
  '      1,',
  '      {',
  '        "c": true',
  '      }',
  '    ]',
  '  },',
  '  "e": [],',
  '  "s": {"t": 1},',
  '  "g": {',
  '    "h": "x"',
  '  }',
  '}',
].join('\n');

/** The trimmed text of the line where each range starts. */
function lines(state: EditorState, ranges: { from: number }[]): string[] {
  return ranges.map((range) => state.doc.lineAt(range.from).text.trim());
}

/** `iter()` yields folds in document order; `between()` does not guarantee that for nested folds. */
function folded(state: EditorState): string[] {
  const starts: { from: number }[] = [];
  const cursor = foldedRanges(state).iter();
  while (cursor.value) {
    starts.push({ from: cursor.from });
    cursor.next();
  }
  return lines(state, starts);
}

describe('foldRangesFromLevel', () => {
  const state = EditorState.create({ doc: DOC, extensions: [json()] });

  it('returns the multi-line containers at the level or deeper', () => {
    expect(lines(state, foldRangesFromLevel(state, 1))).toEqual(['{', '"a": {', '"b": [', '{', '"g": {']);
    expect(lines(state, foldRangesFromLevel(state, 2))).toEqual(['"a": {', '"b": [', '{', '"g": {']);
    expect(lines(state, foldRangesFromLevel(state, 3))).toEqual(['"b": [', '{']);
    expect(lines(state, foldRangesFromLevel(state, 4))).toEqual(['{']);
    expect(foldRangesFromLevel(state, 5)).toEqual([]);
  });

  it('folds nothing at level 0', () => {
    expect(foldRangesFromLevel(state, 0)).toEqual([]);
  });

  it('folds the inside of the brackets', () => {
    const [range] = foldRangesFromLevel(state, 4);
    expect(state.sliceDoc(range!.from - 1, range!.from)).toBe('{');
    expect(state.sliceDoc(range!.to, range!.to + 1)).toBe('}');
  });
});

describe('foldFromLevel', () => {
  let view: EditorView | undefined;
  const mount = (extensions: Extension[]) => {
    view = new EditorView({ state: EditorState.create({ doc: DOC, extensions }), parent: document.body });
    return view;
  };
  afterEach(() => {
    view?.destroy();
    view = undefined;
  });

  it('replaces the current folds', () => {
    const v = mount([json(), foldGutter()]);
    foldFromLevel(v, 2);
    expect(folded(v.state)).toEqual(['"a": {', '"b": [', '{', '"g": {']);
    foldFromLevel(v, 4);
    expect(folded(v.state)).toEqual(['{']);
    foldFromLevel(v, 0);
    expect(folded(v.state)).toEqual([]);
  });

  it('works without a fold gutter', () => {
    const v = mount([json()]);
    foldFromLevel(v, 3);
    expect(folded(v.state)).toEqual(['"b": [', '{']);
    expect(v.dom.querySelectorAll('.cm-foldPlaceholder').length).toBeGreaterThan(0);
  });

  it('does not dispatch when there is nothing to change', () => {
    const v = mount([json()]);
    const before = v.state;
    foldFromLevel(v, 0);
    expect(v.state).toBe(before);
  });
});
