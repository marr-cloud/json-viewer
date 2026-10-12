import { describe, expect, it } from 'vitest';
import {
  actionFor,
  comboFromEvent,
  conflictWith,
  defaultShortcuts,
  isValidShortcut,
  modifierHint,
  shortcutLabel,
  SHORTCUT_ACTIONS,
  validateShortcuts,
} from './shortcuts';

type Mods = Partial<{ ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }>;
const press = (code: string, mods: Mods = {}) => ({
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods,
});

describe('defaultShortcuts', () => {
  it('matches the spec table', () => {
    expect(defaultShortcuts).toEqual({
      search: 'Ctrl+F',
      filter: 'Ctrl+Shift+F',
      toggleRaw: 'Alt+R',
      foldAll: 'Alt+[',
      unfoldAll: 'Alt+]',
      copyPath: 'Ctrl+Shift+C',
    });
    for (const action of SHORTCUT_ACTIONS) expect(isValidShortcut(defaultShortcuts[action])).toBe(true);
  });
});

describe('comboFromEvent', () => {
  it('names keys by their physical position', () => {
    expect(comboFromEvent(press('KeyF', { ctrlKey: true, shiftKey: true }))).toBe('Ctrl+Shift+F');
    expect(comboFromEvent(press('BracketLeft', { altKey: true }))).toBe('Alt+[');
    expect(comboFromEvent(press('Digit1', { ctrlKey: true, altKey: true, shiftKey: true, metaKey: true }))).toBe(
      'Ctrl+Alt+Shift+Meta+1',
    );
    expect(comboFromEvent(press('F2'))).toBe('F2');
    expect(comboFromEvent(press('ArrowUp', { altKey: true }))).toBe('Alt+ArrowUp');
    expect(comboFromEvent(press('Slash', { ctrlKey: true }))).toBe('Ctrl+/');
  });

  it('ignores modifier keys on their own and unknown keys', () => {
    for (const code of ['ControlLeft', 'AltRight', 'ShiftLeft', 'MetaLeft', 'CapsLock', 'Unidentified', '']) {
      expect(comboFromEvent(press(code, { ctrlKey: true }))).toBeNull();
    }
  });

  it('tells AltGr (Ctrl+Alt) apart from Alt', () => {
    expect(comboFromEvent(press('BracketLeft', { ctrlKey: true, altKey: true }))).toBe('Ctrl+Alt+[');
    expect(actionFor(defaultShortcuts, 'Ctrl+Alt+[')).toBeNull();
  });
});

describe('isValidShortcut', () => {
  it('accepts canonical combinations and the empty string', () => {
    for (const value of ['', 'Ctrl+F', 'Alt+[', 'Ctrl+Shift+C', 'F2', 'Shift+F3', 'Meta+K', 'Ctrl+Alt+Shift+Meta+1', 'Alt+Space']) {
      expect(isValidShortcut(value)).toBe(true);
    }
  });

  it('rejects shortcuts without Ctrl, Alt, Meta or a function key', () => {
    for (const value of ['F', 'Shift+F', '[', 'Shift+1', 'Enter']) expect(isValidShortcut(value)).toBe(false);
  });

  it('rejects malformed combinations', () => {
    for (const value of ['Ctrl+', 'Shift+Ctrl+F', 'Ctrl+Ctrl+F', 'Ctrl+Foo', 'ctrl+f', 'Ctrl+f', ' Ctrl+F', 'Ctrl+F25']) {
      expect(isValidShortcut(value)).toBe(false);
    }
  });
});

describe('validateShortcuts', () => {
  it('returns the defaults for anything that is not an object', () => {
    for (const input of [undefined, null, 'x', 3, []]) expect(validateShortcuts(input)).toEqual(defaultShortcuts);
  });

  it('keeps valid and disabled shortcuts and replaces invalid ones', () => {
    expect(validateShortcuts({ search: '', filter: 'Ctrl+Alt+P', toggleRaw: 'R', foldAll: 7 })).toEqual({
      ...defaultShortcuts,
      search: '',
      filter: 'Ctrl+Alt+P',
    });
  });
});

describe('actionFor', () => {
  it('finds the action bound to a combination', () => {
    expect(actionFor(defaultShortcuts, 'Alt+R')).toBe('toggleRaw');
    expect(actionFor(defaultShortcuts, 'Ctrl+Q')).toBeNull();
  });

  it('lets the first action win when two share a combination', () => {
    expect(actionFor({ ...defaultShortcuts, copyPath: 'Ctrl+F' }, 'Ctrl+F')).toBe('search');
  });
});

describe('conflictWith', () => {
  it('finds no conflicts in the defaults', () => {
    for (const action of SHORTCUT_ACTIONS) expect(conflictWith(defaultShortcuts, action)).toBeNull();
  });

  it('names the other action bound to the same combination', () => {
    const shortcuts = { ...defaultShortcuts, filter: 'Alt+R' };
    expect(conflictWith(shortcuts, 'filter')).toBe('toggleRaw');
    expect(conflictWith(shortcuts, 'toggleRaw')).toBe('filter');
  });

  it('never reports disabled shortcuts as conflicting', () => {
    expect(conflictWith({ ...defaultShortcuts, search: '', filter: '' }, 'search')).toBeNull();
  });
});

describe('on a Mac', () => {
  it('reads Cmd as Ctrl, so the same settings work on every platform', () => {
    expect(comboFromEvent(press('KeyF', { metaKey: true }), true)).toBe('Ctrl+F');
    expect(comboFromEvent(press('KeyF', { ctrlKey: true, shiftKey: true }), true)).toBe('Ctrl+Shift+F');
    expect(comboFromEvent(press('KeyF', { ctrlKey: true, metaKey: true }), true)).toBe('Ctrl+F');
  });

  it('keeps Meta apart on other platforms', () => {
    expect(comboFromEvent(press('KeyF', { metaKey: true }), false)).toBe('Meta+F');
    expect(comboFromEvent(press('KeyF', { ctrlKey: true, metaKey: true }), false)).toBe('Ctrl+Meta+F');
  });

  it('shows Cmd and Option', () => {
    expect(shortcutLabel('Ctrl+Alt+Shift+F', true)).toBe('Cmd+Option+Shift+F');
    expect(shortcutLabel('Ctrl+Alt+Shift+F', false)).toBe('Ctrl+Alt+Shift+F');
    expect(shortcutLabel('', true)).toBe('');
  });

  it('names the modifiers in the hint', () => {
    expect(modifierHint(true)).toBe('Use Cmd, Option or a function key (F1–F24).');
    expect(modifierHint(false)).toBe('Use Ctrl, Alt or a function key (F1–F24).');
  });
});
