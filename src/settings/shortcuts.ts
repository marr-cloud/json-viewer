import type { MessageKey } from '@/i18n/translate';
import { validateFields, type FieldValidator, type ObjectValidators } from './fields';

export const SHORTCUT_ACTIONS = ['search', 'filter', 'toggleRaw', 'foldAll', 'unfoldAll', 'copyPath'] as const;
export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number];

/** Combinations like "Ctrl+Shift+F" (modifiers in the order Ctrl, Alt, Shift, Meta); "" disables the action. */
export type Shortcuts = Record<ShortcutAction, string>;

export const defaultShortcuts: Shortcuts = {
  search: 'Ctrl+F',
  filter: 'Ctrl+Shift+F',
  toggleRaw: 'Alt+R',
  foldAll: 'Alt+[',
  unfoldAll: 'Alt+]',
  copyPath: 'Ctrl+Shift+C',
};

/** Message keys (src/i18n) naming each action; this module stays free of the UI's translation runtime. */
export const SHORTCUT_LABEL_KEYS: Record<ShortcutAction, MessageKey> = {
  search: 'options.shortcuts.action.search',
  filter: 'options.shortcuts.action.filter',
  toggleRaw: 'options.shortcuts.action.toggleRaw',
  foldAll: 'options.shortcuts.action.foldAll',
  unfoldAll: 'options.shortcuts.action.unfoldAll',
  copyPath: 'options.shortcuts.action.copyPath',
};

const PUNCTUATION_KEYS: Record<string, string> = {
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Slash: '/',
  Comma: ',',
  Period: '.',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Minus: '-',
  Equal: '=',
};

const NAMED_KEYS = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Enter',
  'Space',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Insert',
  'Delete',
  'Backspace',
  'Tab',
  'Escape',
];

const FUNCTION_KEY = /^F([1-9]|1[0-9]|2[0-4])$/;

const KNOWN_KEYS = new Set<string>([
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  ...Array.from({ length: 24 }, (_, i) => `F${i + 1}`),
  ...Object.values(PUNCTUATION_KEYS),
  ...NAMED_KEYS,
]);

/** The key part of a combination, taken from the physical key so Shift, Alt and AltGr never change it. */
function keyFromCode(code: string): string | null {
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1]!;
  const digit = /^Digit([0-9])$/.exec(code);
  if (digit) return digit[1]!;
  if (FUNCTION_KEY.test(code)) return code;
  return PUNCTUATION_KEYS[code] ?? (NAMED_KEYS.includes(code) ? code : null);
}

type KeyPress = Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>;

/** On a Mac, Cmd plays Ctrl's role: a stored "Ctrl+F" means Cmd+F there, so settings sync across platforms. */
export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * "Ctrl+Alt+Shift+Meta+Key" for a key press; null for modifier keys on their own and unknown keys.
 * On a Mac, Cmd counts as Ctrl, unless Ctrl is held too (Ctrl+Cmd+F is macOS's full screen): then both are kept.
 */
export function comboFromEvent(event: KeyPress, mac = IS_MAC): string | null {
  const key = keyFromCode(event.code);
  if (key === null) return null;
  const parts = [
    event.ctrlKey || (mac && event.metaKey) ? 'Ctrl' : '',
    event.altKey ? 'Alt' : '',
    event.shiftKey ? 'Shift' : '',
    event.metaKey && (!mac || event.ctrlKey) ? 'Meta' : '',
    key,
  ];
  return parts.filter((part) => part !== '').join('+');
}

/** How a combination reads on this platform: "Cmd" and "Option" on a Mac. */
export function shortcutLabel(combo: string, mac = IS_MAC): string {
  if (!mac) return combo;
  const parts = combo.split('+');
  // With both stored, Ctrl is the real Control key and Meta is Cmd. A Meta without Ctrl was recorded
  // before Cmd counted as Ctrl and can't match on a Mac, so it keeps its stored name.
  const both = parts.includes('Ctrl') && parts.includes('Meta');
  return parts
    .map((part) => {
      if (part === 'Ctrl') return both ? 'Ctrl' : 'Cmd';
      if (part === 'Meta') return both ? 'Cmd' : 'Meta';
      return part === 'Alt' ? 'Option' : part;
    })
    .join('+');
}

/** The message key saying why a key press can't be a shortcut, naming this platform's modifiers. */
export function modifierHint(mac = IS_MAC): MessageKey {
  return mac ? 'options.shortcuts.modifiersMac' : 'options.shortcuts.modifiers';
}

const COMBO = /^(Ctrl\+)?(Alt\+)?(Shift\+)?(Meta\+)?(.+)$/;

/** A canonical combination with Ctrl, Alt or Meta (or a function key), or "" for none. */
export function isValidShortcut(value: string): boolean {
  if (value === '') return true;
  const match = COMBO.exec(value);
  if (!match) return false;
  const [, ctrl, alt, , meta, key] = match;
  if (!KNOWN_KEYS.has(key!)) return false;
  // Without one of these the shortcut would fire while typing.
  return Boolean(ctrl || alt || meta) || FUNCTION_KEY.test(key!);
}

const shortcut: FieldValidator<string> = (value, fallback) =>
  typeof value === 'string' && isValidShortcut(value) ? value : fallback;

const shortcutValidators = Object.fromEntries(
  SHORTCUT_ACTIONS.map((action) => [action, shortcut]),
) as ObjectValidators<Shortcuts>;

export function validateShortcuts(input: unknown): Shortcuts {
  return validateFields(input, defaultShortcuts, shortcutValidators);
}

/** The action bound to `combo`; when several share it, the first in SHORTCUT_ACTIONS wins. */
export function actionFor(shortcuts: Shortcuts, combo: string): ShortcutAction | null {
  if (combo === '') return null;
  return SHORTCUT_ACTIONS.find((action) => shortcuts[action] === combo) ?? null;
}

/** Another action bound to the same combination as `action`, if any. */
export function conflictWith(shortcuts: Shortcuts, action: ShortcutAction): ShortcutAction | null {
  const combo = shortcuts[action];
  if (combo === '') return null;
  return SHORTCUT_ACTIONS.find((other) => other !== action && shortcuts[other] === combo) ?? null;
}
