# JSON Viewer — Fase 3 (Fuentes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user pick the viewer's font. Google Fonts families are downloaded once and work offline afterwards; installed system fonts also work. The user controls size, line height, weight and ligatures, and settings written by newer versions survive saves from older ones.

**Architecture:**
- `src/settings/fields.ts` holds reusable field validators. `validateSettings` and the new `validateFontSettings` are built from them.
- `saveSettings` merges unknown stored keys back in.
- `src/fonts/` holds the downloadable-font pipeline: `css2` parser → downloader → `local:` store → `FontFace` loader. A tracker ties a font family (reactive) to the loader.
- The viewer gets the font through CSS variables on `.jv-root` (`fontCssVars`). Both the content script and the options preview register downloaded faces on `document.fonts`.
- Downloads happen only in the options page, on an explicit click.

**Tech Stack:** WXT 0.21.4, Vue 3.5, CodeMirror 6, TypeScript, pnpm 12, Node 24, Vitest 5 (+ happy-dom, `fakeBrowser`), Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-10-11-json-viewer-design.md` (§5 Fuentes, §6.7 `font`, §8.2 cuotas). Pending notes: `docs/notes/pendientes-fase-2.md` ("Decidir antes de la Fase 3").

### Decisions that refine the spec (approved with this plan)

1. **No host permissions.** The spec asked for `permissions.request` on `fonts.googleapis.com` and `fonts.gstatic.com`. Both answer `Access-Control-Allow-Origin: *` (verified 2026-10-12), so the options page can `fetch` them without any permission. The manifest keeps only `storage` and `scripting`: no extra install warning, and no permission prompt that e2e tests could not click.
2. **Weights 300–700.** Downloads request `wght@300;400;500;600;700` so the weight control (300/400/500/600) works. Google silently omits weights a family lacks. Variable fonts reuse one file for every weight, so weights sharing a file are merged into one `FontFace` with a weight range (`"300 700"`) and the file is stored once.
3. **Storage.** One `local:fonts/<family>` item per family, as the spec says, plus an index `local:fontFamilies` (string[]) for listing, like the theme store. Each face is `{ weight: string, unicodeRange, subset, dataBase64 }`.
4. **Catalog.** "Commit Mono" is not on Google Fonts (css2 answers 400), so it is dropped. Fragment Mono, Spline Sans Mono and Reddit Mono complete the list of 20 (all verified 200).
5. **Forward compatibility.** `saveSettings` keeps stored keys this version doesn't know, recursively for nested objects. A newer version's fields survive saves from an older one.

## Global Constraints

- pnpm only, Node 24. Manifest V3. Permissions stay exactly `storage` and `scripting`.
- Network access happens only in the options page, when the user clicks Download, and only to `https://fonts.googleapis.com/css2` and `https://fonts.gstatic.com/`. Content scripts and the background never fetch.
- `srcDir: 'src'`; alias `@/` → `src/`. The `detector` content script must not change (≤ 8192 bytes).
- Keep `wxt.config.ts`'s rolldown `minify.codegen.asciiOnly`. The viewer content-script bundle must contain no non-ASCII bytes, so don't put non-ASCII literals in code it imports. Options-page code may use them.
- `src/themes/{color,types,scopes,fromVSCode,validate}.ts` and `src/shared/guards.ts` keep relative imports only (they run under `tsx`).
- Storage keys (exact): `sync:settings` (version 1, the `font` field added without a version bump), `local:customCss`, `sync:customThemeIds`, `sync:customTheme:<id>`, `local:fonts/<family>`, `local:fontFamilies`.
- Font family names in settings must match `FONT_FAMILY_PATTERN` (`/^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,79}$/u`) or be empty. CSS generation strips `"` and `\` defensively anyway.
- Identifiers, comments and UI text in English. Conventional commits.
- Unit tests sit next to code (`src/**/*.test.ts`); e2e tests live in `e2e/`. Component tests use happy-dom and Vue's `createApp`.
- The CodeView reconfigure watch is shallow. Any object passed to `JsonViewer` must be replaced, not mutated. Font settings reach the viewer only as CSS variables, through a computed `style`, so they need no reconfigure.

## Review Focus

1. **JSON served with a strict CSP** (`Content-Security-Policy: default-src 'none'`, common on APIs such as GitHub's). The downloaded font must still apply, because faces are built from an `ArrayBuffer`, not a URL. Test: Task 5 e2e `renders with a downloaded Google font under a strict CSP`.
2. **A font chosen on another device** (settings sync) **but not downloaded on this one.** The viewer must render with the fallback stack, and the options page must say "Not downloaded yet" and offer Download. Tests: Task 6 e2e `says when the chosen Google font is not downloaded on this device`; Task 5 unit test (tracker applies `null` for an undownloaded family).
3. **Odd or hostile family text** from typing or synced storage (quotes, braces, `</style>`). It must never break the stylesheet or the page; it falls back to the default stack. Tests: Task 2 unit tests (`validateFontSettings`, `fontStack`); Task 2 e2e `ignores a stored font family that could break the stylesheet`.
4. **Download failures:** unknown family (HTTP 400), offline, a file over the size cap, no files for the chosen character sets, or a failed file download. Each shows a clear message and saves nothing. Tests: Task 3 unit tests; Task 6 e2e `shows an error for an unknown Google font`.
5. **Fonts changing while a viewer tab is open** (downloaded later, or the source switched). Open tabs update live without reload. Tests: Task 5 e2e `picks up a font downloaded while the tab is open` and `switching to the Google source loads the stored font live`.

---

### Task 1: Settings forward compatibility and per-field validators

**Files:**
- Create: `src/settings/fields.ts`, `src/settings/fields.test.ts`, `src/settings/merge.ts`, `src/settings/merge.test.ts`
- Modify: `src/settings/schema.ts`, `src/settings/storage.ts`, `src/settings/storage.test.ts`

**Interfaces:**
- Consumes: `isRecord`, `nonEmptyString` (`src/shared/guards.ts`); `defaultViewerOptions`, `ViewerOptions` (`src/viewer/options.ts`).
- Produces:
  - `type FieldValidator<T> = (value: unknown, fallback: T) => T`
  - `bool`, `intInRange(min, max)`, `numberInRange(min, max, decimals)`, `oneOf(allowed)`, `nonEmptyId`
  - `type ObjectValidators<T>`; `validateFields<T extends object>(input: unknown, defaults: T, validators: ObjectValidators<T>): T`
  - `mergeUnknown<T extends object>(stored: unknown, next: T): T`
  - `validateSettings` keeps its signature and behavior.

- [ ] **Step 1: Failing tests**

`src/settings/fields.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { bool, intInRange, nonEmptyId, numberInRange, oneOf, validateFields } from './fields';

describe('field validators', () => {
  it('bool keeps booleans only', () => {
    expect(bool(true, false)).toBe(true);
    expect(bool('true', false)).toBe(false);
  });

  it('intInRange clamps and rounds finite numbers', () => {
    const tab = intInRange(1, 10);
    expect(tab(0, 2)).toBe(1);
    expect(tab(11, 2)).toBe(10);
    expect(tab(3.6, 2)).toBe(4);
    expect(tab(Number.NaN, 2)).toBe(2);
    expect(tab('3', 2)).toBe(2);
  });

  it('numberInRange clamps and keeps the given decimals', () => {
    const lineHeight = numberInRange(1, 3, 2);
    expect(lineHeight(1.234, 1.5)).toBe(1.23);
    expect(lineHeight(0.5, 1.5)).toBe(1);
    expect(lineHeight(9, 1.5)).toBe(3);
    expect(lineHeight(Number.POSITIVE_INFINITY, 1.5)).toBe(1.5);
  });

  it('oneOf accepts listed values only', () => {
    const weight = oneOf([300, 400] as const);
    expect(weight(300, 400)).toBe(300);
    expect(weight(500, 400)).toBe(400);
    expect(weight('300', 400)).toBe(400);
  });

  it('nonEmptyId rejects blank and non-string ids', () => {
    expect(nonEmptyId('dracula', 'x')).toBe('dracula');
    expect(nonEmptyId('  ', 'x')).toBe('x');
    expect(nonEmptyId(5, 'x')).toBe('x');
  });

  it('validateFields validates known fields and drops the rest', () => {
    const defaults = { size: 1, on: true };
    const validators = { size: intInRange(0, 5), on: bool };
    expect(validateFields({ size: 9, on: 'no', extra: 1 }, defaults, validators)).toEqual({ size: 5, on: true });
    const fromJunk = validateFields(null, defaults, validators);
    expect(fromJunk).toEqual(defaults);
    expect(fromJunk).not.toBe(defaults);
  });
});
```

`src/settings/merge.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mergeUnknown } from './merge';

describe('mergeUnknown', () => {
  it('returns the new value when nothing usable is stored', () => {
    expect(mergeUnknown(undefined, { a: 1 })).toEqual({ a: 1 });
    expect(mergeUnknown([1], { a: 1 })).toEqual({ a: 1 });
  });

  it('keeps stored keys the new value does not know, nested ones included', () => {
    const stored = { a: 0, future: 'x', nested: { b: 0, later: true } };
    expect(mergeUnknown(stored, { a: 1, nested: { b: 2 } })).toEqual({
      a: 1,
      future: 'x',
      nested: { b: 2, later: true },
    });
  });

  it('lets the new value win for known keys, arrays included', () => {
    expect(mergeUnknown({ list: [1, 2], obj: 'old' }, { list: [3], obj: { k: 1 } })).toEqual({
      list: [3],
      obj: { k: 1 },
    });
  });

  it('does not mutate its inputs', () => {
    const stored = { nested: { later: true } };
    const next = { nested: { b: 1 } };
    mergeUnknown(stored, next);
    expect(stored).toEqual({ nested: { later: true } });
    expect(next).toEqual({ nested: { b: 1 } });
  });
});
```

Add to `src/settings/storage.test.ts` (inside the existing `describe`):

```ts
  it('keeps fields written by a newer version when saving', async () => {
    await fakeBrowser.storage.sync.set({
      settings: { ...defaultSettings, futureFlag: true, viewer: { ...defaultSettings.viewer, futureOption: 3 } },
    });
    await saveSettings({ ...defaultSettings, themeMode: 'dark' });
    const stored = (await fakeBrowser.storage.sync.get('settings')).settings as Record<string, unknown>;
    expect(stored.futureFlag).toBe(true);
    expect((stored.viewer as Record<string, unknown>).futureOption).toBe(3);
    expect(stored.themeMode).toBe('dark');
    expect(await loadSettings()).toEqual({ ...defaultSettings, themeMode: 'dark' });
  });
```

Run `pnpm vitest run src/settings`. Expected: FAIL (modules `./fields` and `./merge` missing; the new storage test fails because `futureFlag` is dropped).

- [ ] **Step 2: Implement `fields.ts`**

```ts
import { isRecord, nonEmptyString } from '@/shared/guards';

/** Reads one field: returns the value when it is valid, otherwise the fallback. */
export type FieldValidator<T> = (value: unknown, fallback: T) => T;

export type ObjectValidators<T> = { [K in keyof T]-?: FieldValidator<T[K]> };

export const bool: FieldValidator<boolean> = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

export function intInRange(min: number, max: number): FieldValidator<number> {
  return (value, fallback) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}

export function numberInRange(min: number, max: number, decimals: number): FieldValidator<number> {
  return (value, fallback) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.min(max, Math.max(min, Number(value.toFixed(decimals))))
      : fallback;
}

export function oneOf<T extends string | number>(allowed: readonly T[]): FieldValidator<T> {
  return (value, fallback) => (allowed.includes(value as T) ? (value as T) : fallback);
}

export const nonEmptyId: FieldValidator<string> = (value, fallback) => nonEmptyString(value) ?? fallback;

/** Validates every known field; unknown fields are dropped here (storage keeps them, see mergeUnknown). */
export function validateFields<T extends object>(input: unknown, defaults: T, validators: ObjectValidators<T>): T {
  const raw = isRecord(input) ? input : {};
  const result = { ...defaults };
  for (const key of Object.keys(validators) as (keyof T)[]) {
    result[key] = validators[key](raw[key as string], defaults[key]);
  }
  return result;
}
```

- [ ] **Step 3: Implement `merge.ts`**

```ts
import { isRecord } from '@/shared/guards';

/**
 * Returns `next` plus every key of `stored` that `next` lacks, recursively for nested objects.
 * Settings written by a newer version keep their extra fields when an older version saves.
 */
export function mergeUnknown<T extends object>(stored: unknown, next: T): T {
  if (!isRecord(stored)) return next;
  const fresh = next as unknown as Record<string, unknown>;
  const result: Record<string, unknown> = { ...fresh };
  for (const [key, value] of Object.entries(stored)) {
    const known = fresh[key];
    if (!(key in fresh)) result[key] = value;
    else if (isRecord(value) && isRecord(known)) result[key] = mergeUnknown(value, known);
  }
  return result as T;
}
```

- [ ] **Step 4: Rebuild `schema.ts` on the validators**

Replace `src/settings/schema.ts` with:

```ts
import { bool, intInRange, nonEmptyId, oneOf, validateFields, type ObjectValidators } from './fields';
import { defaultViewerOptions, type ViewerOptions } from '@/viewer/options';

export type ThemeMode = 'auto' | 'light' | 'dark';

export interface Settings {
  viewer: ViewerOptions;
  themeMode: ThemeMode;
  lightThemeId: string;
  darkThemeId: string;
}

export const defaultSettings: Settings = {
  viewer: defaultViewerOptions,
  themeMode: 'auto',
  lightThemeId: 'light-plus',
  darkThemeId: 'dark-plus',
};

export const TAB_SIZE_MIN = 1;
export const TAB_SIZE_MAX = 10;

const viewerValidators: ObjectValidators<ViewerOptions> = {
  showHeader: bool,
  sortKeys: bool,
  clickableUrls: bool,
  wrapLinkWithAnchorTag: bool,
  openLinksInNewWindow: bool,
  autoHighlight: bool,
  lineNumbers: bool,
  lineWrapping: bool,
  foldGutter: bool,
  tabSize: intInRange(TAB_SIZE_MIN, TAB_SIZE_MAX),
  indentCStyle: bool,
  showArraySize: bool,
};

const settingsValidators: ObjectValidators<Settings> = {
  viewer: (value) => validateFields(value, defaultViewerOptions, viewerValidators),
  themeMode: oneOf<ThemeMode>(['auto', 'light', 'dark']),
  lightThemeId: nonEmptyId,
  darkThemeId: nonEmptyId,
};

/** Returns complete settings; every missing or invalid field falls back to its default. */
export function validateSettings(input: unknown): Settings {
  return validateFields(input, defaultSettings, settingsValidators);
}
```

- [ ] **Step 5: Merge unknown keys on save**

In `src/settings/storage.ts`, add `import { mergeUnknown } from './merge';`. Then replace `saveSettings` with:

```ts
export async function saveSettings(settings: Settings): Promise<void> {
  // Keep fields this version doesn't know: a newer version on another device may have written them.
  const stored = await settingsItem.getValue();
  await settingsItem.setValue(mergeUnknown(stored, validateSettings(settings)));
}
```

- [ ] **Step 6: Verify**

Run `pnpm vitest run src/settings`. Expected: all pass, including the unchanged `schema.test.ts`. Then run `pnpm test` and `pnpm compile`; expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/settings
git commit -m "feat(settings): keep unknown stored fields and validate settings per field"
```

---

### Task 2: Font settings, CSS variables and typography controls

**Files:**
- Create: `src/settings/font.ts`, `src/settings/font.test.ts`, `src/fonts/css.ts`, `src/fonts/css.test.ts`, `src/options/sections/FontsSection.vue`
- Modify:
  - Settings and fields: `src/settings/schema.ts`, `src/settings/schema.test.ts`, `src/options/fields/NumberField.vue`
  - Viewer and editor: `src/components/JsonViewer.vue`, `src/components/JsonViewer.test.ts`, `src/components/viewer.css`, `src/editor/theme.ts`, `src/entrypoints/viewer.content/index.ts`
  - Options page: `src/options/PreviewPane.vue`, `src/entrypoints/options/App.vue`, `src/options/sections/AdvancedSection.vue`
  - e2e: `e2e/settings.spec.ts`, `e2e/options.spec.ts`

**Interfaces:**
- Consumes: `bool`, `intInRange`, `numberInRange`, `oneOf`, `validateFields`, `FieldValidator`, `ObjectValidators` (Task 1).
- Produces:
  - `type FontSource = 'google' | 'system'`; `interface FontSettings { source; family; sizePx; lineHeight; ligatures; weight; subsets: string[] }`; `defaultFontSettings`
  - Constants: `FONT_SIZE_MIN = 8`, `FONT_SIZE_MAX = 32`, `LINE_HEIGHT_MIN = 1`, `LINE_HEIGHT_MAX = 3`, `FONT_WEIGHTS = [300, 400, 500, 600]`, `FONT_SUBSETS` (7 names), `FONT_FAMILY_PATTERN`
  - `validateFontSettings(input: unknown): FontSettings`
  - `Settings.font: FontSettings`
  - `DEFAULT_FONT_STACK`, `fontStack(family: string): string`, `fontCssVars(font: FontSettings): Record<string, string>` (`src/fonts/css.ts`)
  - `<JsonViewer :font?>`; `<NumberField :step?>`; `<FontsSection :font>` (section id `fonts`, labels `Font family`, `Font size (px)`, `Line height`, `Font weight`, `Font ligatures`)

- [ ] **Step 1: Failing unit tests**

`src/settings/font.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultFontSettings, validateFontSettings } from './font';

describe('validateFontSettings', () => {
  it('defaults to the system font at 13px / 1.5', () => {
    expect(defaultFontSettings).toEqual({
      source: 'system',
      family: '',
      sizePx: 13,
      lineHeight: 1.5,
      ligatures: true,
      weight: 400,
      subsets: ['latin', 'latin-ext'],
    });
  });

  it('keeps valid values', () => {
    const font = {
      source: 'google',
      family: 'JetBrains Mono',
      sizePx: 16,
      lineHeight: 1.65,
      ligatures: false,
      weight: 500,
      subsets: ['latin', 'cyrillic'],
    };
    expect(validateFontSettings(font)).toEqual(font);
  });

  it('rejects family names that could break out of a CSS string', () => {
    for (const family of ['"; } body {', "Fira'Code", 'a\\b', '<b>', 'x'.repeat(81), 42]) {
      expect(validateFontSettings({ family }).family).toBe('');
    }
    expect(validateFontSettings({ family: '  Fira Code  ' }).family).toBe('Fira Code');
  });

  it('clamps sizes and limits source and weight', () => {
    expect(validateFontSettings({ sizePx: 4 }).sizePx).toBe(8);
    expect(validateFontSettings({ sizePx: 99 }).sizePx).toBe(32);
    expect(validateFontSettings({ lineHeight: 0.5 }).lineHeight).toBe(1);
    expect(validateFontSettings({ lineHeight: 1.234 }).lineHeight).toBe(1.23);
    expect(validateFontSettings({ weight: 700 }).weight).toBe(400);
    expect(validateFontSettings({ source: 'web' }).source).toBe('system');
  });

  it('keeps only known subsets in catalog order and never leaves the list empty', () => {
    expect(validateFontSettings({ subsets: ['cyrillic', 'latin', 'klingon'] }).subsets).toEqual(['latin', 'cyrillic']);
    expect(validateFontSettings({ subsets: [] }).subsets).toEqual(['latin', 'latin-ext']);
    expect(validateFontSettings({ subsets: 'latin' }).subsets).toEqual(['latin', 'latin-ext']);
  });

  it('never returns the shared default subsets array', () => {
    expect(validateFontSettings(undefined).subsets).not.toBe(defaultFontSettings.subsets);
  });
});
```

`src/fonts/css.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_FONT_STACK, fontCssVars, fontStack } from './css';
import { defaultFontSettings } from '@/settings/font';

describe('font CSS variables', () => {
  it('maps the font settings to the viewer variables', () => {
    expect(
      fontCssVars({ ...defaultFontSettings, family: 'JetBrains Mono', sizePx: 15, lineHeight: 1.6, weight: 500, ligatures: false }),
    ).toEqual({
      '--jv-font-family': `"JetBrains Mono", ${DEFAULT_FONT_STACK}`,
      '--jv-font-size': '15px',
      '--jv-line-height': '1.6',
      '--jv-font-weight': '500',
      '--jv-font-ligatures': 'none',
    });
  });

  it('uses the default stack without a family', () => {
    expect(fontCssVars(defaultFontSettings)['--jv-font-family']).toBe(DEFAULT_FONT_STACK);
    expect(fontCssVars(defaultFontSettings)['--jv-font-ligatures']).toBe('normal');
  });

  it('strips quotes and backslashes defensively', () => {
    expect(fontStack('a"b\\c')).toBe(`"abc", ${DEFAULT_FONT_STACK}`);
    expect(fontStack('  ')).toBe(DEFAULT_FONT_STACK);
  });
});
```

In `src/settings/schema.test.ts`:
- Add `import { defaultFontSettings } from './font';`.
- Update three existing expectations, because `Settings` gains a `font` field. These are the only test changes this plan makes:
  - In `'defaults to auto mode with Light+ and Dark+'`, the expected object gains `font: defaultFontSettings,`.
  - In `'keeps valid values'`, the `input` object gains `font: { ...defaultFontSettings, source: 'google', family: 'JetBrains Mono' },`.
  - In `'replaces each invalid field with its default and keeps the rest'`, the expected object gains `font: defaultFontSettings,`.

In `src/components/JsonViewer.test.ts`:
- Add `import { defaultFontSettings, type FontSettings } from '@/settings/font';`.
- Add `font?: FontSettings` to the `mount` props type.
- Add this test:

```ts
  it('applies the font settings as CSS variables on the root', () => {
    const host = mount({ font: { ...defaultFontSettings, family: 'Fira Code', sizePx: 17 } });
    const root = host.querySelector<HTMLElement>('.jv-root')!;
    expect(root.style.getPropertyValue('--jv-font-family')).toMatch(/^"Fira Code", /);
    expect(root.style.getPropertyValue('--jv-font-size')).toBe('17px');
  });
```

Run `pnpm vitest run src/settings src/fonts src/components`. Expected: FAIL (`./font` and `./css` modules missing; schema expectations lack `font`).

- [ ] **Step 2: Implement `src/settings/font.ts`**

```ts
import {
  bool,
  intInRange,
  numberInRange,
  oneOf,
  validateFields,
  type FieldValidator,
  type ObjectValidators,
} from './fields';

export type FontSource = 'google' | 'system';

export interface FontSettings {
  source: FontSource;
  /** Empty means the default monospace stack. */
  family: string;
  sizePx: number;
  lineHeight: number;
  ligatures: boolean;
  weight: number;
  /** Google Fonts character sets to download. */
  subsets: string[];
}

export const FONT_SIZE_MIN = 8;
export const FONT_SIZE_MAX = 32;
export const LINE_HEIGHT_MIN = 1;
export const LINE_HEIGHT_MAX = 3;
export const FONT_WEIGHTS = [300, 400, 500, 600] as const;
export const FONT_SUBSETS = ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext', 'greek', 'greek-ext', 'vietnamese'] as const;
/** Letters, digits, spaces, dots, dashes and underscores: safe to quote inside a CSS font-family. */
export const FONT_FAMILY_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,79}$/u;

export const defaultFontSettings: FontSettings = {
  source: 'system',
  family: '',
  sizePx: 13,
  lineHeight: 1.5,
  ligatures: true,
  weight: 400,
  subsets: ['latin', 'latin-ext'],
};

const family: FieldValidator<string> = (value, fallback) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed === '' || FONT_FAMILY_PATTERN.test(trimmed) ? trimmed : fallback;
};

const subsets: FieldValidator<string[]> = (value, fallback) => {
  const known = Array.isArray(value) ? FONT_SUBSETS.filter((subset) => value.includes(subset)) : [];
  return known.length > 0 ? known : [...fallback];
};

const fontValidators: ObjectValidators<FontSettings> = {
  source: oneOf<FontSource>(['google', 'system']),
  family,
  sizePx: intInRange(FONT_SIZE_MIN, FONT_SIZE_MAX),
  lineHeight: numberInRange(LINE_HEIGHT_MIN, LINE_HEIGHT_MAX, 2),
  ligatures: bool,
  weight: oneOf<number>(FONT_WEIGHTS),
  subsets,
};

export function validateFontSettings(input: unknown): FontSettings {
  return validateFields(input, defaultFontSettings, fontValidators);
}
```

- [ ] **Step 3: Add `font` to `Settings`**

In `src/settings/schema.ts`:
- Add `import { defaultFontSettings, validateFontSettings, type FontSettings } from './font';`.
- Add `font: FontSettings;` to `interface Settings`.
- Add `font: defaultFontSettings,` to `defaultSettings`.
- Add `font: (value) => validateFontSettings(value),` to `settingsValidators`.

- [ ] **Step 4: Implement `src/fonts/css.ts`**

```ts
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
```

- [ ] **Step 5: Wire the variables into the viewer**

`src/components/JsonViewer.vue`:
- Add `import { fontCssVars } from '@/fonts/css';` and `import type { FontSettings } from '@/settings/font';`.
- Add the prop `font?: FontSettings;` to `defineProps`, with `font: undefined` in `withDefaults`.
- Replace the `cssVars` computed with:

```ts
const cssVars = computed(() => ({
  ...toCssVars(resolveColors(props.theme)),
  ...(props.font ? fontCssVars(props.font) : {}),
}));
```

`src/components/viewer.css`:
- In `.jv-root`, keep the three existing `--jv-font-*` declarations and add after them:

```css
  --jv-font-weight: 400;
  --jv-font-ligatures: normal;
```

- In `.jv-raw`, add:

```css
  font-weight: var(--jv-font-weight);
  font-variant-ligatures: var(--jv-font-ligatures);
```

`src/editor/theme.ts`: in `.cm-scroller`, add after `lineHeight`:

```ts
        fontWeight: 'var(--jv-font-weight)',
        fontVariantLigatures: 'var(--jv-font-ligatures)',
```

`src/entrypoints/viewer.content/index.ts`: in the `h(JsonViewer, { ... })` props, add `font: state.settings.font,` after `options`.

`src/options/PreviewPane.vue`:
- Add `const viewerFont = computed(() => ({ ...props.settings.font }));` after `viewerOptions`.
- Pass `:font="viewerFont"` to `<JsonViewer>`.

- [ ] **Step 6: `NumberField` step and the Fonts section**

Replace `src/options/fields/NumberField.vue` with:

```vue
<script setup lang="ts">
const props = withDefaults(defineProps<{ label: string; min: number; max: number; step?: number; hint?: string }>(), {
  step: 1,
  hint: undefined,
});
const model = defineModel<number>({ required: true });

function onChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  const stepped = Number.isFinite(value) ? Number((Math.round(value / props.step) * props.step).toFixed(2)) : props.min;
  model.value = Math.min(props.max, Math.max(props.min, stepped));
  input.value = String(model.value);
}
</script>

<template>
  <label class="opt-field">
    <span class="opt-label">{{ label }}</span>
    <input type="number" :min="min" :max="max" :step="step" :value="model" @change="onChange" />
    <small v-if="hint" class="opt-hint">{{ hint }}</small>
  </label>
</template>
```

Create `src/options/sections/FontsSection.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import NumberField from '../fields/NumberField.vue';
import SelectField from '../fields/SelectField.vue';
import ToggleField from '../fields/ToggleField.vue';
import {
  FONT_FAMILY_PATTERN,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_WEIGHTS,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  type FontSettings,
} from '@/settings/font';

const props = defineProps<{ font: FontSettings }>();

const weightLabels: Record<number, string> = { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold' };
const weightOptions = FONT_WEIGHTS.map((weight) => ({ value: String(weight), label: `${weightLabels[weight]} (${weight})` }));
const weight = computed({
  get: () => String(props.font.weight),
  set: (value: string) => {
    props.font.weight = Number(value);
  },
});
const familyValid = computed(() => props.font.family === '' || FONT_FAMILY_PATTERN.test(props.font.family));
</script>

<template>
  <section id="fonts" class="opt-section">
    <h2>Fonts</h2>
    <label class="opt-field">
      <span class="opt-label">Font family</span>
      <input v-model.trim="font.family" type="text" spellcheck="false" placeholder="Default monospace font" />
      <small class="opt-hint">A font installed on this computer, e.g. Cascadia Code. Leave empty for the default.</small>
    </label>
    <p v-if="!familyValid" class="opt-errors" role="alert">Use letters, numbers, spaces, dots, dashes or underscores.</p>
    <NumberField v-model="font.sizePx" label="Font size (px)" :min="FONT_SIZE_MIN" :max="FONT_SIZE_MAX" />
    <NumberField v-model="font.lineHeight" label="Line height" :min="LINE_HEIGHT_MIN" :max="LINE_HEIGHT_MAX" :step="0.1" />
    <SelectField v-model="weight" label="Font weight" :options="weightOptions" />
    <ToggleField v-model="font.ligatures" label="Font ligatures" hint="Joins character pairs such as => in fonts that have them." />
  </section>
</template>
```

`src/entrypoints/options/App.vue`:
- Add `import FontsSection from '@/options/sections/FontsSection.vue';`.
- Add `<a href="#fonts">Fonts</a>` to the nav, after Appearance.
- Render `<FontsSection :font="settings.font" />` right after the `<ThemeEditor … />` element.

`src/options/sections/AdvancedSection.vue`: in the hint, replace the sentence that starts with "Variables:" with:

```html
      Variables: <code>--jv-key</code>, <code>--jv-string</code>, <code>--jv-background</code>… Font variables
      (<code>--jv-font-family</code>, <code>--jv-font-size</code>…) come from the Fonts section; add
      <code>!important</code> to override them here.
```

- [ ] **Step 7: Failing e2e, then green**

Append to `e2e/settings.spec.ts`:

```ts
test('applies the configured font settings', async ({ context, server }) => {
  await setStorage(context, 'sync', {
    settings: { font: { family: 'Courier New', sizePx: 18, lineHeight: 2, ligatures: false } },
  });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const scroller = page.locator(`${viewer} .cm-scroller`);
  await expect(scroller).toHaveCSS('font-size', '18px');
  await expect(scroller).toHaveCSS('line-height', '36px');
  await expect(scroller).toHaveCSS('font-variant-ligatures', 'none');
  expect(await scroller.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"Courier New", ui-monospace/);
});

test('ignores a stored font family that could break the stylesheet', async ({ context, server }) => {
  await setStorage(context, 'sync', { settings: { font: { family: '"; } .jv-root { display: none } x {' } } });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .jv-root`)).toBeVisible();
  const family = await page.locator(`${viewer} .cm-scroller`).evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).toMatch(/^ui-monospace/);
});
```

Append to `e2e/options.spec.ts`:

```ts
test('font settings update the preview and are saved', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByLabel('Font family').fill('Courier New');
  await options.getByLabel('Font size (px)').fill('20');
  await options.getByLabel('Font size (px)').press('Tab');
  const scroller = options.locator('.opt-preview .cm-scroller');
  await expect(scroller).toHaveCSS('font-size', '20px');
  await expect.poll(() => scroller.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"Courier New"/);
  await expect
    .poll(() => getStorage(context, 'sync', 'settings'))
    .toMatchObject({ font: { family: 'Courier New', sizePx: 20 } });
});
```

Run `pnpm test`, `pnpm compile` and `pnpm test:e2e`. Expected: all green. If vue-tsc rejects `v-model="weight"` or a string-union binding, apply ruling R-P1 (make `SelectField` generic over `T extends string`) instead of casting.

- [ ] **Step 8: Commit**

```bash
git add src e2e
git commit -m "feat(fonts): font settings with size, line height, weight and ligatures"
```

---

### Task 3: Google Fonts catalog, css2 parser and downloader

**Files:**
- Create: `src/fonts/types.ts`, `src/fonts/catalog.ts`, `src/fonts/base64.ts`, `src/fonts/base64.test.ts`, `src/fonts/css2.ts`, `src/fonts/css2.test.ts`, `src/fonts/download.ts`, `src/fonts/download.test.ts`, `src/fonts/__fixtures__/jetbrains-mono.css`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - Types: `StoredFontFace { weight: string; unicodeRange: string; subset: string; dataBase64: string }`, `StoredFont { family; faces: StoredFontFace[]; bytes: number; subsets: string[]; downloadedAt: string }`, `FontSummary { family; bytes; subsets; downloadedAt }`, `isStoredFont(value: unknown): value is StoredFont`
  - `FONT_CATALOG: readonly string[]` (20 families)
  - `bytesToBase64(bytes: Uint8Array): string`, `base64ToBytes(base64: string): Uint8Array`
  - `Css2Face`, `parseCss2(css: string): Css2Face[]`, `FontFile`, `selectFaces(faces, subsets): FontFile[]`
  - `type FetchLike = (url: string) => Promise<Response>`, `css2Url(family)`, `DOWNLOAD_WEIGHTS`, `MAX_FONT_BYTES`, `FontDownloadError`, `downloadFont(family, subsets, fetchImpl?): Promise<StoredFont>`

- [ ] **Step 1: Record the css2 fixture**

```bash
mkdir -p src/fonts/__fixtures__
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
curl -sf -A "$UA" 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap' -o src/fonts/__fixtures__/jetbrains-mono.css
grep -c '@font-face' src/fonts/__fixtures__/jetbrains-mono.css
```

Expected: `30` (6 subsets × 5 weights). If the count differs, report NEEDS_CONTEXT with the file's subset comments (`grep '^/\*' …`).

- [ ] **Step 2: Failing tests**

`src/fonts/base64.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from './base64';

describe('base64', () => {
  it('round-trips bytes, including large buffers', () => {
    expect(bytesToBase64(new Uint8Array([1, 2, 3]))).toBe('AQID');
    expect(base64ToBytes('AQID')).toEqual(new Uint8Array([1, 2, 3]));
    const big = new Uint8Array(200_000).map((_, i) => i % 256);
    expect(base64ToBytes(bytesToBase64(big))).toEqual(big);
  });
});
```

`src/fonts/css2.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCss2, selectFaces } from './css2';

const recorded = readFileSync(new URL('./__fixtures__/jetbrains-mono.css', import.meta.url), 'utf8');

const sample = `/* latin */
@font-face {
  font-family: 'Demo Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/demo/v1/regular.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131;
}
/* latin */
@font-face {
  font-family: 'Demo Mono';
  font-style: italic;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/demo/v1/italic.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
/* latin */
@font-face {
  font-family: 'Demo Mono';
  font-style: normal;
  font-weight: 700;
  src: url(https://fonts.gstatic.com/s/demo/v1/bold.ttf) format('truetype');
}
/* latin */
@font-face {
  font-family: 'Demo Mono';
  font-style: normal;
  font-weight: 700;
  src: url(https://example.com/evil.woff2) format('woff2');
}
@font-face {
  font-family: 'Demo Mono';
  font-style: normal;
  font-weight: 500;
  src: url(https://fonts.gstatic.com/s/demo/v1/nocomment.woff2) format('woff2');
}`;

describe('parseCss2', () => {
  it('parses a recorded Google Fonts response', () => {
    const faces = parseCss2(recorded);
    expect(faces).toHaveLength(30);
    expect(new Set(faces.map((face) => face.subset))).toEqual(
      new Set(['cyrillic', 'cyrillic-ext', 'greek', 'latin', 'latin-ext', 'vietnamese']),
    );
    expect(new Set(faces.map((face) => face.weight))).toEqual(new Set([300, 400, 500, 600, 700]));
    for (const face of faces) {
      expect(face.family).toBe('JetBrains Mono');
      expect(face.url).toMatch(/^https:\/\/fonts\.gstatic\.com\/.+\.woff2$/);
      expect(face.unicodeRange).not.toBe('');
    }
  });

  it('keeps only gstatic woff2 faces that carry a subset comment', () => {
    expect(parseCss2(sample)).toEqual([
      {
        subset: 'latin',
        family: 'Demo Mono',
        weight: 400,
        style: 'normal',
        unicodeRange: 'U+0000-00FF, U+0131',
        url: 'https://fonts.gstatic.com/s/demo/v1/regular.woff2',
      },
      {
        subset: 'latin',
        family: 'Demo Mono',
        weight: 400,
        style: 'italic',
        unicodeRange: 'U+0000-00FF',
        url: 'https://fonts.gstatic.com/s/demo/v1/italic.woff2',
      },
    ]);
  });
});

describe('selectFaces', () => {
  it('keeps the requested subsets and normal style only', () => {
    expect(selectFaces(parseCss2(sample), ['latin'])).toEqual([
      {
        subset: 'latin',
        weight: '400',
        unicodeRange: 'U+0000-00FF, U+0131',
        url: 'https://fonts.gstatic.com/s/demo/v1/regular.woff2',
      },
    ]);
    expect(selectFaces(parseCss2(sample), ['greek'])).toEqual([]);
  });

  it('merges the weights of a variable font into one face per file', () => {
    const files = selectFaces(parseCss2(recorded), ['latin', 'latin-ext']);
    expect(files.map((file) => `${file.subset} ${file.weight}`).sort()).toEqual(['latin 300 700', 'latin-ext 300 700']);
  });
});
```

`src/fonts/download.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { css2Url, downloadFont, FontDownloadError, MAX_FONT_BYTES } from './download';

const CSS = `/* latin */
@font-face { font-family: 'Demo Mono'; font-style: normal; font-weight: 300; src: url(https://fonts.gstatic.com/s/demo/v1/var-latin.woff2) format('woff2'); unicode-range: U+0000-00FF; }
/* latin */
@font-face { font-family: 'Demo Mono'; font-style: normal; font-weight: 700; src: url(https://fonts.gstatic.com/s/demo/v1/var-latin.woff2) format('woff2'); unicode-range: U+0000-00FF; }
/* cyrillic */
@font-face { font-family: 'Demo Mono'; font-style: normal; font-weight: 400; src: url(https://fonts.gstatic.com/s/demo/v1/cyr.woff2) format('woff2'); unicode-range: U+0400-045F; }`;

const LATIN_FILE = 'https://fonts.gstatic.com/s/demo/v1/var-latin.woff2';

function fakeFetch(routes: Record<string, () => Response>) {
  return vi.fn(async (url: string) => {
    const route = routes[url];
    if (!route) throw new TypeError('Failed to fetch');
    return route();
  });
}

describe('downloadFont', () => {
  it('builds the css2 URL for every supported weight', () => {
    expect(css2Url('JetBrains Mono')).toBe(
      'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap',
    );
  });

  it('downloads each file once and stores the faces as base64', async () => {
    const fetchImpl = fakeFetch({
      [css2Url('Demo Mono')]: () => new Response(CSS),
      [LATIN_FILE]: () => new Response(new Uint8Array([1, 2, 3])),
    });
    const font = await downloadFont('Demo Mono', ['latin'], fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(font).toMatchObject({
      family: 'Demo Mono',
      bytes: 3,
      subsets: ['latin'],
      faces: [{ weight: '300 700', unicodeRange: 'U+0000-00FF', subset: 'latin', dataBase64: 'AQID' }],
    });
    expect(Number.isNaN(Date.parse(font.downloadedAt))).toBe(false);
  });

  it('reports an unknown family', async () => {
    const fetchImpl = fakeFetch({ [css2Url('Nope')]: () => new Response('bad', { status: 400 }) });
    await expect(downloadFont('Nope', ['latin'], fetchImpl)).rejects.toThrow('"Nope" is not a Google Fonts family.');
  });

  it('reports when no file matches the selected character sets', async () => {
    const fetchImpl = fakeFetch({ [css2Url('Demo Mono')]: () => new Response(CSS) });
    await expect(downloadFont('Demo Mono', ['greek'], fetchImpl)).rejects.toThrow(
      '"Demo Mono" has no files for the selected character sets.',
    );
  });

  it('reports network failures as download errors', async () => {
    await expect(downloadFont('Demo Mono', ['latin'], fakeFetch({}))).rejects.toBeInstanceOf(FontDownloadError);
    await expect(downloadFont('Demo Mono', ['latin'], fakeFetch({}))).rejects.toThrow('Could not reach Google Fonts');
  });

  it('reports a failed file download', async () => {
    const fetchImpl = fakeFetch({
      [css2Url('Demo Mono')]: () => new Response(CSS),
      [LATIN_FILE]: () => new Response('', { status: 404 }),
    });
    await expect(downloadFont('Demo Mono', ['latin'], fetchImpl)).rejects.toThrow('Font file download failed (404).');
  });

  it('refuses fonts over the size limit', async () => {
    const fetchImpl = fakeFetch({
      [css2Url('Demo Mono')]: () => new Response(CSS),
      [LATIN_FILE]: () => new Response(new Uint8Array(MAX_FONT_BYTES + 1)),
    });
    await expect(downloadFont('Demo Mono', ['latin'], fetchImpl)).rejects.toThrow('larger than 2 MB');
  });
});
```

Run `pnpm vitest run src/fonts`. Expected: FAIL (modules missing).

- [ ] **Step 3: Implement `types.ts`, `catalog.ts` and `base64.ts`**

`src/fonts/types.ts`:

```ts
import { isRecord } from '@/shared/guards';

export interface StoredFontFace {
  /** A single weight ("400") or a range for variable fonts ("300 700"). */
  weight: string;
  /** Empty when the face covers every character. */
  unicodeRange: string;
  subset: string;
  dataBase64: string;
}

export interface StoredFont {
  family: string;
  faces: StoredFontFace[];
  /** Downloaded file bytes (before base64). */
  bytes: number;
  subsets: string[];
  downloadedAt: string;
}

export type FontSummary = Omit<StoredFont, 'faces'>;

const isString = (value: unknown): value is string => typeof value === 'string';

function isStoredFace(value: unknown): value is StoredFontFace {
  return (
    isRecord(value) &&
    isString(value.weight) &&
    isString(value.unicodeRange) &&
    isString(value.subset) &&
    isString(value.dataBase64)
  );
}

export function isStoredFont(value: unknown): value is StoredFont {
  return (
    isRecord(value) &&
    isString(value.family) &&
    Array.isArray(value.faces) &&
    value.faces.every(isStoredFace) &&
    typeof value.bytes === 'number' &&
    Array.isArray(value.subsets) &&
    value.subsets.every(isString) &&
    isString(value.downloadedAt)
  );
}
```

`src/fonts/catalog.ts`:

```ts
/** Monospaced Google Fonts families offered as suggestions (all verified on fonts.googleapis.com, 2026-10-12). */
export const FONT_CATALOG: readonly string[] = [
  'JetBrains Mono',
  'Fira Code',
  'Source Code Pro',
  'IBM Plex Mono',
  'Roboto Mono',
  'Ubuntu Mono',
  'Inconsolata',
  'Space Mono',
  'Red Hat Mono',
  'DM Mono',
  'Geist Mono',
  'Martian Mono',
  'Victor Mono',
  'Cascadia Code',
  'Noto Sans Mono',
  'Azeret Mono',
  'Sometype Mono',
  'Fragment Mono',
  'Spline Sans Mono',
  'Reddit Mono',
];
```

`src/fonts/base64.ts`:

```ts
// Chunked so String.fromCharCode never receives more arguments than the engine allows.
const CHUNK = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
```

- [ ] **Step 4: Implement `css2.ts`**

```ts
export interface Css2Face {
  /** From the comment Google puts before each block, e.g. "latin-ext". */
  subset: string;
  family: string;
  weight: number;
  style: string;
  unicodeRange: string;
  url: string;
}

export interface FontFile {
  subset: string;
  weight: string;
  unicodeRange: string;
  url: string;
}

const BLOCK = /\/\*\s*([^*]+?)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
const WOFF2_SOURCE = /url\((https:\/\/fonts\.gstatic\.com\/[^)\s]+\.woff2)\)\s*format\(['"]woff2['"]\)/;

function descriptor(body: string, name: string): string | null {
  const match = new RegExp(`(?:^|[;{\\s])${name}\\s*:\\s*([^;]+);`).exec(body);
  return match ? match[1]!.trim() : null;
}

/** Parses a Google Fonts css2 response. Blocks without a subset comment or a gstatic woff2 source are skipped. */
export function parseCss2(css: string): Css2Face[] {
  const faces: Css2Face[] = [];
  for (const [, subset, body] of css.matchAll(BLOCK)) {
    const url = WOFF2_SOURCE.exec(descriptor(body!, 'src') ?? '')?.[1];
    const family = descriptor(body!, 'font-family')?.replace(/^['"]|['"]$/g, '');
    const weight = Number(descriptor(body!, 'font-weight'));
    if (!url || !family || !Number.isFinite(weight)) continue;
    faces.push({
      subset: subset!,
      family,
      weight,
      style: descriptor(body!, 'font-style') ?? 'normal',
      unicodeRange: descriptor(body!, 'unicode-range') ?? '',
      url,
    });
  }
  return faces;
}

/** Keeps the requested subsets in normal style; weights sharing one file (variable fonts) become a range. */
export function selectFaces(faces: Css2Face[], subsets: readonly string[]): FontFile[] {
  const groups = new Map<string, { face: Css2Face; weights: number[] }>();
  for (const face of faces) {
    if (face.style !== 'normal' || !subsets.includes(face.subset)) continue;
    const key = `${face.url} ${face.unicodeRange}`;
    const group = groups.get(key);
    if (group) group.weights.push(face.weight);
    else groups.set(key, { face, weights: [face.weight] });
  }
  return [...groups.values()].map(({ face, weights }) => {
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    return {
      subset: face.subset,
      weight: min === max ? String(min) : `${min} ${max}`,
      unicodeRange: face.unicodeRange,
      url: face.url,
    };
  });
}
```

- [ ] **Step 5: Implement `download.ts`**

```ts
import { bytesToBase64 } from './base64';
import { parseCss2, selectFaces } from './css2';
import type { StoredFont, StoredFontFace } from './types';

export type FetchLike = (url: string) => Promise<Response>;

export const GOOGLE_FONTS_CSS_URL = 'https://fonts.googleapis.com/css2';
/** Google silently leaves out the weights a family doesn't have. */
export const DOWNLOAD_WEIGHTS = [300, 400, 500, 600, 700];
/** Per family; storage.local holds about 10 MB in total. */
export const MAX_FONT_BYTES = 2 * 1024 * 1024;

export class FontDownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FontDownloadError';
  }
}

export function css2Url(family: string): string {
  const name = encodeURIComponent(family.trim()).replace(/%20/g, '+');
  return `${GOOGLE_FONTS_CSS_URL}?family=${name}:wght@${DOWNLOAD_WEIGHTS.join(';')}&display=swap`;
}

async function request(fetchImpl: FetchLike, url: string): Promise<Response> {
  try {
    return await fetchImpl(url);
  } catch {
    throw new FontDownloadError('Could not reach Google Fonts. Check your connection.');
  }
}

/** Downloads a Google Fonts family as base64 woff2 faces for the given character sets. */
export async function downloadFont(
  family: string,
  subsets: readonly string[],
  fetchImpl: FetchLike = (url) => fetch(url),
): Promise<StoredFont> {
  const response = await request(fetchImpl, css2Url(family));
  if (response.status === 400) throw new FontDownloadError(`"${family}" is not a Google Fonts family.`);
  if (!response.ok) throw new FontDownloadError(`Google Fonts answered ${response.status}.`);
  const parsed = parseCss2(await response.text());
  const files = selectFaces(parsed, subsets);
  if (files.length === 0) throw new FontDownloadError(`"${family}" has no files for the selected character sets.`);

  const data = new Map<string, string>();
  const faces: StoredFontFace[] = [];
  let bytes = 0;
  for (const file of files) {
    let base64 = data.get(file.url);
    if (base64 === undefined) {
      const fileResponse = await request(fetchImpl, file.url);
      if (!fileResponse.ok) throw new FontDownloadError(`Font file download failed (${fileResponse.status}).`);
      const buffer = new Uint8Array(await fileResponse.arrayBuffer());
      bytes += buffer.byteLength;
      if (bytes > MAX_FONT_BYTES) {
        throw new FontDownloadError(`"${family}" is larger than 2 MB; choose fewer character sets.`);
      }
      base64 = bytesToBase64(buffer);
      data.set(file.url, base64);
    }
    faces.push({ weight: file.weight, unicodeRange: file.unicodeRange, subset: file.subset, dataBase64: base64 });
  }
  return {
    family: parsed[0]!.family,
    faces,
    bytes,
    subsets: [...subsets],
    downloadedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 6: Verify**

Run `pnpm vitest run src/fonts`, then `pnpm test` and `pnpm compile`. Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/fonts
git commit -m "feat(fonts): parse and download Google Fonts css2 families"
```

---

### Task 4: Font store and FontFace loader

**Files:**
- Create: `src/fonts/store.ts`, `src/fonts/store.test.ts`, `src/fonts/loader.ts`, `src/fonts/loader.test.ts`

**Interfaces:**
- Consumes: `StoredFont`, `FontSummary`, `isStoredFont`, `base64ToBytes` (Task 3).
- Produces:
  - Store: `fontKey(family)`, `saveFont(font): Promise<void>`, `getFont(family): Promise<StoredFont | null>`, `deleteFont(family): Promise<void>`, `listFonts(): Promise<FontSummary[]>`, `watchFont(family, callback): () => void`, `watchFontIndex(callback): () => void`
  - Loader: `FontFaceTarget`, `FontFaceFactory`, `createFontLoader(target, factory?)` returning `{ apply(font: StoredFont | null): void }`, `type FontLoader`

- [ ] **Step 1: Failing tests**

`src/fonts/store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { deleteFont, getFont, listFonts, saveFont, watchFont, watchFontIndex } from './store';
import type { StoredFont } from './types';

const font = (family: string, bytes = 3): StoredFont => ({
  family,
  faces: [{ weight: '400', unicodeRange: '', subset: 'latin', dataBase64: 'AQID' }],
  bytes,
  subsets: ['latin'],
  downloadedAt: '2026-10-12T00:00:00.000Z',
});
const summary = (family: string, bytes = 3) => ({
  family,
  bytes,
  subsets: ['latin'],
  downloadedAt: '2026-10-12T00:00:00.000Z',
});

describe('font store', () => {
  beforeEach(() => fakeBrowser.reset());

  it('saves, lists and reads fonts by family in local storage', async () => {
    await saveFont(font('Fira Code', 10));
    await saveFont(font('JetBrains Mono', 20));
    expect(await listFonts()).toEqual([summary('Fira Code', 10), summary('JetBrains Mono', 20)]);
    expect(await getFont('Fira Code')).toEqual(font('Fira Code', 10));
    expect((await fakeBrowser.storage.local.get('fonts/Fira Code'))['fonts/Fira Code']).toEqual(font('Fira Code', 10));
    expect((await fakeBrowser.storage.local.get('fontFamilies')).fontFamilies).toEqual(['Fira Code', 'JetBrains Mono']);
  });

  it('replaces a font downloaded again without listing it twice', async () => {
    await saveFont(font('Fira Code', 10));
    await saveFont(font('Fira Code', 30));
    expect(await listFonts()).toEqual([summary('Fira Code', 30)]);
  });

  it('deletes fonts', async () => {
    await saveFont(font('Fira Code'));
    await deleteFont('Fira Code');
    expect(await getFont('Fira Code')).toBeNull();
    expect(await listFonts()).toEqual([]);
  });

  it('ignores missing, empty and corrupted entries', async () => {
    expect(await getFont('')).toBeNull();
    expect(await getFont('Nope')).toBeNull();
    await fakeBrowser.storage.local.set({ 'fonts/Bad': { family: 'Bad', faces: 'x' }, fontFamilies: ['Bad', 42] });
    expect(await getFont('Bad')).toBeNull();
    expect(await listFonts()).toEqual([]);
  });

  it('notifies watchers of one family and of the index', async () => {
    let family = 0;
    let index = 0;
    const stopFamily = watchFont('Fira Code', () => family++);
    const stopIndex = watchFontIndex(() => index++);
    await saveFont(font('Fira Code'));
    await saveFont(font('Other'));
    stopFamily();
    stopIndex();
    await saveFont(font('Fira Code', 99));
    expect(family).toBe(1);
    expect(index).toBe(2);
  });
});
```

`src/fonts/loader.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createFontLoader, type FontFaceFactory } from './loader';
import type { StoredFont } from './types';

const demo: StoredFont = {
  family: 'Demo Mono',
  faces: [
    { weight: '300 700', unicodeRange: 'U+0000-00FF', subset: 'latin', dataBase64: 'AQID' },
    { weight: '400', unicodeRange: '', subset: 'cyrillic', dataBase64: 'BAU=' },
  ],
  bytes: 5,
  subsets: ['latin', 'cyrillic'],
  downloadedAt: '2026-10-12T00:00:00.000Z',
};

function setup() {
  const registered = new Set<unknown>();
  const created: { family: string; data: Uint8Array; descriptors: FontFaceDescriptors }[] = [];
  const factory: FontFaceFactory = (family, data, descriptors) => {
    const face = { family, data, descriptors };
    created.push(face);
    return face as unknown as FontFace;
  };
  const target = {
    add: (face: FontFace) => registered.add(face),
    delete: (face: FontFace) => registered.delete(face),
  };
  return { registered, created, loader: createFontLoader(target, factory) };
}

describe('createFontLoader', () => {
  it('registers every face with its descriptors and decoded bytes', () => {
    const { registered, created, loader } = setup();
    loader.apply(demo);
    expect(registered.size).toBe(2);
    expect(created[0]).toEqual({
      family: 'Demo Mono',
      data: new Uint8Array([1, 2, 3]),
      descriptors: { weight: '300 700', style: 'normal', unicodeRange: 'U+0000-00FF' },
    });
    expect(created[1]).toEqual({ family: 'Demo Mono', data: new Uint8Array([4, 5]), descriptors: { weight: '400', style: 'normal' } });
  });

  it('replaces the previous font and clears with null', () => {
    const { registered, created, loader } = setup();
    loader.apply(demo);
    loader.apply({ ...demo, family: 'Other', faces: [demo.faces[0]!] });
    expect(registered.size).toBe(1);
    expect([...registered]).toEqual([created[2]]);
    loader.apply(null);
    expect(registered.size).toBe(0);
  });
});
```

Run `pnpm vitest run src/fonts/store.test.ts src/fonts/loader.test.ts`. Expected: FAIL (modules missing).

- [ ] **Step 2: Implement `store.ts`**

```ts
import { storage } from '#imports';
import { isStoredFont, type FontSummary, type StoredFont } from './types';

// Local, not sync: font files are far larger than sync's quotas.
const INDEX_KEY = 'local:fontFamilies';
export const fontKey = (family: string) => `local:fonts/${family}` as const;

async function readIndex(): Promise<string[]> {
  const families = await storage.getItem<unknown>(INDEX_KEY);
  return Array.isArray(families) ? families.filter((family): family is string => typeof family === 'string') : [];
}

export async function saveFont(font: StoredFont): Promise<void> {
  await storage.setItem(fontKey(font.family), font);
  const index = await readIndex();
  if (!index.includes(font.family)) await storage.setItem(INDEX_KEY, [...index, font.family]);
}

export async function getFont(family: string): Promise<StoredFont | null> {
  if (!family) return null;
  const value = await storage.getItem<unknown>(fontKey(family));
  return isStoredFont(value) ? value : null;
}

export async function deleteFont(family: string): Promise<void> {
  await storage.removeItem(fontKey(family));
  const index = await readIndex();
  if (index.includes(family)) await storage.setItem(INDEX_KEY, index.filter((name) => name !== family));
}

export async function listFonts(): Promise<FontSummary[]> {
  const families = await readIndex();
  if (families.length === 0) return [];
  const items = await storage.getItems(families.map(fontKey));
  return items.flatMap(({ value }) =>
    isStoredFont(value)
      ? [{ family: value.family, bytes: value.bytes, subsets: value.subsets, downloadedAt: value.downloadedAt }]
      : [],
  );
}

export function watchFont(family: string, callback: () => void): () => void {
  return storage.watch(fontKey(family), () => callback());
}

export function watchFontIndex(callback: () => void): () => void {
  return storage.watch(INDEX_KEY, () => callback());
}
```

- [ ] **Step 3: Implement `loader.ts`**

```ts
import { base64ToBytes } from './base64';
import type { StoredFont } from './types';

export interface FontFaceTarget {
  add(face: FontFace): unknown;
  delete(face: FontFace): unknown;
}

export type FontFaceFactory = (family: string, data: Uint8Array, descriptors: FontFaceDescriptors) => FontFace;

// Faces built from bytes aren't fetched, so the page's CSP (font-src) doesn't apply to them.
const createFace: FontFaceFactory = (family, data, descriptors) => {
  const face = new FontFace(family, data as Uint8Array<ArrayBuffer>, descriptors);
  face.loaded.catch((error: unknown) => console.warn('[json-viewer] font face failed to load', family, error));
  return face;
};

/** Registers one downloaded family at a time on a FontFaceSet (document.fonts), replacing the previous one. */
export function createFontLoader(target: FontFaceTarget, factory: FontFaceFactory = createFace) {
  let current: FontFace[] = [];
  return {
    apply(font: StoredFont | null): void {
      for (const face of current) target.delete(face);
      current = [];
      if (!font) return;
      for (const face of font.faces) {
        const descriptors: FontFaceDescriptors = { weight: face.weight, style: 'normal' };
        if (face.unicodeRange) descriptors.unicodeRange = face.unicodeRange;
        const fontFace = factory(font.family, base64ToBytes(face.dataBase64), descriptors);
        target.add(fontFace);
        current.push(fontFace);
      }
    },
  };
}

export type FontLoader = ReturnType<typeof createFontLoader>;
```

If `pnpm compile` rejects the `Uint8Array<ArrayBuffer>` cast (older TS lib typings), drop the type argument (`data as Uint8Array`) or pass `data.buffer as ArrayBuffer`. Pick the minimal change that compiles and document it.

- [ ] **Step 4: Verify**

Run `pnpm vitest run src/fonts`, then `pnpm test` and `pnpm compile`. Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/fonts
git commit -m "feat(fonts): store downloaded fonts locally and register them as FontFaces"
```

---

### Task 5: Load stored fonts in the viewer and the preview

**Files:**
- Create: `src/fonts/track.ts`, `src/fonts/track.test.ts`, `e2e/fonts.ts`, `e2e/fonts.spec.ts`, `e2e/assets/fonts/share-tech-mono.css`, `e2e/assets/fonts/share-tech-mono-latin-400.woff2`
- Modify: `src/entrypoints/viewer.content/index.ts`, `src/options/PreviewPane.vue`

**Interfaces:**
- Consumes: `getFont`, `watchFont`, `saveFont` (Task 4); `createFontLoader`, `FontLoader` (Task 4); `Settings.font` (Task 2); `setStorage`, `getStorage` (`e2e/storage.ts`).
- Produces:
  - `trackStoredFont(family: WatchSource<string>, loader: Pick<FontLoader, 'apply'>): () => void`
  - e2e helpers: `TEST_FONT = 'Share Tech Mono'`, `seedTestFont(context)`, `hasLoadedFace(page, family)`, `mockGoogleFonts(context)`

- [ ] **Step 1: Record the e2e font assets**

```bash
mkdir -p e2e/assets/fonts
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
curl -sf -A "$UA" 'https://fonts.googleapis.com/css2?family=Share+Tech+Mono:wght@300;400;500;600;700&display=swap' -o e2e/assets/fonts/share-tech-mono.css
curl -sf "$(grep -o 'https://fonts.gstatic.com/[^)]*\.woff2' e2e/assets/fonts/share-tech-mono.css | head -1)" -o e2e/assets/fonts/share-tech-mono-latin-400.woff2
grep -c '@font-face' e2e/assets/fonts/share-tech-mono.css; wc -c e2e/assets/fonts/share-tech-mono-latin-400.woff2
```

Expected: 1 face, about 13 KB. The font is licensed under the SIL OFL, so it may be redistributed as a test fixture.

- [ ] **Step 2: Failing unit test for the tracker**

`src/fonts/track.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { saveFont } from './store';
import { trackStoredFont } from './track';
import type { StoredFont } from './types';

const font = (family: string): StoredFont => ({
  family,
  faces: [{ weight: '400', unicodeRange: '', subset: 'latin', dataBase64: 'AQID' }],
  bytes: 3,
  subsets: ['latin'],
  downloadedAt: '2026-10-12T00:00:00.000Z',
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('trackStoredFont', () => {
  beforeEach(() => fakeBrowser.reset());

  it('applies the stored font for the family and follows changes', async () => {
    const applied: (string | null)[] = [];
    const loader = { apply: (stored: StoredFont | null) => void applied.push(stored?.family ?? null) };
    await saveFont(font('Fira Code'));
    const family = ref('Fira Code');
    const stop = trackStoredFont(family, loader);
    await settle();
    expect(applied).toEqual(['Fira Code']);

    family.value = '';
    await settle();
    expect(applied).toEqual(['Fira Code', null]);

    // Chosen on another device, not downloaded here yet.
    family.value = 'JetBrains Mono';
    await settle();
    expect(applied).toEqual(['Fira Code', null, null]);

    await saveFont(font('JetBrains Mono'));
    await settle();
    expect(applied).toEqual(['Fira Code', null, null, 'JetBrains Mono']);

    stop();
    family.value = 'Fira Code';
    await saveFont(font('JetBrains Mono'));
    await settle();
    expect(applied).toHaveLength(4);
  });
});
```

Run `pnpm vitest run src/fonts/track.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement `track.ts`**

```ts
import { watch, type WatchSource } from 'vue';
import type { FontLoader } from './loader';
import { getFont, watchFont } from './store';

/**
 * Keeps `loader` in sync with the downloaded font named by `family` (empty = none): reapplies when the
 * family changes or its stored files change (e.g. downloaded later from the options page).
 */
export function trackStoredFont(family: WatchSource<string>, loader: Pick<FontLoader, 'apply'>): () => void {
  let latest = 0;
  let stopItem: (() => void) | undefined;
  const load = (name: string) => {
    const request = ++latest;
    getFont(name)
      .then((font) => {
        if (request === latest) loader.apply(font);
      })
      .catch((error: unknown) => console.warn('[json-viewer] font load failed', error));
  };
  const stopWatch = watch(
    family,
    (name) => {
      stopItem?.();
      stopItem = name ? watchFont(name, () => load(name)) : undefined;
      load(name);
    },
    { immediate: true },
  );
  return () => {
    latest++;
    stopWatch();
    stopItem?.();
  };
}
```

Run the tracker test. Expected: PASS.

- [ ] **Step 4: Wire the tracker into the viewer and the preview**

`src/entrypoints/viewer.content/index.ts`:
- Add `import { createFontLoader } from '@/fonts/loader';` and `import { trackStoredFont } from '@/fonts/track';`.
- Add this entry to the `stops` array, before the media listener cleanup:

```ts
        // Faces go on the page's document.fonts, which the viewer's shadow root uses too.
        trackStoredFont(
          () => (state.settings.font.source === 'google' ? state.settings.font.family : ''),
          createFontLoader(document.fonts),
        ),
```

`src/options/PreviewPane.vue`:
- Add `import { createFontLoader } from '@/fonts/loader';` and `import { trackStoredFont } from '@/fonts/track';`.
- Declare `let stopFont: (() => void) | undefined;`.
- In `onMounted`, add:

```ts
  stopFont = trackStoredFont(
    () => (props.settings.font.source === 'google' ? props.settings.font.family : ''),
    createFontLoader(document.fonts),
  );
```

- Make `onBeforeUnmount` also call `stopFont?.()`.

- [ ] **Step 5: e2e helpers and tests**

`e2e/fonts.ts`:

```ts
import { readFile } from 'node:fs/promises';
import type { BrowserContext, Page } from '@playwright/test';
import { setStorage } from './storage';

export const TEST_FONT = 'Share Tech Mono';
const ASSETS = 'e2e/assets/fonts';

/** Stores the test font as if it had been downloaded from the options page. */
export async function seedTestFont(context: BrowserContext): Promise<void> {
  const data = await readFile(`${ASSETS}/share-tech-mono-latin-400.woff2`);
  await setStorage(context, 'local', {
    [`fonts/${TEST_FONT}`]: {
      family: TEST_FONT,
      faces: [{ weight: '400', unicodeRange: '', subset: 'latin', dataBase64: data.toString('base64') }],
      bytes: data.byteLength,
      subsets: ['latin'],
      downloadedAt: '2026-10-12T00:00:00.000Z',
    },
    fontFamilies: [TEST_FONT],
  });
}

/** True once document.fonts holds a loaded face for the family (content scripts share the page's FontFaceSet). */
export function hasLoadedFace(page: Page, family: string): Promise<boolean> {
  return page.evaluate((name) => {
    let found = false;
    document.fonts.forEach((face) => {
      if (face.family.replace(/["']/g, '') === name && face.status === 'loaded') found = true;
    });
    return found;
  }, family);
}

/** Serves the recorded Share Tech Mono css2 response and file; any other family answers 400 like Google does. */
export async function mockGoogleFonts(context: BrowserContext): Promise<void> {
  const css = await readFile(`${ASSETS}/share-tech-mono.css`, 'utf8');
  const woff2 = await readFile(`${ASSETS}/share-tech-mono-latin-400.woff2`);
  const cors = { 'access-control-allow-origin': '*' };
  await context.route('https://fonts.googleapis.com/css2**', (route) => {
    const family = new URL(route.request().url()).searchParams.get('family') ?? '';
    return family.startsWith(`${TEST_FONT}:`)
      ? route.fulfill({ status: 200, contentType: 'text/css', headers: cors, body: css })
      : route.fulfill({ status: 400, contentType: 'text/html', headers: cors, body: 'Bad Request' });
  });
  await context.route('https://fonts.gstatic.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'font/woff2', headers: cors, body: woff2 }),
  );
}
```

`e2e/fonts.spec.ts`:

```ts
import { expect, test } from './fixtures';
import { hasLoadedFace, seedTestFont, TEST_FONT } from './fonts';
import { setStorage } from './storage';

const viewer = 'json-viewer-app';
const googleFont = { settings: { font: { source: 'google', family: TEST_FONT } } };

test('renders with a downloaded Google font under a strict CSP', async ({ context }) => {
  await seedTestFont(context);
  await setStorage(context, 'sync', googleFont);
  const page = await context.newPage();
  await page.route('http://csp.test/data.json', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json', 'content-security-policy': "default-src 'none'" },
      body: '{"name":"x","list":[1,2,3]}',
    }),
  );
  await page.goto('http://csp.test/data.json');
  await expect(page.locator(`${viewer} .cm-line`).first()).toBeVisible();
  await expect.poll(() => hasLoadedFace(page, TEST_FONT)).toBe(true);
  const family = await page.locator(`${viewer} .cm-scroller`).evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).toMatch(/^"Share Tech Mono"/);
});

test('picks up a font downloaded while the tab is open', async ({ context, server }) => {
  await setStorage(context, 'sync', googleFont);
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .cm-line`).first()).toBeVisible();
  expect(await hasLoadedFace(page, TEST_FONT)).toBe(false);
  await seedTestFont(context);
  await expect.poll(() => hasLoadedFace(page, TEST_FONT)).toBe(true);
});

test('switching to the Google source loads the stored font live', async ({ context, server }) => {
  await seedTestFont(context);
  await setStorage(context, 'sync', { settings: { font: { source: 'system', family: TEST_FONT } } });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .cm-line`).first()).toBeVisible();
  expect(await hasLoadedFace(page, TEST_FONT)).toBe(false);
  await setStorage(context, 'sync', googleFont);
  await expect.poll(() => hasLoadedFace(page, TEST_FONT)).toBe(true);
});

test('the options preview uses a downloaded font', async ({ context, extensionId }) => {
  await seedTestFont(context);
  await setStorage(context, 'sync', googleFont);
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(options.locator('.opt-preview .cm-line').first()).toBeVisible();
  await expect.poll(() => hasLoadedFace(options, TEST_FONT)).toBe(true);
});
```

(`mockGoogleFonts` is used by Task 6.)

Run `pnpm test`, `pnpm compile` and `pnpm test:e2e`. Expected: all green. Check that the viewer bundle stays ASCII-only: `node -e "const b=require('fs').readFileSync('.output/chrome-mv3/content-scripts/viewer.js');console.log([...b].filter(x=>x>127).length)"` must print `0`. If `hasLoadedFace` never sees faces registered by the content script, don't weaken the test: report NEEDS_CONTEXT with the output of `page.evaluate(() => document.fonts.size)`.

- [ ] **Step 6: Commit**

```bash
git add src e2e
git commit -m "feat(fonts): load downloaded fonts in the viewer and the options preview"
```

---

### Task 6: Download and manage Google Fonts from the options page

**Files:**
- Create: `src/options/useFonts.ts`
- Modify: `src/options/sections/FontsSection.vue`, `src/options/options.css`, `e2e/fonts.spec.ts`

**Interfaces:**
- Consumes: `downloadFont`, `FontDownloadError` (Task 3); `saveFont`, `deleteFont`, `listFonts`, `watchFontIndex` (Task 4); `FONT_CATALOG` (Task 3); `FontSettings`, `FONT_SUBSETS`, `FONT_FAMILY_PATTERN` and the size constants (Task 2); `mockGoogleFonts`, `TEST_FONT`, `hasLoadedFace` (Task 5).
- Produces:
  - `useFonts(): { fonts: Ref<FontSummary[]>; busy: Ref<boolean>; error: Ref<string>; download(family, subsets): Promise<StoredFont | null>; remove(family): Promise<void> }`
  - UI: labels `Font source`, `Font family`, fieldset legend `Character sets to download`; button `Download` / `Download again`; status texts `Downloaded (<n> KB)` / `Not downloaded yet` (`role="status"`); delete buttons `Delete <family>`; `<datalist id="font-catalog">`

- [ ] **Step 1: Failing e2e**

Append to `e2e/fonts.spec.ts`, and update its imports to:

```ts
import type { BrowserContext } from '@playwright/test';
import { expect, test } from './fixtures';
import { hasLoadedFace, mockGoogleFonts, seedTestFont, TEST_FONT } from './fonts';
import { getStorage, setStorage } from './storage';
```

The Fonts-section assertions are scoped to `#fonts`, because other sections may also render status or alert regions:

```ts
async function openFonts(context: BrowserContext, extensionId: string) {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(options.getByRole('heading', { name: 'Fonts' })).toBeVisible();
  return { options, fonts: options.locator('#fonts') };
}

test('downloads a Google font; the preview and open viewers use it', async ({ context, server, extensionId }) => {
  await mockGoogleFonts(context);
  const viewerPage = await context.newPage();
  await viewerPage.goto(server.url('/data.json'));
  const { options, fonts } = await openFonts(context, extensionId);
  await fonts.getByLabel('Font source').selectOption('google');
  await fonts.getByLabel('Font family').fill(TEST_FONT);
  await fonts.getByRole('button', { name: 'Download' }).click();
  await expect(fonts.getByRole('status')).toHaveText(/^Downloaded \(\d+ KB\)$/);
  await expect(fonts.getByRole('button', { name: `Delete ${TEST_FONT}` })).toBeVisible();
  await expect.poll(() => hasLoadedFace(options, TEST_FONT)).toBe(true);
  await expect
    .poll(() => getStorage(context, 'local', `fonts/${TEST_FONT}`))
    .toMatchObject({ family: TEST_FONT, subsets: ['latin', 'latin-ext'] });
  await expect.poll(() => hasLoadedFace(viewerPage, TEST_FONT)).toBe(true);
});

test('shows an error for an unknown Google font and saves nothing', async ({ context, extensionId }) => {
  await mockGoogleFonts(context);
  const { fonts } = await openFonts(context, extensionId);
  await fonts.getByLabel('Font source').selectOption('google');
  await fonts.getByLabel('Font family').fill('Nope Font');
  await fonts.getByRole('button', { name: 'Download' }).click();
  await expect(fonts.getByRole('alert')).toHaveText('"Nope Font" is not a Google Fonts family.');
  expect(await getStorage(context, 'local', 'fontFamilies')).toBeUndefined();
});

test('says when the chosen Google font is not downloaded on this device', async ({ context, extensionId }) => {
  await setStorage(context, 'sync', googleFont);
  const { fonts } = await openFonts(context, extensionId);
  await expect(fonts.getByRole('status')).toHaveText('Not downloaded yet');
  await expect(fonts.getByRole('button', { name: 'Download' })).toBeEnabled();
});

test('deletes a downloaded font', async ({ context, extensionId }) => {
  await seedTestFont(context);
  const { options, fonts } = await openFonts(context, extensionId);
  options.on('dialog', (dialog) => void dialog.accept());
  await fonts.getByRole('button', { name: `Delete ${TEST_FONT}` }).click();
  await expect(fonts.getByRole('button', { name: `Delete ${TEST_FONT}` })).toHaveCount(0);
  await expect.poll(() => getStorage(context, 'local', `fonts/${TEST_FONT}`)).toBeUndefined();
});

test('suggests the catalog families for Google Fonts', async ({ context, extensionId }) => {
  const { options } = await openFonts(context, extensionId);
  await expect(options.locator('#font-catalog option')).toHaveCount(20);
});
```

Run `pnpm test:e2e`. Expected: the five new tests FAIL (no Font source / Download controls yet).

- [ ] **Step 2: Implement `src/options/useFonts.ts`**

```ts
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { downloadFont, FontDownloadError } from '@/fonts/download';
import { deleteFont, listFonts, saveFont, watchFontIndex } from '@/fonts/store';
import type { FontSummary, StoredFont } from '@/fonts/types';

export interface FontsModel {
  fonts: Ref<FontSummary[]>;
  busy: Ref<boolean>;
  error: Ref<string>;
  download(family: string, subsets: readonly string[]): Promise<StoredFont | null>;
  remove(family: string): Promise<void>;
}

const describe = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

export function useFonts(): FontsModel {
  const fonts = ref<FontSummary[]>([]);
  const busy = ref(false);
  const error = ref('');
  const reload = async () => {
    fonts.value = await listFonts();
  };
  let stop: (() => void) | undefined;
  onMounted(() => {
    void reload();
    stop = watchFontIndex(() => void reload());
  });
  onBeforeUnmount(() => stop?.());

  return {
    fonts,
    busy,
    error,
    async download(family, subsets) {
      error.value = '';
      busy.value = true;
      try {
        const font = await downloadFont(family, subsets);
        await saveFont(font);
        await reload();
        return font;
      } catch (cause) {
        // Storage errors (e.g. the 10 MB local quota) are not download errors but still need a message.
        error.value = cause instanceof FontDownloadError ? cause.message : `Could not save the font: ${describe(cause)}`;
        return null;
      } finally {
        busy.value = false;
      }
    },
    async remove(family) {
      error.value = '';
      try {
        await deleteFont(family);
        await reload();
      } catch (cause) {
        error.value = `Could not delete the font: ${describe(cause)}`;
      }
    },
  };
}
```

- [ ] **Step 3: Replace `FontsSection.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import NumberField from '../fields/NumberField.vue';
import SelectField from '../fields/SelectField.vue';
import ToggleField from '../fields/ToggleField.vue';
import { useFonts } from '../useFonts';
import { FONT_CATALOG } from '@/fonts/catalog';
import {
  FONT_FAMILY_PATTERN,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_SUBSETS,
  FONT_WEIGHTS,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_MIN,
  type FontSettings,
} from '@/settings/font';

const props = defineProps<{ font: FontSettings }>();
const { fonts, busy, error, download, remove } = useFonts();

const sourceOptions = [
  { value: 'system', label: 'Installed on this computer' },
  { value: 'google', label: 'Google Fonts (downloaded once, then works offline)' },
];
const weightLabels: Record<number, string> = { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold' };
const weightOptions = FONT_WEIGHTS.map((weight) => ({ value: String(weight), label: `${weightLabels[weight]} (${weight})` }));
const weight = computed({
  get: () => String(props.font.weight),
  set: (value: string) => {
    props.font.weight = Number(value);
  },
});

const isGoogle = computed(() => props.font.source === 'google');
const familyValid = computed(() => props.font.family === '' || FONT_FAMILY_PATTERN.test(props.font.family));
const downloaded = computed(() => fonts.value.find((item) => item.family === props.font.family) ?? null);
const canDownload = computed(
  () => props.font.family !== '' && familyValid.value && props.font.subsets.length > 0 && !busy.value,
);
const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`;

async function onDownload(): Promise<void> {
  const font = await download(props.font.family, props.font.subsets);
  // Google's spelling of the name is the key the viewer looks up.
  if (font) props.font.family = font.family;
}

async function onDelete(family: string): Promise<void> {
  if (window.confirm(`Delete the downloaded font "${family}"?`)) await remove(family);
}
</script>

<template>
  <section id="fonts" class="opt-section">
    <h2>Fonts</h2>
    <SelectField v-model="font.source" label="Font source" :options="sourceOptions" />
    <label class="opt-field">
      <span class="opt-label">Font family</span>
      <input
        v-model.trim="font.family"
        type="text"
        spellcheck="false"
        :list="isGoogle ? 'font-catalog' : undefined"
        :placeholder="isGoogle ? 'e.g. JetBrains Mono' : 'Default monospace font'"
      />
      <small class="opt-hint">{{
        isGoogle
          ? 'Pick a suggestion or type any Google Fonts family.'
          : 'A font installed on this computer, e.g. Cascadia Code. Leave empty for the default.'
      }}</small>
    </label>
    <datalist id="font-catalog">
      <option v-for="family in FONT_CATALOG" :key="family" :value="family" />
    </datalist>
    <p v-if="!familyValid" class="opt-errors" role="alert">Use letters, numbers, spaces, dots, dashes or underscores.</p>
    <template v-if="isGoogle">
      <fieldset class="opt-field opt-subsets">
        <legend class="opt-label">Character sets to download</legend>
        <label v-for="subset in FONT_SUBSETS" :key="subset" class="opt-subset">
          <input v-model="font.subsets" type="checkbox" :value="subset" />
          {{ subset }}
        </label>
      </fieldset>
      <div class="opt-row">
        <button type="button" :disabled="!canDownload" @click="onDownload">
          {{ busy ? 'Downloading…' : downloaded ? 'Download again' : 'Download' }}
        </button>
        <span class="opt-hint" role="status">{{
          downloaded ? `Downloaded (${kb(downloaded.bytes)})` : font.family ? 'Not downloaded yet' : ''
        }}</span>
      </div>
      <p v-if="error" class="opt-errors" role="alert">{{ error }}</p>
    </template>
    <NumberField v-model="font.sizePx" label="Font size (px)" :min="FONT_SIZE_MIN" :max="FONT_SIZE_MAX" />
    <NumberField v-model="font.lineHeight" label="Line height" :min="LINE_HEIGHT_MIN" :max="LINE_HEIGHT_MAX" :step="0.1" />
    <SelectField v-model="weight" label="Font weight" :options="weightOptions" />
    <ToggleField v-model="font.ligatures" label="Font ligatures" hint="Joins character pairs such as => in fonts that have them." />
    <h3 class="opt-subheading">Downloaded fonts</h3>
    <p v-if="fonts.length === 0" class="opt-hint">None yet.</p>
    <ul v-else class="opt-font-list">
      <li v-for="item in fonts" :key="item.family">
        <span>{{ item.family }} · {{ kb(item.bytes) }}</span>
        <button type="button" :aria-label="`Delete ${item.family}`" @click="onDelete(item.family)">Delete</button>
      </li>
    </ul>
  </section>
</template>
```

If vue-tsc rejects `v-model="font.source"` (string model bound to `FontSource`), apply ruling R-P1: make `SelectField` generic over `T extends string`.

- [ ] **Step 4: Styles**

Append to `src/options/options.css`:

```css
.opt-subsets {
  border: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
}

.opt-subsets legend {
  margin-bottom: 4px;
}

.opt-subset {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.opt-subheading {
  margin: 16px 0 8px;
  font-size: 0.95em;
}

.opt-font-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.opt-font-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
```

- [ ] **Step 5: Verify**

Run `pnpm test`, `pnpm compile` and `pnpm test:e2e`. Expected: all green, including the earlier `font settings update the preview and are saved` test, since the `Font family` label is unchanged. Also check `pnpm build`:
- no chunk warning above 500 kB;
- the manifest permissions are still exactly `["storage","scripting"]` (`node -e "console.log(require('./.output/chrome-mv3/manifest.json').permissions)"`);
- no `host_permissions` key.

If Playwright's `context.route` does not intercept fetches made by the `chrome-extension://` options page, don't call the real Google Fonts from tests. Report NEEDS_CONTEXT with the failing output.

- [ ] **Step 6: Commit**

```bash
git add src e2e
git commit -m "feat(options): download, list and delete Google Fonts"
```

---

### Task 7: Documentation

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-10-11-json-viewer-design.md`, `docs/notes/pendientes-fase-2.md`

- [ ] **Step 1: README**

In the "Configuración" section, after the **Apariencia** bullet, add:

```markdown
- **Fuentes:** una fuente instalada en el equipo o cualquier familia de Google Fonts (con sugerencias de fuentes
  monoespaciadas). Las de Google se descargan una vez desde las opciones y luego funcionan sin conexión, incluso en
  páginas con CSP estricta. Tamaño, interlineado, grosor y ligaduras.
```

- [ ] **Step 2: Spec**

In §5, replace the **Descarga** and **Permisos** bullets with:

```markdown
- **Descarga**: `GET https://fonts.googleapis.com/css2?family=<Familia>:wght@300;400;500;600;700&display=swap` → `parseCss2` extrae los bloques `@font-face` (subset del comentario, peso, `unicode-range`, URL `woff2` de `fonts.gstatic.com`) → filtra por subsets (por defecto `latin`, `latin-ext`) → une en un rango (`"300 700"`) los pesos que comparten archivo (fuentes variables) → descarga cada archivo una vez (máx. 2 MB por familia) → guarda `local:fonts/<familia>` = `{ family, faces: [{ weight, unicodeRange, subset, dataBase64 }], bytes, subsets, downloadedAt }` y el índice `local:fontFamilies`.
- **Permisos**: ninguno extra. Ambos hosts responden `Access-Control-Allow-Origin: *`, así que la página de opciones descarga con `fetch` sin `host_permissions` (decisión de la Fase 3).
```

In the **Catálogo curado** bullet, replace the candidate list with the final 20 from `src/fonts/catalog.ts`, and note that Commit Mono is not on Google Fonts.

- [ ] **Step 3: Pending notes**

In `docs/notes/pendientes-fase-2.md`, delete the whole "Decidir antes de la Fase 3" section (both bullets are done in Task 1).

- [ ] **Step 4: Commit**

```bash
git add README.md docs
git commit -m "docs: document fonts and record Phase 3 decisions"
```
