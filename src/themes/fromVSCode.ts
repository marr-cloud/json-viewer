import { parse, printParseErrorCode, type ParseError } from 'jsonc-parser';
import { isRecord } from '../shared/guards';
import { parseHex, toHex } from './color';
import { resolveScopeColor, type TokenColorRule } from './scopes';
import type { Theme, ThemeColorKey, ThemeColors } from './types';

export class ThemeImportError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join('\n'));
    this.name = 'ThemeImportError';
    this.errors = errors;
  }
}

export interface ImportedTheme {
  theme: Theme;
  warnings: string[];
}

// Workbench color ids, in priority order, for each compact color.
const EDITOR_COLORS: [ThemeColorKey, ...string[]][] = [
  ['gutterForeground', 'editorLineNumber.foreground'],
  ['selection', 'editor.selectionBackground'],
  ['activeLine', 'editor.lineHighlightBackground'],
  ['cursor', 'editorCursor.foreground'],
  ['gutterBackground', 'editorGutter.background'],
  ['toolbarBackground', 'titleBar.activeBackground'],
  ['border', 'panel.border', 'editorGroup.border'],
];

// Scope stacks VS Code's JSON grammar produces for each token kind.
const DICT = ['source.json', 'meta.structure.dictionary.json'];
const VALUE = [...DICT, 'meta.structure.dictionary.value.json'];
const TOKEN_SCOPES: [ThemeColorKey, string[]][] = [
  ['key', [...DICT, 'string.json', 'support.type.property-name.json']],
  ['string', [...VALUE, 'string.quoted.double.json']],
  ['number', [...VALUE, 'constant.numeric.json']],
  ['boolean', [...VALUE, 'constant.language.json']],
  ['null', [...VALUE, 'constant.language.json']],
  ['punctuation', [...DICT, 'punctuation.separator.dictionary.key-value.json']],
  ['link', [...VALUE, 'string.quoted.double.json', 'markup.underline.link']],
];

const DEFAULT_BASE: Record<Theme['type'], { background: string; foreground: string }> = {
  dark: { background: '#1e1e1e', foreground: '#d4d4d4' },
  light: { background: '#ffffff', foreground: '#000000' },
};

/** Converts a VS Code color theme (JSON or JSONC) to the compact format. Throws ThemeImportError. */
export function fromVSCode(source: string, id: string): ImportedTheme {
  const parseErrors: ParseError[] = [];
  const json: unknown = parse(source, parseErrors, { allowTrailingComma: true });
  if (parseErrors.length > 0) {
    throw new ThemeImportError(
      parseErrors.map((e) => `Invalid JSON: ${printParseErrorCode(e.error)} at character ${e.offset}`),
    );
  }
  if (!isRecord(json)) throw new ThemeImportError(['Expected a JSON object with "colors" and "tokenColors"']);

  const warnings: string[] = [];
  const editorColors = isRecord(json.colors) ? json.colors : {};
  let rules: TokenColorRule[] = [];
  if (Array.isArray(json.tokenColors)) {
    rules = json.tokenColors.filter(isRecord) as TokenColorRule[];
  } else if (typeof json.tokenColors === 'string') {
    warnings.push(`"tokenColors" points to another file (${json.tokenColors}); syntax colors use the defaults`);
  }
  if (Object.keys(editorColors).length === 0 && rules.length === 0) {
    throw new ThemeImportError(['No "colors" or "tokenColors" found — is this a VS Code color theme?']);
  }

  const color = (value: unknown, label: string): string | undefined => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string') {
      try {
        return toHex(parseHex(value));
      } catch {
        // reported below
      }
    }
    warnings.push(`Ignored ${label}: ${JSON.stringify(value)} is not a hex color`);
    return undefined;
  };

  const background = color(editorColors['editor.background'], '"editor.background"');
  const type = themeType(json.type, background);
  if (background === undefined) {
    warnings.push(`"editor.background" is missing; using the default ${type} background`);
  }
  const globalRule = rules.find(
    (rule) =>
      (rule.scope === undefined || rule.scope === null || rule.scope === '') &&
      typeof rule.settings?.foreground === 'string',
  );
  const foreground =
    color(editorColors['editor.foreground'], '"editor.foreground"') ??
    color(globalRule?.settings?.foreground, 'the global foreground');

  const colors: Partial<ThemeColors> & Pick<ThemeColors, 'background' | 'foreground'> = {
    background: background ?? DEFAULT_BASE[type].background,
    foreground: foreground ?? DEFAULT_BASE[type].foreground,
  };
  for (const [key, ...names] of EDITOR_COLORS) {
    for (const name of names) {
      const value = color(editorColors[name], `"${name}"`);
      if (value !== undefined) {
        colors[key] = value;
        break;
      }
    }
  }
  for (const [key, stack] of TOKEN_SCOPES) {
    const value = color(resolveScopeColor(rules, stack) ?? undefined, `the ${key} token color`);
    if (value !== undefined) colors[key] = value;
  }
  if (typeof json.include === 'string') {
    warnings.push(`Theme extends "${json.include}"; colors it doesn't define were derived`);
  }

  const name =
    [json.displayName, json.name].find((n): n is string => typeof n === 'string' && n.trim() !== '')?.trim() ??
    'Imported theme';
  return { theme: { id, name, type, source: 'imported', colors }, warnings };
}

function themeType(declared: unknown, background: string | undefined): Theme['type'] {
  if (declared === 'light' || declared === 'hcLight') return 'light';
  if (declared === 'dark' || declared === 'hc' || declared === 'hcDark') return 'dark';
  if (background === undefined) return 'dark';
  const { r, g, b } = parseHex(background);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5 ? 'dark' : 'light';
}
