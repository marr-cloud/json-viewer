import { describe, expect, it } from 'vitest';
import { resolveScopeColor, scoreSelector } from './scopes';

const key = ['source.json', 'meta.structure.dictionary.json', 'string.json', 'support.type.property-name.json'];

describe('scoreSelector', () => {
  it('matches by dotted prefix only', () => {
    expect(scoreSelector('support.type.property-name', key)).toEqual([3, 3, 1]);
    expect(scoreSelector('support.type.prop', key)).toBeNull();
  });

  it('prefers deeper matches over shallower ones', () => {
    expect(scoreSelector('string', key)).toEqual([2, 1, 1]);
  });

  it('requires ancestor parts in order', () => {
    expect(scoreSelector('source.json support.type.property-name', key)).toEqual([3, 3, 2]);
    expect(scoreSelector('support.type.property-name source.json', key)).toBeNull();
  });

  it('ignores selectors with exclusions', () => {
    expect(scoreSelector('source.json - string', key)).toBeNull();
  });
});

describe('resolveScopeColor', () => {
  it('picks the most specific rule', () => {
    const rules = [
      { scope: 'string', settings: { foreground: '#111111' } },
      { scope: 'support.type.property-name', settings: { foreground: '#222222' } },
      { scope: 'source.json meta.structure.dictionary.json support.type.property-name.json', settings: { foreground: '#333333' } },
    ];
    expect(resolveScopeColor(rules, key)).toBe('#333333');
  });

  it('lets later rules win ties', () => {
    const rules = [
      { scope: 'support', settings: { foreground: '#111111' } },
      { scope: ['support'], settings: { foreground: '#222222' } },
    ];
    expect(resolveScopeColor(rules, key)).toBe('#222222');
  });

  it('splits comma-separated scopes and skips rules without a foreground', () => {
    const rules = [
      { scope: 'constant.numeric, constant.language', settings: { foreground: '#444444' } },
      { scope: 'constant.language', settings: { fontStyle: 'italic' } },
    ];
    expect(resolveScopeColor(rules, ['source.json', 'constant.language.json'])).toBe('#444444');
  });

  it('returns null when nothing matches', () => {
    expect(resolveScopeColor([{ scope: 'comment', settings: { foreground: '#555555' } }], key)).toBeNull();
  });
});
