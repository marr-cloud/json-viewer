import {
  codeFolding,
  ensureSyntaxTree,
  foldedRanges,
  foldEffect,
  foldInside,
  foldState,
  forceParsing,
  syntaxTree,
  syntaxTreeAvailable,
  unfoldEffect,
} from '@codemirror/language';
import { StateEffect, type EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

/** Stop waiting for a full parse after this long and fold what has been parsed. */
const PARSE_TIMEOUT_MS = 1000;

/**
 * Parse time before the first folds. CodeMirror keeps a timed-out parse to itself until it finishes,
 * so a longer wait only helps when the whole document parses within it; bigger documents fold the
 * parsed part at once and the rest from the background continuation below.
 */
const INITIAL_PARSE_MS = 100;

export interface FoldRange {
  from: number;
  to: number;
}

const isContainer = (name: string) => name === 'Object' || name === 'Array';

/**
 * The inside of every multi-line object or array nested `level` or more levels deep.
 * The top-level value is level 1, its children level 2, and so on; level 0 folds nothing.
 */
export function foldRangesFromLevel(state: EditorState, level: number, budgetMs = PARSE_TIMEOUT_MS): FoldRange[] {
  if (level < 1) return [];
  const tree = ensureSyntaxTree(state, state.doc.length, budgetMs) ?? syntaxTree(state);
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

/** Time given to each slice of the background parse that finishes a large document. */
const CONTINUE_SLICE_MS = 50;

interface Pending {
  timer: ReturnType<typeof setTimeout>;
}
const pending = new WeakMap<EditorView, Pending>();

/** Stops the background fold of a large document started by `foldFromLevel`, if any. */
export function cancelPendingFold(view: EditorView): void {
  const current = pending.get(view);
  if (!current) return;
  clearTimeout(current.timer);
  pending.delete(view);
}

function dispatchFolds(view: EditorView, effects: StateEffect<unknown>[]): void {
  if (effects.length === 0) return;
  // Without a fold gutter or fold summaries the folding state isn't installed yet.
  if (!view.state.field(foldState, false)) effects.push(StateEffect.appendConfig.of(codeFolding()));
  view.dispatch({ effects });
}

/**
 * Replaces the current folds with the containers at `level` and deeper; 0 unfolds everything.
 * When the parser can't cover a large document within `budgetMs`, the parsed part is folded now
 * and the rest once a background parse (in short slices) has reached the end. The newest call
 * wins, and a document change or `cancelPendingFold` abandons the rest.
 */
export function foldFromLevel(view: EditorView, level: number, budgetMs = INITIAL_PARSE_MS): void {
  cancelPendingFold(view);
  const { state } = view;
  const effects: StateEffect<unknown>[] = [];
  foldedRanges(state).between(0, state.doc.length, (from, to) => {
    effects.push(unfoldEffect.of({ from, to }));
  });
  const ranges = foldRangesFromLevel(state, level, budgetMs);
  const complete = syntaxTreeAvailable(state, state.doc.length);
  // A node cut off by the end of the parsed part ends exactly there (an error node), so it waits
  // for the full tree. A complete tree covers everything.
  const covered = complete ? state.doc.length + 1 : syntaxTree(state).length;
  for (const range of ranges) if (range.to < covered) effects.push(foldEffect.of(range));
  dispatchFolds(view, effects);
  if (!complete && level >= 1) continueFolding(view, level, covered, budgetMs);
}

function continueFolding(view: EditorView, level: number, covered: number, budgetMs: number): void {
  const doc = view.state.doc;
  const step = (): void => {
    pending.delete(view);
    // The document changed: these folds no longer belong to it.
    if (view.state.doc !== doc) return;
    if (forceParsing(view, doc.length, CONTINUE_SLICE_MS)) {
      const rest = foldRangesFromLevel(view.state, level, budgetMs).filter((range) => range.to >= covered);
      dispatchFolds(view, rest.map((range) => foldEffect.of(range)));
      return;
    }
    pending.set(view, { timer: setTimeout(step, 0) });
  };
  pending.set(view, { timer: setTimeout(step, 0) });
}
