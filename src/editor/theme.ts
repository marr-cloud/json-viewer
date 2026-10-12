import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { cssVarName } from '@/themes/css';
import type { Theme, ThemeColorKey } from '@/themes/types';

// Colors are CSS variables set on the viewer root (see toCssVars), so switching
// themes only swaps variables; the CodeMirror theme itself depends only on dark/light.
const v = (key: ThemeColorKey) => `var(${cssVarName(key)})`;

const highlight = HighlightStyle.define([
  { tag: t.propertyName, color: v('key') },
  { tag: t.string, color: v('string') },
  { tag: t.number, color: v('number') },
  { tag: t.bool, color: v('boolean') },
  { tag: t.null, color: v('null') },
  { tag: [t.separator, t.brace, t.squareBracket], color: v('punctuation') },
]);

function editorTheme(dark: boolean): Extension {
  return EditorView.theme(
    {
      '&': { color: v('foreground'), backgroundColor: v('background'), height: '100%' },
      '.cm-scroller': {
        fontFamily: 'var(--jv-font-family)',
        fontSize: 'var(--jv-font-size)',
        lineHeight: 'var(--jv-line-height)',
        fontWeight: 'var(--jv-font-weight)',
        fontVariantLigatures: 'var(--jv-font-ligatures)',
      },
      '.cm-content': { caretColor: v('cursor') },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: v('cursor') },
      '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
        { backgroundColor: v('selection') },
      '.cm-activeLine': { backgroundColor: v('activeLine') },
      '.cm-gutters': {
        backgroundColor: v('gutterBackground'),
        color: v('gutterForeground'),
        border: 'none',
      },
      '.cm-activeLineGutter': { backgroundColor: v('activeLine') },
      '.cm-foldPlaceholder': {
        backgroundColor: 'transparent',
        border: 'none',
        color: v('foldPlaceholder'),
        cursor: 'pointer',
      },
      '.cm-url, .cm-url span': { color: v('link'), textDecoration: 'underline', cursor: 'pointer' },
      '.cm-jv-error-line': { backgroundColor: 'rgba(255, 64, 64, 0.18)' },
      '.cm-jv-error-char': {
        backgroundColor: 'rgba(255, 64, 64, 0.6)',
        outline: '1px solid rgba(255, 64, 64, 0.9)',
      },
      '.cm-panels': { backgroundColor: v('toolbarBackground'), color: v('foreground') },
      '.cm-panels.cm-panels-top': { borderBottom: `1px solid ${v('border')}` },
    },
    { dark },
  );
}

export function toCodeMirrorTheme(theme: Theme): Extension {
  return [editorTheme(theme.type === 'dark'), syntaxHighlighting(highlight)];
}
