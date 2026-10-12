import type { Extension, Text } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';

const errorLineMark = Decoration.line({ class: 'cm-jv-error-line' });

export function errorLineDecorations(doc: Text, line: number): DecorationSet {
  const clamped = Math.min(Math.max(line, 1), doc.lines);
  return Decoration.set([errorLineMark.range(doc.line(clamped).from)]);
}

export function errorLine(line: number): Extension {
  return EditorView.decorations.of((view) => errorLineDecorations(view.state.doc, line));
}
