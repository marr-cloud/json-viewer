import { json } from '@codemirror/lang-json';
import { ensureSyntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { valueTokenAt } from './jsonToken';

const DOC = '{\n  "k\\u00e9y": "v\\"al",\n  "n": -1.5e3,\n  "t": true\n}';
const state = (() => {
  const s = EditorState.create({ doc: DOC, extensions: [json()] });
  ensureSyntaxTree(s, DOC.length, 5000);
  return s.update({}).state;
})();
const at = (needle: string) => valueTokenAt(state, DOC.indexOf(needle) + 1, 1);

describe('valueTokenAt', () => {
  it('decodes string values', () => {
    expect(at('"v\\"al"')).toEqual({ kind: 'string', from: DOC.indexOf('"v'), to: DOC.indexOf('"v') + 7, value: 'v"al' });
  });

  it('returns numbers as written', () => {
    expect(at('-1.5e3')).toMatchObject({ kind: 'number', value: '-1.5e3' });
  });

  it('ignores keys, literals and punctuation', () => {
    expect(at('"k\\u00e9y"')).toBeNull();
    expect(at('true')).toBeNull();
    expect(valueTokenAt(state, 0, 1)).toBeNull();
  });
});
