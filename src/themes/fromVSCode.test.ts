import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { fromVSCode, ThemeImportError } from './fromVSCode';

const require = createRequire(import.meta.url);
const tmTheme = (name: string) => readFileSync(require.resolve(`tm-themes/themes/${name}.json`), 'utf8');

function importErrors(source: string): string[] {
  try {
    fromVSCode(source, 'x');
  } catch (error) {
    if (error instanceof ThemeImportError) return error.errors;
    throw error;
  }
  throw new Error('expected a ThemeImportError');
}

describe('fromVSCode with real themes', () => {
  it('converts Dracula', () => {
    const { theme, warnings } = fromVSCode(tmTheme('dracula'), 'dracula');
    expect(warnings).toEqual([]);
    expect(theme).toEqual({
      id: 'dracula',
      name: 'Dracula Theme',
      type: 'dark',
      source: 'imported',
      colors: {
        background: '#282a36',
        foreground: '#f8f8f2',
        gutterForeground: '#6272a4',
        selection: '#44475a',
        toolbarBackground: '#21222c',
        border: '#bd93f9',
        key: '#8be9fd',
        string: '#f1fa8c',
        number: '#bd93f9',
        boolean: '#bd93f9',
        null: '#bd93f9',
        punctuation: '#ff79c6',
        link: '#8be9fd',
      },
    });
  });

  it('normalizes shorthand hex in GitHub Light', () => {
    const { theme } = fromVSCode(tmTheme('github-light'), 'github-light');
    expect(theme.type).toBe('light');
    expect(theme.colors.background).toBe('#ffffff');
    expect(theme.colors.key).toBe('#005cc5');
  });

  it('matches the Dark+ colors used by the hand-written default', () => {
    const { theme } = fromVSCode(tmTheme('dark-plus'), 'dark-plus');
    expect(theme.colors).toMatchObject({ key: '#9cdcfe', string: '#ce9178', number: '#b5cea8', boolean: '#569cd6' });
  });
});

describe('fromVSCode edge cases', () => {
  it('accepts JSONC with comments and trailing commas', () => {
    const source = `{
      // a comment
      "name": "Commented",
      "type": "dark",
      "colors": { "editor.background": "#101010", "editor.foreground": "#EEEEEE", },
      "tokenColors": [{ "scope": "support.type.property-name", "settings": { "foreground": "#FF0000" } },],
    }`;
    const { theme, warnings } = fromVSCode(source, 'commented');
    expect(warnings).toEqual([]);
    expect(theme.colors).toEqual({ background: '#101010', foreground: '#eeeeee', key: '#ff0000' });
  });

  it('derives the type from the background when "type" is missing', () => {
    const light = fromVSCode('{"colors":{"editor.background":"#fafafa"}}', 'l').theme;
    const dark = fromVSCode('{"colors":{"editor.background":"#202020"}}', 'd').theme;
    expect([light.type, dark.type]).toEqual(['light', 'dark']);
  });

  it('maps high-contrast types', () => {
    expect(fromVSCode('{"type":"hcLight","colors":{"editor.background":"#fff"}}', 'a').theme.type).toBe('light');
    expect(fromVSCode('{"type":"hc","colors":{"editor.background":"#000"}}', 'b').theme.type).toBe('dark');
  });

  it('uses defaults and warns when the background is missing', () => {
    const { theme, warnings } = fromVSCode(
      '{"type":"light","tokenColors":[{"settings":{"foreground":"#333333"}},{"scope":"string","settings":{"foreground":"#a31515"}}]}',
      'x',
    );
    // Keys carry the `string.json` scope too, so a bare "string" rule colors them as well (as in VS Code).
    expect(theme.colors).toEqual({
      background: '#ffffff',
      foreground: '#333333',
      key: '#a31515',
      string: '#a31515',
      link: '#a31515',
    });
    expect(warnings).toEqual(['"editor.background" is missing; using the default light background']);
  });

  it('warns about include, tokenColors files and invalid colors', () => {
    const { warnings } = fromVSCode(
      '{"include":"./base.json","tokenColors":"./tokens.json","colors":{"editor.background":"#000000","editor.foreground":"white"}}',
      'x',
    );
    expect(warnings).toEqual([
      '"tokenColors" points to another file (./tokens.json); syntax colors use the defaults',
      'Ignored "editor.foreground": "white" is not a hex color',
      'Theme extends "./base.json"; colors it doesn\'t define were derived',
    ]);
  });

  it('imports color-only themes without a background', () => {
    const { theme, warnings } = fromVSCode('{"type":"dark","colors":{"editor.foreground":"#cccccc"}}', 'x');
    expect(theme.colors).toEqual({ background: '#1e1e1e', foreground: '#cccccc' });
    expect(warnings).toEqual(['"editor.background" is missing; using the default dark background']);
  });

  it('finds the global foreground in a scope-less rule that has one', () => {
    const source =
      '{"colors":{"editor.background":"#000000"},"tokenColors":[{"settings":{"fontStyle":"italic"}},{"scope":"","settings":{"foreground":"#abcdef"}}]}';
    expect(fromVSCode(source, 'x').theme.colors.foreground).toBe('#abcdef');
  });

  it('falls back to a generic name', () => {
    expect(fromVSCode('{"colors":{"editor.background":"#000"}}', 'x').theme.name).toBe('Imported theme');
  });

  it('rejects invalid JSON, non-objects and files without colors', () => {
    expect(importErrors('{"colors": ')[0]).toMatch(/^Invalid JSON: /);
    expect(importErrors('[1, 2]')).toEqual(['Expected a JSON object with "colors" and "tokenColors"']);
    expect(importErrors('{"name":"x"}')).toEqual(['No "colors" or "tokenColors" found — is this a VS Code color theme?']);
  });
});
