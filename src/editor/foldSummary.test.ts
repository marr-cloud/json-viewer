// @vitest-environment happy-dom
import { json } from '@codemirror/lang-json';
import { ensureSyntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { formatFoldSummary, summarizeFold } from './foldSummary';

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
