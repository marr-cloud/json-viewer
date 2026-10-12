import { codeFolding, syntaxTree } from '@codemirror/language';
import type { EditorState, Extension } from '@codemirror/state';

export interface FoldSummary {
  type: 'object' | 'array';
  count: number;
}

const ARRAY_PUNCTUATION = new Set(['[', ']', ',']);

/** Summarizes the object/array whose fold range starts at `from` (just after its bracket). */
export function summarizeFold(state: EditorState, from: number): FoldSummary | null {
  const bracket = syntaxTree(state).resolveInner(from - 1, 1);
  const node = bracket.parent;
  if (!node || (node.name !== 'Object' && node.name !== 'Array')) return null;

  let count = 0;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (node.name === 'Object' ? child.name === 'Property' : !ARRAY_PUNCTUATION.has(child.name)) {
      count++;
    }
  }
  return { type: node.name === 'Object' ? 'object' : 'array', count };
}

export function formatFoldSummary({ type, count }: FoldSummary): string {
  const noun = type === 'array' ? 'item' : 'key';
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** Fold placeholders that show how many items/keys are hidden ("… 3 items"). */
export function foldSummaries(): Extension {
  return codeFolding({
    preparePlaceholder: (state, range) => summarizeFold(state, range.from),
    placeholderDOM(_view, onclick, prepared: FoldSummary | null) {
      const el = document.createElement('span');
      el.className = 'cm-foldPlaceholder';
      el.textContent = prepared ? `… ${formatFoldSummary(prepared)}` : '…';
      el.title = 'Unfold';
      el.onclick = onclick;
      return el;
    },
  });
}
