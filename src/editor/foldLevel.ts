import {
  codeFolding,
  ensureSyntaxTree,
  foldedRanges,
  foldEffect,
  foldInside,
  foldState,
  syntaxTree,
  unfoldEffect,
} from '@codemirror/language';
import { StateEffect, type EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

/** Stop waiting for a full parse after this long and fold what has been parsed. */
const PARSE_TIMEOUT_MS = 1000;

export interface FoldRange {
  from: number;
  to: number;
}

const isContainer = (name: string) => name === 'Object' || name === 'Array';

/**
 * The inside of every multi-line object or array nested `level` or more levels deep.
 * The top-level value is level 1, its children level 2, and so on; level 0 folds nothing.
 */
export function foldRangesFromLevel(state: EditorState, level: number): FoldRange[] {
  if (level < 1) return [];
  const tree = ensureSyntaxTree(state, state.doc.length, PARSE_TIMEOUT_MS) ?? syntaxTree(state);
  const ranges: FoldRange[] = [];
  let depth = 0;
  tree.iterate({
    enter(node) {
      if (!isContainer(node.name)) return;
      depth++;
      if (depth < level) return;
      const range = foldInside(node.node);
      if (range && state.doc.lineAt(range.from).number < state.doc.lineAt(range.to).number) ranges.push(range);
    },
    leave(node) {
      if (isContainer(node.name)) depth--;
    },
  });
  return ranges;
}

/** Replaces the current folds with the containers at `level` and deeper; 0 unfolds everything. */
export function foldFromLevel(view: EditorView, level: number): void {
  const { state } = view;
  const effects: StateEffect<unknown>[] = [];
  foldedRanges(state).between(0, state.doc.length, (from, to) => {
    effects.push(unfoldEffect.of({ from, to }));
  });
  for (const range of foldRangesFromLevel(state, level)) effects.push(foldEffect.of(range));
  if (effects.length === 0) return;
  // Without a fold gutter or fold summaries the folding state isn't installed yet.
  if (!state.field(foldState, false)) effects.push(StateEffect.appendConfig.of(codeFolding()));
  view.dispatch({ effects });
}
