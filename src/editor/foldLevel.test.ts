// @vitest-environment happy-dom
import { json } from '@codemirror/lang-json';
import { foldedRanges, foldGutter } from '@codemirror/language';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cancelPendingFold, foldFromLevel, foldRangesFromLevel } from './foldLevel';

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

  describe('on a document the first parse cannot finish', () => {
    // 20,000 items; a zero budget leaves most of them unparsed.
    const big = '[' + Array.from({ length: 20_000 }, (_, i) => `{"id":${i},"tags":["a"]}`).join(',') + ']';
    // Pretty-printed, so every item and its tags array span several lines.
    const pretty = JSON.stringify(JSON.parse(big), null, 2);
    const mountPretty = () => {
      view = new EditorView({ state: EditorState.create({ doc: pretty, extensions: [json()] }), parent: document.body });
      return view;
    };
    const folds = (v: EditorView) => foldedRanges(v.state).size;

    it('folds the parsed part now and the rest once parsing has finished', async () => {
      const v = mountPretty();
      const fresh = EditorState.create({ doc: pretty, extensions: [json()] });
      const expected = foldRangesFromLevel(fresh, 2, 60_000).length;
      foldFromLevel(v, 2, 0);
      const first = folds(v);
      expect(first).toBeGreaterThan(0);
      expect(first).toBeLessThan(expected);
      await vi.waitFor(() => expect(folds(v)).toBe(expected), { timeout: 20_000 });
    }, 30_000);

    it('is cancelled by a newer call, by cancelPendingFold and by a document change', async () => {
      const v = mountPretty();
      foldFromLevel(v, 2, 0);
      foldFromLevel(v, 0, 0);
      await new Promise((r) => setTimeout(r, 300));
      expect(folds(v)).toBe(0);

      foldFromLevel(v, 2, 0);
      cancelPendingFold(v);
      const partial = folds(v);
      await new Promise((r) => setTimeout(r, 300));
      expect(folds(v)).toBe(partial);

      foldFromLevel(v, 2, 0);
      v.dispatch({ changes: { from: 0, insert: ' ' } });
      const afterChange = folds(v);
      await new Promise((r) => setTimeout(r, 300));
      expect(folds(v)).toBe(afterChange);
    });
  });
});
