import { EditorState, type Extension } from '@codemirror/state';
import { t, type MessageKey } from '@/i18n';

/** The texts CodeMirror itself shows or announces (fold arrows, go to line, screen reader messages). */
const PHRASES: Record<string, MessageKey> = {
  'Fold line': 'cm.foldLine',
  'Unfold line': 'cm.unfoldLine',
  unfold: 'cm.unfold',
  'folded code': 'cm.foldedCode',
  'Folded lines': 'cm.foldedLines',
  'Unfolded lines': 'cm.unfoldedLines',
  to: 'cm.to',
  'Go to line': 'cm.goToLine',
  go: 'cm.go',
  close: 'cm.close',
  'current match': 'cm.currentMatch',
  'on line': 'cm.onLine',
  'Control character': 'cm.controlCharacter',
  'Selection deleted': 'cm.selectionDeleted',
};

/** CodeMirror's own texts in the page language; built again when the editor is reconfigured. */
export function editorPhrases(): Extension {
  return EditorState.phrases.of(Object.fromEntries(Object.entries(PHRASES).map(([phrase, key]) => [phrase, t(key)])));
}
