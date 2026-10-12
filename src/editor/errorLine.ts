import type { Extension, Range, Text } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';

export interface ErrorLocation {
  line: number | null;
  offset: number | null;
}

// Highlighting a whole minified line would paint the entire document.
const MAX_MARKED_LINE_LENGTH = 1000;

const errorLineMark = Decoration.line({ class: 'cm-jv-error-line' });
const errorCharMark = Decoration.mark({ class: 'cm-jv-error-char' });

export function errorMarkerDecorations(doc: Text, error: ErrorLocation): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  let at: number | null = null;
  if (error.offset !== null && doc.length > 0) at = Math.min(Math.max(error.offset, 0), doc.length - 1);

  const lineNumber = error.line !== null ? Math.min(Math.max(error.line, 1), doc.lines) : null;
  const line = lineNumber !== null ? doc.line(lineNumber) : at !== null ? doc.lineAt(at) : null;
  if (line && line.length <= MAX_MARKED_LINE_LENGTH) ranges.push(errorLineMark.range(line.from));
  if (at !== null) ranges.push(errorCharMark.range(at, at + 1));
  return Decoration.set(ranges, true);
}

export function errorMarker(error: ErrorLocation): Extension {
  return EditorView.decorations.of((view) => errorMarkerDecorations(view.state.doc, error));
}
