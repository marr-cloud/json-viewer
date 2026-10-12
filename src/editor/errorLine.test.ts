// @vitest-environment happy-dom
import { Text } from '@codemirror/state';
import type { DecorationSet } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import { errorMarkerDecorations } from './errorLine';

const doc = Text.of(['a', 'b', 'c']);

function collect(set: DecorationSet): { from: number; to: number; cls: string }[] {
  const out: { from: number; to: number; cls: string }[] = [];
  for (const cursor = set.iter(); cursor.value; cursor.next()) {
    out.push({ from: cursor.from, to: cursor.to, cls: cursor.value.spec.class });
  }
  return out;
}

describe('errorMarkerDecorations', () => {
  it('marks the start of the requested line when there is no offset', () => {
    expect(collect(errorMarkerDecorations(doc, { line: 2, offset: null }))).toEqual([
      { from: 2, to: 2, cls: 'cm-jv-error-line' },
    ]);
  });

  it('clamps lines past the end of the document', () => {
    expect(errorMarkerDecorations(doc, { line: 99, offset: null }).iter().from).toBe(4);
  });

  it('clamps lines before the start of the document', () => {
    expect(errorMarkerDecorations(doc, { line: 0, offset: null }).iter().from).toBe(0);
  });

  it('marks the character at the offset in addition to its line', () => {
    expect(collect(errorMarkerDecorations(doc, { line: 2, offset: 2 }))).toEqual([
      { from: 2, to: 2, cls: 'cm-jv-error-line' },
      { from: 2, to: 3, cls: 'cm-jv-error-char' },
    ]);
  });

  it('marks the last character when the offset is the document length', () => {
    const marks = collect(errorMarkerDecorations(doc, { line: 3, offset: doc.length }));
    expect(marks.at(-1)).toEqual({ from: 4, to: 5, cls: 'cm-jv-error-char' });
  });

  it('skips the line decoration for very long lines but keeps the character mark', () => {
    const long = Text.of(['x'.repeat(5000)]);
    expect(collect(errorMarkerDecorations(long, { line: 1, offset: 3000 }))).toEqual([
      { from: 3000, to: 3001, cls: 'cm-jv-error-char' },
    ]);
  });

  it('marks nothing without a location', () => {
    expect(collect(errorMarkerDecorations(doc, { line: null, offset: null }))).toEqual([]);
  });
});
