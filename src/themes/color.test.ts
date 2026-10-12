import { describe, expect, it } from 'vitest';
import { mix, parseHex, toHex, withAlpha } from './color';

describe('parseHex', () => {
  it('parses short and long forms', () => {
    expect(parseHex('#abc')).toEqual({ r: 170, g: 187, b: 204, a: 1 });
    expect(parseHex('#1e1e1e')).toEqual({ r: 30, g: 30, b: 30, a: 1 });
    expect(parseHex('#00000080').a).toBeCloseTo(128 / 255);
    expect(parseHex('#0008').a).toBeCloseTo(136 / 255);
  });

  it('rejects invalid colors', () => {
    expect(() => parseHex('red')).toThrow('Invalid hex color: red');
    expect(() => parseHex('#12345')).toThrow();
  });
});

describe('toHex', () => {
  it('omits alpha when opaque', () => {
    expect(toHex({ r: 30, g: 30, b: 30, a: 1 })).toBe('#1e1e1e');
    expect(toHex({ r: 255, g: 0, b: 0, a: 0.6 })).toBe('#ff000099');
  });
});

describe('withAlpha / mix', () => {
  it('sets alpha', () => {
    expect(withAlpha('#d4d4d4', 0.6)).toBe('#d4d4d499');
    expect(withAlpha('#d4d4d4', 0.06)).toBe('#d4d4d40f');
  });

  it('mixes toward a target color', () => {
    expect(mix('#1e1e1e', '#000000', 0.04)).toBe('#1d1d1d');
    expect(mix('#ffffff', '#000000', 0.1)).toBe('#e6e6e6');
  });
});
