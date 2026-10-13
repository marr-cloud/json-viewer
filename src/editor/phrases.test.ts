import { EditorState } from '@codemirror/state';
import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '@/i18n';
import { editorPhrases } from './phrases';

afterEach(() => setLocale('en'));

describe('editorPhrases', () => {
  const phrase = (text: string) => EditorState.create({ extensions: editorPhrases() }).phrase(text);

  it("puts CodeMirror's own texts in the page language", () => {
    setLocale('es');
    expect(phrase('Fold line')).toBe('Plegar línea');
    expect(phrase('Unfold line')).toBe('Desplegar línea');
    expect(phrase('Go to line')).toBe('Ir a la línea');
    expect(phrase('folded code')).toBe('código plegado');
  });

  it('keeps them as they are in English', () => {
    expect(phrase('Fold line')).toBe('Fold line');
    expect(phrase('current match')).toBe('current match');
  });
});
