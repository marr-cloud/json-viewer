import type { Extension, Range, Text } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';

/** 1-based line/column of a parse error. CodeMirror normalizes line breaks, so raw offsets would drift. */
export interface ErrorLocation {
  line: number | null;
  column: number | null;
}

// Highlighting a whole minified line would paint the entire document.
const MAX_MARKED_LINE_LENGTH = 1000;

const errorLineMark = Decoration.line({ class: 'cm-jv-error-line' });
const errorCharMark = Decoration.mark({ class: 'cm-jv-error-char' });

export function errorPosition(doc: Text, error: ErrorLocation): number | null {
  if (error.line === null) return null;
  const line = doc.line(Math.min(Math.max(error.line, 1), doc.lines));
  if (error.column === null) return line.from;
  return line.from + Math.min(Math.max(error.column - 1, 0), line.length);
}

export function errorMarkerDecorations(doc: Text, error: ErrorLocation): DecorationSet {
  if (error.line === null) return Decoration.none;
  const ranges: Range<Decoration>[] = [];
  const line = doc.line(Math.min(Math.max(error.line, 1), doc.lines));
  if (line.length <= MAX_MARKED_LINE_LENGTH) ranges.push(errorLineMark.range(line.from));
  const position = errorPosition(doc, error);
  if (error.column !== null && position !== null && doc.length > 0) {
    const at = Math.min(position, doc.length - 1);
    ranges.push(errorCharMark.range(at, at + 1));
  }
  return Decoration.set(ranges, true);
}

export function errorMarker(error: ErrorLocation): Extension {
  return EditorView.decorations.of((view) => errorMarkerDecorations(view.state.doc, error));
}
