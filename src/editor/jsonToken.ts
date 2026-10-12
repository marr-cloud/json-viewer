import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';

/** A string or number value in the document (keys are PropertyName nodes, so they never match). */
export interface ValueToken {
  kind: 'string' | 'number';
  from: number;
  to: number;
  /** The decoded value: the string's text, or the number as written. */
  value: string;
}

/** Longer strings are never dates or image URLs worth previewing; skip decoding them on every hover. */
export const MAX_VALUE_LENGTH = 4096;

/**
 * The string or number value at `pos`, or null (keys, punctuation, unparsed text, strings longer than
 * MAX_VALUE_LENGTH including their quotes).
 */
export function valueTokenAt(state: EditorState, pos: number, side: -1 | 1): ValueToken | null {
  const node = syntaxTree(state).resolveInner(pos, side);
  if (node.name === 'Number') {
    return { kind: 'number', from: node.from, to: node.to, value: state.sliceDoc(node.from, node.to) };
  }
  if (node.name !== 'String' || node.to - node.from > MAX_VALUE_LENGTH) return null;
  const text = state.sliceDoc(node.from, node.to);
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'string' ? { kind: 'string', from: node.from, to: node.to, value } : null;
  } catch {
    return null;
  }
}
