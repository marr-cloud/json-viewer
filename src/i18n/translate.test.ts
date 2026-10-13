import { describe, expect, it } from 'vitest';
import { en } from './messages/en';
import { es } from './messages/es';
import { formatNumber, resolveLocale, translate, translateCount } from './translate';

describe('resolveLocale', () => {
  it('uses the chosen language', () => {
    expect(resolveLocale('es', ['en-US'])).toBe('es');
    expect(resolveLocale('en', ['es-MX'])).toBe('en');
  });

  it('follows the browser on auto: the first supported language wins', () => {
    expect(resolveLocale('auto', ['es-419', 'en'])).toBe('es');
    expect(resolveLocale('auto', ['fr-FR', 'ES', 'en'])).toBe('es');
    expect(resolveLocale('auto', ['en-GB', 'es'])).toBe('en');
  });

  it('falls back to English', () => {
    expect(resolveLocale('auto', ['fr', 'de'])).toBe('en');
    expect(resolveLocale('auto', [])).toBe('en');
  });
});

describe('translate', () => {
  it('looks the key up in the language', () => {
    expect(translate('en', 'options.section.appearance')).toBe('Appearance');
    expect(translate('es', 'options.section.appearance')).toBe('Apariencia');
  });

  it('fills {placeholders}, leaving unknown ones as they are', () => {
    expect(translate('en', 'options.about.version', { version: '1.2.3' })).toBe('JSON Viewer 1.2.3');
    expect(translate('en', 'options.about.version')).toBe('JSON Viewer {version}');
  });
});

describe('translateCount', () => {
  it('picks the plural form and formats the count for the language', () => {
    expect(translateCount('en', 'options.backup.themesSkipped', 1)).toBe('1 theme in the file was left out.');
    expect(translateCount('en', 'options.backup.themesSkipped', 1200)).toBe(
      '1,200 themes in the file were left out.',
    );
    expect(translateCount('es', 'options.backup.themesSkipped', 1)).toBe('Se omitió 1 tema del archivo.');
    expect(translateCount('es', 'options.backup.themesSkipped', 12000)).toBe('Se omitieron 12.000 temas del archivo.');
  });
});

describe('formatNumber', () => {
  it('groups digits the way the language does', () => {
    expect(formatNumber('en', 1234567)).toBe('1,234,567');
    expect(formatNumber('es', 1234567)).toBe('1.234.567');
  });
});

describe('the dictionaries', () => {
  const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

  it('have the same keys', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  it('use the same placeholders in both languages', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(es[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it('give every plural an "other" form', () => {
    for (const key of Object.keys(en)) {
      if (key.endsWith('.one')) expect(Object.keys(en), key).toContain(`${key.slice(0, -4)}.other`);
    }
  });
});
