import type { FontSettings } from '@/settings/font';

export const DEFAULT_FONT_STACK = "ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace";

/** The family first, then the default stack; quotes and backslashes are removed so the name stays one CSS string. */
export function fontStack(family: string): string {
  const name = family.replace(/["\\]/g, '').trim();
  return name ? `"${name}", ${DEFAULT_FONT_STACK}` : DEFAULT_FONT_STACK;
}

export function fontCssVars(font: FontSettings): Record<string, string> {
  return {
    '--jv-font-family': fontStack(font.family),
    '--jv-font-size': `${font.sizePx}px`,
    '--jv-line-height': String(font.lineHeight),
    '--jv-font-weight': String(font.weight),
    '--jv-font-ligatures': font.ligatures ? 'normal' : 'none',
  };
}
