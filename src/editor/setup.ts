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
import { NO_RICH_VALUES, type RichValues, type ViewerOptions } from '@/viewer/options';
import { errorMarker, type ErrorLocation } from './errorLine';
import { colorSwatches } from './colorSwatches';
import { dateTooltips } from './dateTooltips';
import { foldSummaries } from './foldSummary';
import { imagePreview } from './imagePreview';
import { editorPhrases } from './phrases';
import { createSearchPanel } from './searchPanel';
import { toCodeMirrorTheme } from './theme';
import { clickableUrls } from './urls';

export interface EditorSetup {
  options: ViewerOptions;
  theme: Theme;
  error: ErrorLocation | null;
  /** Color swatches and date/image tooltips; none when omitted. */
  rich?: RichValues;
  /** The page the document came from: root-relative paths link against it. */
  pageUrl?: string;
}

export function buildExtensions({ options, theme, error, rich = NO_RICH_VALUES, pageUrl }: EditorSetup): Extension[] {
  const extensions: Extension[] = [
    // Read-only but still focusable, so the cursor, search and keyboard navigation work.
    EditorState.readOnly.of(true),
    EditorState.tabSize.of(options.tabSize),
    json(),
    drawSelection(),
    // "Select all matches" in the search panel.
    EditorState.allowMultipleSelections.of(true),
    highlightActiveLine(),
    highlightSelectionMatches(),
    search({ top: true, createPanel: createSearchPanel }),
    // Ctrl+F is a configurable viewer shortcut (JsonViewer), so CodeMirror must not claim it.
    keymap.of([...searchKeymap.filter((binding) => binding.key !== 'Mod-f'), ...foldKeymap, ...defaultKeymap]),
    toCodeMirrorTheme(theme),
    editorPhrases(),
  ];
  if (options.lineNumbers) extensions.push(lineNumbers(), highlightActiveLineGutter());
  if (options.foldGutter) extensions.push(foldGutter());
  if (options.showArraySize) extensions.push(foldSummaries());
  if (options.lineWrapping) extensions.push(EditorView.lineWrapping);
  if (options.clickableUrls) extensions.push(clickableUrls(options, pageUrl));
  if (rich.colorSwatches) extensions.push(colorSwatches());
  if (rich.dateTooltips) extensions.push(dateTooltips());
  if (rich.imagePreview) extensions.push(imagePreview());
  if (error !== null) extensions.push(errorMarker(error));
  return extensions;
}
