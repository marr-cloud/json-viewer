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

/** The string or number value at `pos`, or null (keys, punctuation, unparsed text). */
export function valueTokenAt(state: EditorState, pos: number, side: -1 | 1): ValueToken | null {
  const node = syntaxTree(state).resolveInner(pos, side);
  const text = state.sliceDoc(node.from, node.to);
  if (node.name === 'Number') return { kind: 'number', from: node.from, to: node.to, value: text };
  if (node.name !== 'String') return null;
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'string' ? { kind: 'string', from: node.from, to: node.to, value } : null;
  } catch {
    return null;
  }
}
