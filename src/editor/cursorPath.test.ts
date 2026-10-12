// @vitest-environment happy-dom
import { json } from '@codemirror/lang-json';
import { ensureSyntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { cursorPath, formatPath, jsonPathAt } from './cursorPath';

const DOC = JSON.stringify({ name: 'x', 'a-b': { list: [1, { deep: true }, [null]] }, 'k"q': [], e: {} }, null, 2);

function stateOf(doc: string): EditorState {
  const state = EditorState.create({ doc, extensions: [json()] });
  ensureSyntaxTree(state, doc.length, 5000);
  return state;
}

/** Path with the cursor `offset` characters into the first occurrence of `needle`. */
function pathAt(needle: string, offset = 0, doc = DOC): string {
  const index = doc.indexOf(needle);
  if (index === -1) throw new Error(`not found: ${needle}`);
  return jsonPathAt(stateOf(doc), index + offset);
}

describe('formatPath', () => {
  it('starts at $ and uses dots for identifiers and brackets for indexes', () => {
    expect(formatPath([])).toBe('$');
    expect(formatPath(['items', 3, 'email'])).toBe('$.items[3].email');
    expect(formatPath(['_ok1'])).toBe('$._ok1');
  });

  it('quotes keys that are not identifiers', () => {
    expect(formatPath(['a-b', '', 'k"q', 'ñ', '1a', '$ref', 'a.b', 'a b'])).toBe(
      '$["a-b"][""]["k\\"q"]["ñ"]["1a"]["$ref"]["a.b"]["a b"]',
    );
  });
});

describe('jsonPathAt', () => {
  it('names the property whose key or value holds the cursor', () => {
    expect(pathAt('"name"', 0)).toBe('$.name');
    expect(pathAt('"name"', 3)).toBe('$.name');
    expect(pathAt('"x"', 3)).toBe('$.name');
    expect(pathAt('"list"', 1)).toBe('$["a-b"].list');
    expect(pathAt('"k\\"q"', 1)).toBe('$["k\\"q"]');
    expect(pathAt('"e"', 1)).toBe('$.e');
  });

  it('treats indentation and the end of a line as part of that line', () => {
    expect(pathAt('"name"', -2)).toBe('$.name');
    expect(pathAt('"x",', 4)).toBe('$.name');
    const closing = DOC.indexOf('}', DOC.indexOf('"deep"'));
    expect(jsonPathAt(stateOf(DOC), closing + 2)).toBe('$["a-b"].list[1]');
  });

  it('indexes array items', () => {
    expect(pathAt('1,', 0)).toBe('$["a-b"].list[0]');
    expect(pathAt('1,', 2)).toBe('$["a-b"].list[0]');
    expect(pathAt('"deep"', 2)).toBe('$["a-b"].list[1].deep');
    expect(pathAt('null', 2)).toBe('$["a-b"].list[2][0]');
  });

  it('returns $ at the top-level brackets', () => {
    expect(jsonPathAt(stateOf(DOC), 0)).toBe('$');
    expect(jsonPathAt(stateOf(DOC), DOC.length)).toBe('$');
  });

  it('indexes the last item of a 10,000-item array', () => {
    const doc = JSON.stringify(
      Array.from({ length: 10_000 }, (_, i) => i),
      null,
      2,
    );
    expect(pathAt('9999', 1, doc)).toBe('$[9999]');
  });

  it('does not throw on invalid documents', () => {
    const doc = '{\n  "a": [1,\n  "b": }';
    for (let pos = 0; pos <= doc.length; pos++) {
      expect(jsonPathAt(stateOf(doc), pos)).toMatch(/^\$/);
    }
  });
});

describe('cursorPath', () => {
  let view: EditorView | undefined;
  afterEach(() => {
    view?.destroy();
    view = undefined;
  });

  it('reports the path on creation and whenever it changes', () => {
    const paths: string[] = [];
    view = new EditorView({
      state: EditorState.create({ doc: DOC, extensions: [json(), cursorPath((path) => paths.push(path))] }),
      parent: document.body,
    });
    expect(paths).toEqual(['$']);

    const deep = DOC.indexOf('"deep"') + 2;
    view.dispatch({ selection: { anchor: deep } });
    expect(paths.at(-1)).toBe('$["a-b"].list[1].deep');

    view.dispatch({ selection: { anchor: deep + 1 } });
    expect(paths).toHaveLength(2);

    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '[\n  1\n]' }, selection: { anchor: 4 } });
    expect(paths.at(-1)).toBe('$[0]');
  });
});
