import { syntaxTree } from '@codemirror/language';
import type { EditorState, Extension } from '@codemirror/state';
import { ViewPlugin, type ViewUpdate } from '@codemirror/view';

// @lezer/common isn't a direct dependency, so derive its SyntaxNode type from CodeMirror's API.
type Node = ReturnType<ReturnType<typeof syntaxTree>['resolveInner']>;

export type PathKey = string | number;

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PUNCTUATION = new Set(['{', '}', '[', ']', ',', ':']);

/** `$` followed by `.name`, `["a-b"]` and `[3]` segments, e.g. `$.items[3]["e-mail"]`. */
export function formatPath(keys: readonly PathKey[]): string {
  return (
    '$' +
    keys
      .map((key) => {
        if (typeof key === 'number') return `[${key}]`;
        return IDENTIFIER.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
      })
      .join('')
  );
}

/** JSON path of the value at `pos`, e.g. `$.items[3].email`; `$` outside every property and item. */
export function jsonPathAt(state: EditorState, pos: number): string {
  const probe = probePosition(state, pos);
  const tree = syntaxTree(state);
  const before = keysAt(state, tree.resolveInner(probe, -1));
  const after = keysAt(state, tree.resolveInner(probe, 1));
  return formatPath(after.length > before.length ? after : before);
}

/**
 * Moves a cursor sitting in a line's indentation, or after its last value and trailing comma,
 * onto that value, so clicking anywhere on `  "a": 1,` gives `$.a`.
 */
function probePosition(state: EditorState, pos: number): number {
  const line = state.doc.lineAt(pos);
  const start = line.text.length - line.text.trimStart().length;
  const end = line.text.replace(/,?\s*$/, '').length;
  if (end <= start) return pos;
  return line.from + Math.min(Math.max(pos - line.from, start), end);
}

function keysAt(state: EditorState, node: Node): PathKey[] {
  const keys: PathKey[] = [];
  for (let current: Node | null = node; current?.parent; current = current.parent) {
    if (current.name === 'Property') {
      const key = propertyKey(state, current);
      if (key !== null) keys.push(key);
    } else if (current.parent.name === 'Array' && isValue(current)) {
      keys.push(arrayIndex(current));
    }
  }
  return keys.reverse();
}

function isValue(node: Node): boolean {
  return !PUNCTUATION.has(node.name) && !node.type.isError;
}

function arrayIndex(item: Node): number {
  let index = 0;
  for (let sibling = item.prevSibling; sibling; sibling = sibling.prevSibling) {
    if (isValue(sibling)) index++;
  }
  return index;
}

function propertyKey(state: EditorState, property: Node): string | null {
  const name = property.getChild('PropertyName');
  if (!name) return null;
  const text = state.sliceDoc(name.from, name.to);
  try {
    const key: unknown = JSON.parse(text);
    return typeof key === 'string' ? key : null;
  } catch {
    // A broken escape in an invalid document: show the name as written.
    return text.replace(/^"|"$/g, '');
  }
}

/** Calls `onChange` with the cursor's path when the editor is created and whenever the path changes. */
export function cursorPath(onChange: (path: string) => void): Extension {
  return ViewPlugin.define((view) => {
    let last = jsonPathAt(view.state, view.state.selection.main.head);
    onChange(last);
    return {
      update(update: ViewUpdate) {
        // Big documents keep parsing in the background, which also changes the tree.
        const treeChanged = syntaxTree(update.startState) !== syntaxTree(update.state);
        if (!update.selectionSet && !update.docChanged && !treeChanged) return;
        const path = jsonPathAt(update.state, update.state.selection.main.head);
        if (path === last) return;
        last = path;
        onChange(path);
      },
    };
  });
}
