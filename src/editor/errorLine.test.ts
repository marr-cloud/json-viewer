// @vitest-environment happy-dom
import { Text } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { errorLineDecorations } from './errorLine';

const doc = Text.of(['a', 'b', 'c']);

describe('errorLineDecorations', () => {
  it('marks the start of the requested line', () => {
    const cursor = errorLineDecorations(doc, 2).iter();
    expect(cursor.from).toBe(2);
    expect(cursor.value?.spec.class).toBe('cm-jv-error-line');
  });

  it('clamps lines past the end of the document', () => {
    expect(errorLineDecorations(doc, 99).iter().from).toBe(4);
  });

  it('clamps lines before the start of the document', () => {
    expect(errorLineDecorations(doc, 0).iter().from).toBe(0);
  });
});
