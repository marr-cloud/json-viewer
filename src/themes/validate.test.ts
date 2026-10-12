import { describe, expect, it } from 'vitest';
import { defaultTheme } from './builtin';
import { parseCompactTheme } from './validate';

const minimal = { id: 'mine', name: 'Mine', type: 'dark', source: 'custom', colors: { background: '#111', foreground: '#EEEEEE' } };

describe('parseCompactTheme', () => {
  it('accepts a full built-in theme unchanged', () => {
    expect(parseCompactTheme(defaultTheme)).toEqual({ ok: true, theme: defaultTheme });
  });

  it('normalizes colors and trims the name', () => {
    expect(parseCompactTheme({ ...minimal, name: '  Mine  ' })).toEqual({
      ok: true,
      theme: { ...minimal, name: 'Mine', colors: { background: '#111111', foreground: '#eeeeee' } },
    });
  });

  it('defaults a missing source to custom', () => {
    const { source: _source, ...rest } = minimal;
    const result = parseCompactTheme(rest);
    expect(result.ok && result.theme.source).toBe('custom');
  });

  it('collects every problem', () => {
    const result = parseCompactTheme({
      id: 'Bad Id',
      name: '',
      type: 'sepia',
      colors: { background: 'red', key: '#12', glow: '#fff' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      '"id" must use lowercase letters, digits and dashes (max 64 characters)',
      '"name" must be a non-empty string',
      '"type" must be "dark" or "light"',
      '"colors.background" must be a hex color like #1e1e1e',
      '"colors.key" must be a hex color like #1e1e1e',
      'Unknown color "glow"',
      '"colors.background" is required',
      '"colors.foreground" is required',
    ]);
  });

  it('rejects non-objects', () => {
    expect(parseCompactTheme('theme')).toEqual({ ok: false, errors: ['A theme must be a JSON object'] });
    expect(parseCompactTheme({ ...minimal, colors: [] })).toEqual({
      ok: false,
      errors: ['"colors" must be an object', '"colors.background" is required', '"colors.foreground" is required'],
    });
  });
});
