import { describe, expect, it } from 'vitest';
import { DEFAULT_FONT_STACK, fontCssVars, fontStack } from './css';
import { defaultFontSettings } from '@/settings/font';

describe('font CSS variables', () => {
  it('maps the font settings to the viewer variables', () => {
    expect(
      fontCssVars({ ...defaultFontSettings, family: 'JetBrains Mono', sizePx: 15, lineHeight: 1.6, weight: 500, ligatures: false }),
    ).toEqual({
      '--jv-font-family': `"JetBrains Mono", ${DEFAULT_FONT_STACK}`,
      '--jv-font-size': '15px',
      '--jv-line-height': '1.6',
      '--jv-font-weight': '500',
      '--jv-font-ligatures': 'none',
    });
  });

  it('uses the default stack without a family', () => {
    expect(fontCssVars(defaultFontSettings)['--jv-font-family']).toBe(DEFAULT_FONT_STACK);
    expect(fontCssVars(defaultFontSettings)['--jv-font-ligatures']).toBe('normal');
  });

  it('strips quotes and backslashes defensively', () => {
    expect(fontStack('a"b\\c')).toBe(`"abc", ${DEFAULT_FONT_STACK}`);
    expect(fontStack('  ')).toBe(DEFAULT_FONT_STACK);
  });
});
