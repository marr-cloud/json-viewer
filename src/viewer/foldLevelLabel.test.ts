import { describe, expect, it } from 'vitest';
import { setLocale } from '@/i18n';
import { foldLevelLabel } from './foldLevelLabel';

describe('foldLevelLabel', () => {
  it('counts the levels left open, in the page language', () => {
    expect(foldLevelLabel(2)).toBe('Show 1 level');
    expect(foldLevelLabel(4)).toBe('Show 3 levels');
    setLocale('es');
    try {
      expect(foldLevelLabel(2)).toBe('Mostrar 1 nivel');
      expect(foldLevelLabel(4)).toBe('Mostrar 3 niveles');
    } finally {
      setLocale('en');
    }
  });
});
