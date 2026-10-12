import { describe, expect, it } from 'vitest';
import { canonicalFamily, FONT_CATALOG } from './catalog';

describe('canonicalFamily', () => {
  it('returns the known spelling for a case-insensitive match', () => {
    expect(canonicalFamily('jetbrains mono', FONT_CATALOG)).toBe('JetBrains Mono');
    expect(canonicalFamily('  FIRA CODE ', FONT_CATALOG)).toBe('Fira Code');
  });

  it('prefers the first known entry when several match', () => {
    expect(canonicalFamily('demo mono', ['Demo Mono', 'DEMO MONO'])).toBe('Demo Mono');
  });

  it('returns the trimmed input when nothing matches', () => {
    expect(canonicalFamily('  Nope Font ', FONT_CATALOG)).toBe('Nope Font');
    expect(canonicalFamily('', FONT_CATALOG)).toBe('');
  });
});
