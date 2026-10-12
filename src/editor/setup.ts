import { defaultKeymap } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { foldGutter, foldKeymap } from '@codemirror/language';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { EditorState, type Extension } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import type { Theme } from '@/themes/types';
import type { ViewerOptions } from '@/viewer/options';
import { errorMarker, type ErrorLocation } from './errorLine';
import { foldSummaries } from './foldSummary';
import { toCodeMirrorTheme } from './theme';
import { clickableUrls } from './urls';

export interface EditorSetup {
  options: ViewerOptions;
  theme: Theme;
  error: ErrorLocation | null;
}

export function buildExtensions({ options, theme, error }: EditorSetup): Extension[] {
  const extensions: Extension[] = [
    // Read-only but still focusable, so the cursor, search and keyboard navigation work.
    EditorState.readOnly.of(true),
    EditorState.tabSize.of(options.tabSize),
    json(),
    drawSelection(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    search({ top: true }),
    // Ctrl+F is a configurable viewer shortcut (JsonViewer), so CodeMirror must not claim it.
    keymap.of([...searchKeymap.filter((binding) => binding.key !== 'Mod-f'), ...foldKeymap, ...defaultKeymap]),
    toCodeMirrorTheme(theme),
  ];
  if (options.lineNumbers) extensions.push(lineNumbers(), highlightActiveLineGutter());
  if (options.foldGutter) extensions.push(foldGutter());
  if (options.showArraySize) extensions.push(foldSummaries());
  if (options.lineWrapping) extensions.push(EditorView.lineWrapping);
  if (options.clickableUrls) extensions.push(clickableUrls(options));
  if (error !== null) extensions.push(errorMarker(error));
  return extensions;
}
