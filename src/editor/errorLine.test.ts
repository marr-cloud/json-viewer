// @vitest-environment happy-dom
import { Text } from '@codemirror/state';
import type { DecorationSet } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import { errorMarkerDecorations, errorPosition } from './errorLine';

const doc = Text.of(['a', 'b', 'c']);

function collect(set: DecorationSet): { from: number; to: number; cls: string }[] {
  const out: { from: number; to: number; cls: string }[] = [];
  for (const cursor = set.iter(); cursor.value; cursor.next()) {
    out.push({ from: cursor.from, to: cursor.to, cls: cursor.value.spec.class });
  }
  return out;
}

describe('errorPosition', () => {
  it('maps line and column to a document position', () => {
    expect(errorPosition(Text.of(['{', '  "a": 1,', '}']), { line: 3, column: 1 })).toBe(12);
  });

  it('uses the line start when the column is unknown', () => {
    expect(errorPosition(doc, { line: 2, column: null })).toBe(2);
  });

  it('clamps the line and the column', () => {
    expect(errorPosition(doc, { line: 99, column: 1 })).toBe(4);
    expect(errorPosition(doc, { line: 1, column: 50 })).toBe(1);
  });

  it('returns null without a line', () => {
    expect(errorPosition(doc, { line: null, column: 3 })).toBeNull();
  });
});

describe('errorMarkerDecorations', () => {
  it('marks only the line when the column is unknown', () => {
    expect(collect(errorMarkerDecorations(doc, { line: 2, column: null }))).toEqual([
      { from: 2, to: 2, cls: 'cm-jv-error-line' },
    ]);
  });

  it('marks the line and the character at the column', () => {
    expect(collect(errorMarkerDecorations(doc, { line: 2, column: 1 }))).toEqual([
      { from: 2, to: 2, cls: 'cm-jv-error-line' },
      { from: 2, to: 3, cls: 'cm-jv-error-char' },
    ]);
  });

  it('marks the last character when the error is at the end of the document', () => {
    const marks = collect(errorMarkerDecorations(doc, { line: 3, column: 2 }));
    expect(marks.at(-1)).toEqual({ from: 4, to: 5, cls: 'cm-jv-error-char' });
  });

  it('skips the line decoration for very long lines but keeps the character mark', () => {
    const long = Text.of(['x'.repeat(5000)]);
    expect(collect(errorMarkerDecorations(long, { line: 1, column: 3001 }))).toEqual([
      { from: 3000, to: 3001, cls: 'cm-jv-error-char' },
    ]);
  });

  it('marks nothing without a location', () => {
    expect(collect(errorMarkerDecorations(doc, { line: null, column: null }))).toEqual([]);
  });
});
