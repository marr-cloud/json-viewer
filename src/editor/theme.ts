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
      '.cm-jv-swatch': {
        display: 'inline-block',
        width: '0.8em',
        height: '0.8em',
        marginRight: '0.25em',
        verticalAlign: '-0.05em',
        border: `1px solid ${v('border')}`,
        borderRadius: '2px',
      },
      '.cm-tooltip': {
        backgroundColor: v('toolbarBackground'),
        color: v('foreground'),
        border: `1px solid ${v('border')}`,
        borderRadius: '4px',
        padding: '4px 8px',
      },
      '.cm-jv-image img': { display: 'block', maxWidth: '240px', maxHeight: '180px', marginBottom: '4px' },
      '.cm-jv-image-info': { opacity: '0.8' },
      '.cm-jv-error-line': { backgroundColor: 'rgba(255, 64, 64, 0.18)' },
      '.cm-jv-error-char': {
        backgroundColor: 'rgba(255, 64, 64, 0.6)',
        outline: '1px solid rgba(255, 64, 64, 0.9)',
      },
      '.cm-panels': { backgroundColor: v('toolbarBackground'), color: v('foreground') },
      '.cm-panels.cm-panels-top': { borderBottom: `1px solid ${v('border')}` },
      // Compact search panel (searchPanel.ts), styled like the toolbar's JSONPath filter.
      '.cm-jv-search': {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
      },
      // The base theme spaces `.cm-search` inputs and buttons with margins; the gap does it here.
      '.cm-panels .cm-panel.cm-jv-search input, .cm-panels .cm-panel.cm-jv-search button': { margin: '0' },
      '.cm-jv-search-field': {
        display: 'flex',
        alignItems: 'center',
        gap: '1px',
        flex: '0 1 320px',
        minWidth: '180px',
        height: '24px',
        padding: '0 2px 0 0',
        border: `1px solid ${v('border')}`,
        borderRadius: '4px',
        backgroundColor: v('background'),
      },
      '.cm-jv-search-field:focus-within': { borderColor: v('link') },
      '.cm-jv-search-input': {
        flex: '1',
        minWidth: '0',
        height: '100%',
        padding: '0 6px',
        border: 'none',
        outline: 'none',
        background: 'transparent',
        color: 'inherit',
        fontFamily: 'var(--jv-font-family)',
        fontSize: '12px',
      },
      '.cm-jv-search-field:has(.cm-jv-search-input[aria-invalid="true"])': { borderColor: '#f14c4c' },
      '.cm-jv-search-toggle, .cm-jv-search-button': {
        height: '20px',
        minWidth: '22px',
        padding: '0 4px',
        border: '1px solid transparent',
        borderRadius: '3px',
        background: 'transparent',
        color: 'inherit',
        font: 'inherit',
        lineHeight: '1',
        cursor: 'pointer',
      },
      '.cm-jv-search-toggle': { fontFamily: 'var(--jv-font-family)', opacity: '0.75' },
      '.cm-jv-search-word': { textDecoration: 'underline', textUnderlineOffset: '2px' },
      '.cm-jv-search-button': { fontSize: '14px', minWidth: '24px', height: '24px' },
      '.cm-jv-search-toggle:hover, .cm-jv-search-button:hover, .cm-jv-search-toggle:focus-visible, .cm-jv-search-button:focus-visible':
        { borderColor: v('border'), opacity: '1' },
      '.cm-jv-search-toggle[aria-pressed="true"]': {
        opacity: '1',
        borderColor: v('link'),
        backgroundColor: v('selection'),
      },
      '.cm-jv-search-count': { minWidth: '72px', padding: '0 4px', opacity: '0.85', whiteSpace: 'nowrap' },
      '.cm-jv-search-none': { color: '#f14c4c', opacity: '1' },
    },
    { dark },
  );
}

export function toCodeMirrorTheme(theme: Theme): Extension {
  return [editorTheme(theme.type === 'dark'), syntaxHighlighting(highlight)];
}
