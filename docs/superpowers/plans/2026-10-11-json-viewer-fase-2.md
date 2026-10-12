# JSON Viewer — Fase 2 (opciones + temas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configuración persistente con página de opciones (vista previa en vivo), 16 temas incluidos convertidos desde temas de VS Code, importador de temas VS Code, editor de temas y modo claro/oscuro automático, aplicados en vivo al visor.

**Architecture:** La configuración vive en `sync:settings` (WXT storage, versionada) y se valida con `validateSettings`; el CSS personalizado en `local:customCss`; cada tema personalizado en `sync:customTheme:<id>` con un índice `sync:customThemeIds`. Un conversor puro `fromVSCode` (JSONC + resolución de scopes TextMate) alimenta tanto el script que genera los temas incluidos como el importador de la página de opciones. El visor lee todo al inyectarse y observa los cambios (storage + `prefers-color-scheme`); `CodeView` se reconfigura con un `Compartment` en lugar de recrear el estado. La página de opciones (Vue) reutiliza `JsonViewer` como vista previa.

**Tech Stack:** WXT 0.21.4, Vue 3.5, CodeMirror 6 (+ `@codemirror/lang-css` 6.3.1), `jsonc-parser` 3.3.1, `tm-themes` 1.12.12 (dev), `tsx` 4.23.15 (dev), `@vitejs/plugin-vue` 6.0.10 (dev), Vitest 5 + happy-dom, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-10-11-json-viewer-design.md` — este plan cubre §10 Fase 2 (§4 temas, §6.7 configuración, §6.8 página de opciones) más los pendientes de Fase 2 de `docs/notes/pendientes-fase-0-1.md`.

## Global Constraints

- pnpm only (never npm/yarn). Node 24. Windows + Git Bash.
- Manifest V3; permissions stay `storage` and `scripting`. No network access at runtime.
- `srcDir: 'src'`, alias `@/` → `src/`. The `detector` content script must not change (≤ 8192 bytes, no Vue/CodeMirror).
- Keep `wxt.config.ts`'s rolldown `minify.codegen.asciiOnly` (Chrome rejects content scripts containing U+FFFF).
- `src/themes/color.ts`, `types.ts`, `scopes.ts`, `fromVSCode.ts`, `validate.ts` and `src/shared/guards.ts` use only **relative** imports (they run under `tsx` in `scripts/build-themes.ts`, which has no `@/` alias or WXT auto-imports).
- Storage keys (exact): `sync:settings` (version 1), `local:customCss`, `sync:customThemeIds`, `sync:customTheme:<id>`.
- Built-in theme ids are stored in user settings: never rename them. Default light theme id `light-plus`, default dark theme id `dark-plus`.
- tsconfig has `noUncheckedIndexedAccess`: when indexing arrays/records, guard or use `!` only where the index is proven in range.
- Identifiers, comments and UI text in English (i18n arrives in Phase 6). Conventional commits; every commit ends with `Co-Authored-By: Claude <Your Model> 5.5 <noreply@anthropic.com>` naming the model that wrote it.
- Unit tests next to code (`src/**/*.test.ts`); e2e in `e2e/`. Component tests use happy-dom and Vue's `createApp` (no extra test library).

## Review Focus

1. **Corrupted or foreign settings in storage** (old/newer version, hand-edited, wrong types): the viewer still renders, bad fields fall back to defaults. → unit test in Task 2, e2e in Task 8.
2. **A selected theme id that doesn't exist** (deleted custom theme, or synced from another device without the theme): falls back to Dark+/Light+ by kind, never a blank or broken viewer. → unit test in Task 6, e2e in Task 8.
3. **Real-world VS Code themes with quirks** (JSONC comments, trailing commas, `#fff` shorthand, uppercase hex, `tokenColors` as a file path, `include`, missing `type`): import works or fails with a readable reason. → unit tests in Task 4.
4. **Rapid edits in the options page** (typing a number, editing CSS): writes are debounced so `storage.sync` write quotas are never hit. → unit test in Task 9.
5. **Custom CSS containing markup** (`</style><img onerror=…>`): injected as text only, never parsed as HTML. → unit test in Task 7.

---

## File Structure

```
src/shared/guards.ts                 isRecord, nonEmptyString
src/settings/schema.ts               Settings, ThemeMode, defaultSettings, validateSettings
src/settings/storage.ts              settingsItem, customCssItem, loadSettings, saveSettings, watchSettings
src/themes/validate.ts               parseCompactTheme (compact theme validation + normalization)
src/themes/scopes.ts                 TextMate selector scoring, resolveScopeColor
src/themes/fromVSCode.ts             fromVSCode, ThemeImportError
src/themes/builtin/generated.json    14 themes generated from tm-themes (do not edit by hand)
src/themes/builtin/light-plus.json   hand-written Light+
src/themes/builtin/LICENSES.md       third-party notices for bundled themes
src/themes/builtin/index.ts          defaultTheme, defaultLightTheme, builtinThemes, getBuiltinTheme
src/themes/store.ts                  custom themes in sync storage, uniqueThemeId, watchCustomThemes
src/themes/active.ts                 pickThemeKind, findTheme, activeTheme
scripts/build-themes.ts              regenerates generated.json + LICENSES.md (pnpm themes:build)
src/components/viewer.css            viewer styles (moved from entrypoints/viewer.content/style.css)
src/components/{CodeView,JsonViewer,ViewerToolbar}.vue   compartments, theme toggle, settings button, custom CSS
src/entrypoints/viewer.content/index.ts   loads settings/themes, live updates
src/entrypoints/background.ts        + open-options message
src/messages.ts                      + OPEN_OPTIONS
src/entrypoints/options/{index.html,main.ts,App.vue}
src/options/types.ts, sample.ts, useSettings.ts, useCustomThemes.ts, options.css
src/options/fields/{ToggleField,NumberField,SelectField}.vue
src/options/sections/{AppearanceSection,BehaviorSection,StructureSection,AdvancedSection,AboutSection}.vue
src/options/{PreviewPane,CssEditor,ThemeSwatch,ThemeImport,ThemeEditor}.vue
e2e/storage.ts, e2e/settings.spec.ts, e2e/options.spec.ts, e2e/themes.spec.ts
```

---

### Task 1: Error position that survives `\r\n` (pending from Phase 1)

CodeMirror normalizes line breaks, so a raw character offset drifts on CRLF documents. The editor will locate errors by line/column instead, and `offsetToLineColumn` must treat a lone `\r` as a line break like CodeMirror does.

**Files:**
- Modify: `src/parse/parse.ts` (`offsetToLineColumn`), `src/editor/errorLine.ts`, `src/components/CodeView.vue` (`revealError`)
- Test: `src/parse/parse.test.ts`, `src/editor/errorLine.test.ts` (rewrite), `src/editor/setup.test.ts` (update calls), `e2e/server.ts`, `e2e/viewer.spec.ts`

**Interfaces:**
- Produces: `interface ErrorLocation { line: number | null; column: number | null }`; `errorPosition(doc: Text, error: ErrorLocation): number | null`; `errorMarkerDecorations(doc: Text, error: ErrorLocation): DecorationSet`; `errorMarker(error: ErrorLocation): Extension`. `ParseError` (with `offset`) stays structurally assignable to `ErrorLocation`.

- [ ] **Step 1: Failing tests**

Add to `src/parse/parse.test.ts` inside `describe('offsetToLineColumn', …)`:

```ts
  it('treats a lone carriage return as a line break', () => {
    expect(offsetToLineColumn('a\rb', 2)).toEqual({ line: 2, column: 1 });
  });

  it('treats CRLF as a single line break', () => {
    expect(offsetToLineColumn('a\r\nb\r\nc', 6)).toEqual({ line: 3, column: 1 });
  });
```

Add inside `describe('parseJson', …)`:

```ts
  it('locates errors in CRLF documents by line and column', () => {
    const result = parseJson('{\r\n  "a": 1,\r\n}');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ line: 3, column: 1 });
  });
```

Replace the whole of `src/editor/errorLine.test.ts` with:

```ts
// @vitest-environment happy-dom
import { Text } from '@codemirror/state';
import type { DecorationSet } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import { errorMarkerDecorations, errorPosition } from './errorLine';

const doc = Text.of(['a', 'b', 'c']);

function collect(set: DecorationSet): { from: number; to: number; cls: string }[] {
  const out: { from: number; to: number; cls: string }[] = [];
  for (const cursor = set.iter(); cursor.value; cursor.next()) {
    out.push({ from: cursor.from, to: cursor.to, cls: cursor.value.spec.class });
  }
  return out;
}

describe('errorPosition', () => {
  it('maps line and column to a document position', () => {
    expect(errorPosition(Text.of(['{', '  "a": 1,', '}']), { line: 3, column: 1 })).toBe(12);
  });

  it('uses the line start when the column is unknown', () => {
    expect(errorPosition(doc, { line: 2, column: null })).toBe(2);
  });

  it('clamps the line and the column', () => {
    expect(errorPosition(doc, { line: 99, column: 1 })).toBe(4);
    expect(errorPosition(doc, { line: 1, column: 50 })).toBe(1);
  });

  it('returns null without a line', () => {
    expect(errorPosition(doc, { line: null, column: 3 })).toBeNull();
  });
});

describe('errorMarkerDecorations', () => {
  it('marks only the line when the column is unknown', () => {
    expect(collect(errorMarkerDecorations(doc, { line: 2, column: null }))).toEqual([
      { from: 2, to: 2, cls: 'cm-jv-error-line' },
    ]);
  });

  it('marks the line and the character at the column', () => {
    expect(collect(errorMarkerDecorations(doc, { line: 2, column: 1 }))).toEqual([
      { from: 2, to: 2, cls: 'cm-jv-error-line' },
      { from: 2, to: 3, cls: 'cm-jv-error-char' },
    ]);
  });

  it('marks the last character when the error is at the end of the document', () => {
    const marks = collect(errorMarkerDecorations(doc, { line: 3, column: 2 }));
    expect(marks.at(-1)).toEqual({ from: 4, to: 5, cls: 'cm-jv-error-char' });
  });

  it('skips the line decoration for very long lines but keeps the character mark', () => {
    const long = Text.of(['x'.repeat(5000)]);
    expect(collect(errorMarkerDecorations(long, { line: 1, column: 3001 }))).toEqual([
      { from: 3000, to: 3001, cls: 'cm-jv-error-char' },
    ]);
  });

  it('marks nothing without a location', () => {
    expect(collect(errorMarkerDecorations(doc, { line: null, column: null }))).toEqual([]);
  });
});
```

In `src/editor/setup.test.ts` replace every `ErrorLocation` literal: `{ line: 2, offset: 2 }` → `{ line: 2, column: 1 }`, `{ line: 2, offset: null }` → `{ line: 2, column: null }`, `{ line: 1, offset: 100 }` → `{ line: 1, column: 101 }`. Keep every assertion unchanged. Rename the test title `'marks the character at the error offset'` to `'marks the character at the error column'`.

Add a route to `e2e/server.ts` `routes`:

```ts
  '/invalid-crlf.json': { type: 'application/json', body: '{\r\n  "a": 1,\r\n  "b": 2,\r\n}' },
```

Append to `e2e/viewer.spec.ts`:

```ts
test('marks the right character in an invalid CRLF document', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/invalid-crlf.json'));
  await expect(page.locator(`${viewer} .jv-error`)).toContainText('line 4, column 1');
  await expect(page.locator(`${viewer} .cm-jv-error-char`)).toHaveText('}');
});
```

- [ ] **Step 2: Run and see failures**

Run: `pnpm vitest run src/parse src/editor`
Expected: FAIL — lone `\r` test, `errorPosition` is not exported, `column` not handled.

- [ ] **Step 3: Implement**

In `src/parse/parse.ts` replace `offsetToLineColumn` with:

```ts
export function offsetToLineColumn(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    const code = text.charCodeAt(i);
    // \n, \r\n and a lone \r all end a line, matching CodeMirror's line splitting.
    if (code === 10 || (code === 13 && text.charCodeAt(i + 1) !== 10)) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}
```

Replace the whole of `src/editor/errorLine.ts` with:

```ts
import type { Extension, Range, Text } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';

/** 1-based line/column of a parse error. CodeMirror normalizes line breaks, so raw offsets would drift. */
export interface ErrorLocation {
  line: number | null;
  column: number | null;
}

// Highlighting a whole minified line would paint the entire document.
const MAX_MARKED_LINE_LENGTH = 1000;

const errorLineMark = Decoration.line({ class: 'cm-jv-error-line' });
const errorCharMark = Decoration.mark({ class: 'cm-jv-error-char' });

export function errorPosition(doc: Text, error: ErrorLocation): number | null {
  if (error.line === null) return null;
  const line = doc.line(Math.min(Math.max(error.line, 1), doc.lines));
  if (error.column === null) return line.from;
  return line.from + Math.min(Math.max(error.column - 1, 0), line.length);
}

export function errorMarkerDecorations(doc: Text, error: ErrorLocation): DecorationSet {
  if (error.line === null) return Decoration.none;
  const ranges: Range<Decoration>[] = [];
  const line = doc.line(Math.min(Math.max(error.line, 1), doc.lines));
  if (line.length <= MAX_MARKED_LINE_LENGTH) ranges.push(errorLineMark.range(line.from));
  const position = errorPosition(doc, error);
  if (error.column !== null && position !== null && doc.length > 0) {
    const at = Math.min(position, doc.length - 1);
    ranges.push(errorCharMark.range(at, at + 1));
  }
  return Decoration.set(ranges, true);
}

export function errorMarker(error: ErrorLocation): Extension {
  return EditorView.decorations.of((view) => errorMarkerDecorations(view.state.doc, error));
}
```

In `src/components/CodeView.vue` change the import to `import { errorPosition, type ErrorLocation } from '@/editor/errorLine';` and replace `revealError` with:

```ts
function revealError(): void {
  if (!view || props.error === null) return;
  const position = errorPosition(view.state.doc, props.error);
  if (position === null) return;
  view.dispatch({
    selection: { anchor: position },
    effects: EditorView.scrollIntoView(position, { y: 'center', x: 'center' }),
  });
}
```

- [ ] **Step 4: Verify**

Run: `pnpm test`, `pnpm compile`, `pnpm test:e2e`
Expected: all pass (14 e2e).

- [ ] **Step 5: Commit**

```bash
git add src/parse src/editor src/components/CodeView.vue e2e
git commit -m "fix(editor): locate parse errors by line and column so CRLF documents mark the right character"
```

---

### Task 2: Settings schema and storage

**Files:**
- Create: `src/shared/guards.ts`, `src/settings/schema.ts`, `src/settings/storage.ts`
- Test: `src/settings/schema.test.ts`, `src/settings/storage.test.ts`

**Interfaces:**
- Consumes: `ViewerOptions`, `defaultViewerOptions` (`src/viewer/options.ts`).
- Produces:
  - `isRecord(value: unknown): value is Record<string, unknown>`; `nonEmptyString(value: unknown): string | null`
  - `type ThemeMode = 'auto' | 'light' | 'dark'`; `interface Settings { viewer: ViewerOptions; themeMode: ThemeMode; lightThemeId: string; darkThemeId: string }`; `defaultSettings: Settings`; `TAB_SIZE_MIN = 1`, `TAB_SIZE_MAX = 10`; `validateSettings(input: unknown): Settings`
  - `settingsItem` (`sync:settings`, version 1), `customCssItem` (`local:customCss`, fallback `''`); `loadSettings(): Promise<Settings>`; `saveSettings(settings: Settings): Promise<void>`; `watchSettings(callback: (settings: Settings) => void): () => void`

- [ ] **Step 1: Failing tests**

`src/settings/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultViewerOptions } from '@/viewer/options';
import { defaultSettings, validateSettings } from './schema';

describe('validateSettings', () => {
  it('returns the defaults for anything that is not an object', () => {
    for (const input of [undefined, null, 42, 'x', []]) {
      expect(validateSettings(input)).toEqual(defaultSettings);
    }
  });

  it('defaults to auto mode with Light+ and Dark+', () => {
    expect(defaultSettings).toEqual({
      viewer: defaultViewerOptions,
      themeMode: 'auto',
      lightThemeId: 'light-plus',
      darkThemeId: 'dark-plus',
    });
  });

  it('keeps valid values', () => {
    const input = {
      viewer: { ...defaultViewerOptions, sortKeys: true, tabSize: 4 },
      themeMode: 'dark',
      lightThemeId: 'github-light',
      darkThemeId: 'dracula',
    };
    expect(validateSettings(input)).toEqual(input);
  });

  it('replaces each invalid field with its default and keeps the rest', () => {
    const result = validateSettings({
      viewer: { lineNumbers: false, sortKeys: 'yes', tabSize: 'x', bogus: 1 },
      themeMode: 'neon',
      lightThemeId: '',
      darkThemeId: 'nord',
      extra: true,
    });
    expect(result).toEqual({
      viewer: { ...defaultViewerOptions, lineNumbers: false },
      themeMode: 'auto',
      lightThemeId: 'light-plus',
      darkThemeId: 'nord',
    });
  });

  it('clamps and rounds the tab size to 1..10', () => {
    expect(validateSettings({ viewer: { tabSize: 0 } }).viewer.tabSize).toBe(1);
    expect(validateSettings({ viewer: { tabSize: 99 } }).viewer.tabSize).toBe(10);
    expect(validateSettings({ viewer: { tabSize: 3.6 } }).viewer.tabSize).toBe(4);
    expect(validateSettings({ viewer: { tabSize: Number.NaN } }).viewer.tabSize).toBe(2);
  });

  it('never returns the shared default objects', () => {
    const result = validateSettings(undefined);
    expect(result.viewer).not.toBe(defaultViewerOptions);
  });
});
```

`src/settings/storage.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defaultSettings } from './schema';
import { customCssItem, loadSettings, saveSettings, watchSettings } from './storage';

describe('settings storage', () => {
  beforeEach(() => fakeBrowser.reset());

  it('loads the defaults when nothing is stored', async () => {
    expect(await loadSettings()).toEqual(defaultSettings);
  });

  it('round-trips saved settings through sync storage', async () => {
    const settings = { ...defaultSettings, themeMode: 'light' as const };
    await saveSettings(settings);
    expect(await loadSettings()).toEqual(settings);
    expect((await fakeBrowser.storage.sync.get('settings')).settings).toEqual(settings);
  });

  it('validates before saving', async () => {
    await saveSettings({ ...defaultSettings, viewer: { ...defaultSettings.viewer, tabSize: 99 } });
    expect((await loadSettings()).viewer.tabSize).toBe(10);
  });

  it('repairs corrupted stored settings on load', async () => {
    await fakeBrowser.storage.sync.set({ settings: { themeMode: 'neon', viewer: { tabSize: 'x', lineNumbers: false } } });
    const settings = await loadSettings();
    expect(settings.themeMode).toBe('auto');
    expect(settings.viewer.tabSize).toBe(2);
    expect(settings.viewer.lineNumbers).toBe(false);
  });

  it('notifies watchers with validated settings', async () => {
    const seen: string[] = [];
    const stop = watchSettings((settings) => seen.push(settings.themeMode));
    await fakeBrowser.storage.sync.set({ settings: { themeMode: 'dark' } });
    await fakeBrowser.storage.sync.set({ settings: { themeMode: 'neon' } });
    stop();
    await fakeBrowser.storage.sync.set({ settings: { themeMode: 'light' } });
    expect(seen).toEqual(['dark', 'auto']);
  });

  it('stores custom CSS locally with an empty default', async () => {
    expect(await customCssItem.getValue()).toBe('');
    await customCssItem.setValue('.cm-content { color: red; }');
    expect((await fakeBrowser.storage.local.get('customCss')).customCss).toBe('.cm-content { color: red; }');
  });
});
```

- [ ] **Step 2: Run and see failures**

Run: `pnpm vitest run src/settings`
Expected: FAIL — `Failed to resolve import "./schema"`.

- [ ] **Step 3: Implement**

`src/shared/guards.ts`:

```ts
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}
```

`src/settings/schema.ts`:

```ts
import { isRecord, nonEmptyString } from '@/shared/guards';
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

const THEME_MODES: readonly string[] = ['auto', 'light', 'dark'];

/** Returns complete settings; every missing or invalid field falls back to its default. */
export function validateSettings(input: unknown): Settings {
  const raw = isRecord(input) ? input : {};
  const rawViewer = isRecord(raw.viewer) ? raw.viewer : {};
  const viewer: ViewerOptions = { ...defaultViewerOptions };
  for (const key of Object.keys(defaultViewerOptions) as (keyof ViewerOptions)[]) {
    const value = rawViewer[key];
    if (key === 'tabSize') {
      if (typeof value === 'number' && Number.isFinite(value)) {
        viewer.tabSize = Math.min(TAB_SIZE_MAX, Math.max(TAB_SIZE_MIN, Math.round(value)));
      }
    } else if (typeof value === 'boolean') {
      (viewer as unknown as Record<string, boolean>)[key] = value;
    }
  }
  return {
    viewer,
    themeMode: THEME_MODES.includes(raw.themeMode as string) ? (raw.themeMode as ThemeMode) : defaultSettings.themeMode,
    lightThemeId: nonEmptyString(raw.lightThemeId) ?? defaultSettings.lightThemeId,
    darkThemeId: nonEmptyString(raw.darkThemeId) ?? defaultSettings.darkThemeId,
  };
}
```

`src/settings/storage.ts`:

```ts
import { storage } from '#imports';
import { defaultSettings, validateSettings, type Settings } from './schema';

export const settingsItem = storage.defineItem<Settings>('sync:settings', {
  fallback: defaultSettings,
  version: 1,
});

// Local, not sync: a stylesheet can easily exceed sync's 8 KB per-item quota.
export const customCssItem = storage.defineItem<string>('local:customCss', { fallback: '' });

export async function loadSettings(): Promise<Settings> {
  return validateSettings(await settingsItem.getValue());
}

export async function saveSettings(settings: Settings): Promise<void> {
  await settingsItem.setValue(validateSettings(settings));
}

export function watchSettings(callback: (settings: Settings) => void): () => void {
  return settingsItem.watch((value) => callback(validateSettings(value)));
}
```

- [ ] **Step 4: Verify**

Run: `pnpm vitest run src/settings`, then `pnpm test` and `pnpm compile`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared src/settings
git commit -m "feat(settings): add validated settings schema backed by sync storage"
```

---

### Task 3: Compact theme validation

**Files:**
- Create: `src/themes/validate.ts`
- Test: `src/themes/validate.test.ts`

**Interfaces:**
- Consumes: `parseHex`, `toHex` (`src/themes/color.ts`); `themeColorKeys`, `Theme`, `ThemeColorKey`, `ThemeColors` (`src/themes/types.ts`); `isRecord` (`src/shared/guards.ts`).
- Produces: `THEME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/`; `type ThemeValidation = { ok: true; theme: Theme } | { ok: false; errors: string[] }`; `parseCompactTheme(input: unknown): ThemeValidation` (normalizes colors to lowercase hex, trims the name).

- [ ] **Step 1: Failing tests**

`src/themes/validate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultTheme } from './builtin';
import { parseCompactTheme } from './validate';

const minimal = { id: 'mine', name: 'Mine', type: 'dark', source: 'custom', colors: { background: '#111', foreground: '#EEEEEE' } };

describe('parseCompactTheme', () => {
  it('accepts a full built-in theme unchanged', () => {
    expect(parseCompactTheme(defaultTheme)).toEqual({ ok: true, theme: defaultTheme });
  });

  it('normalizes colors and trims the name', () => {
    expect(parseCompactTheme({ ...minimal, name: '  Mine  ' })).toEqual({
      ok: true,
      theme: { ...minimal, name: 'Mine', colors: { background: '#111111', foreground: '#eeeeee' } },
    });
  });

  it('defaults a missing source to custom', () => {
    const { source: _source, ...rest } = minimal;
    const result = parseCompactTheme(rest);
    expect(result.ok && result.theme.source).toBe('custom');
  });

  it('collects every problem', () => {
    const result = parseCompactTheme({
      id: 'Bad Id',
      name: '',
      type: 'sepia',
      colors: { background: 'red', key: '#12', glow: '#fff' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      '"id" must use lowercase letters, digits and dashes (max 64 characters)',
      '"name" must be a non-empty string',
      '"type" must be "dark" or "light"',
      '"colors.background" must be a hex color like #1e1e1e',
      '"colors.key" must be a hex color like #1e1e1e',
      'Unknown color "glow"',
      '"colors.background" is required',
      '"colors.foreground" is required',
    ]);
  });

  it('rejects non-objects', () => {
    expect(parseCompactTheme('theme')).toEqual({ ok: false, errors: ['A theme must be a JSON object'] });
    expect(parseCompactTheme({ ...minimal, colors: [] })).toEqual({
      ok: false,
      errors: ['"colors" must be an object', '"colors.background" is required', '"colors.foreground" is required'],
    });
  });
});
```

- [ ] **Step 2: Run and see failures**

Run: `pnpm vitest run src/themes/validate.test.ts`
Expected: FAIL — `Failed to resolve import "./validate"`.

- [ ] **Step 3: Implement**

`src/themes/validate.ts`:

```ts
import { isRecord } from '../shared/guards';
import { parseHex, toHex } from './color';
import { themeColorKeys, type Theme, type ThemeColorKey, type ThemeColors } from './types';

export const THEME_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export type ThemeValidation = { ok: true; theme: Theme } | { ok: false; errors: string[] };

const SOURCES: readonly string[] = ['builtin', 'imported', 'custom'];

function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    return toHex(parseHex(value));
  } catch {
    return null;
  }
}

/** Validates an untrusted compact theme (storage, the editor's JSON, imports) and normalizes its colors. */
export function parseCompactTheme(input: unknown): ThemeValidation {
  if (!isRecord(input)) return { ok: false, errors: ['A theme must be a JSON object'] };
  const errors: string[] = [];

  const id = typeof input.id === 'string' ? input.id : '';
  if (!THEME_ID_PATTERN.test(id)) {
    errors.push('"id" must use lowercase letters, digits and dashes (max 64 characters)');
  }
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 80) : '';
  if (name === '') errors.push('"name" must be a non-empty string');
  const type = input.type;
  if (type !== 'dark' && type !== 'light') errors.push('"type" must be "dark" or "light"');
  const source = SOURCES.includes(input.source as string) ? (input.source as Theme['source']) : 'custom';

  const colors: Partial<ThemeColors> = {};
  if (!isRecord(input.colors)) {
    errors.push('"colors" must be an object');
  } else {
    for (const [key, value] of Object.entries(input.colors)) {
      if (!(themeColorKeys as readonly string[]).includes(key)) {
        errors.push(`Unknown color "${key}"`);
        continue;
      }
      const hex = normalizeHex(value);
      if (hex === null) errors.push(`"colors.${key}" must be a hex color like #1e1e1e`);
      else colors[key as ThemeColorKey] = hex;
    }
  }
  if (!colors.background) errors.push('"colors.background" is required');
  if (!colors.foreground) errors.push('"colors.foreground" is required');

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    theme: { id, name, type: type as Theme['type'], source, colors: colors as Theme['colors'] },
  };
}
```

Note: the error order in the test follows object-key order of `colors` (`background`, `key`, `glow`) and then the required checks.

- [ ] **Step 4: Verify**

Run: `pnpm vitest run src/themes/validate.test.ts`, `pnpm compile`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes/validate.ts src/themes/validate.test.ts
git commit -m "feat(themes): validate and normalize compact themes"
```

---

### Task 4: VS Code theme converter (`fromVSCode`)

**Files:**
- Create: `src/themes/scopes.ts`, `src/themes/fromVSCode.ts`
- Modify: `package.json` (dependencies)
- Test: `src/themes/scopes.test.ts`, `src/themes/fromVSCode.test.ts`

**Interfaces:**
- Consumes: `parseHex`, `toHex`; `Theme`, `ThemeColorKey`, `ThemeColors`; `isRecord`.
- Produces:
  - `interface TokenColorRule { scope?: unknown; settings?: { foreground?: unknown } }`; `scoreSelector(selector: string, stack: readonly string[]): readonly [number, number, number] | null`; `resolveScopeColor(rules: readonly TokenColorRule[], stack: readonly string[]): string | null`
  - `class ThemeImportError extends Error { readonly errors: string[] }`; `interface ImportedTheme { theme: Theme; warnings: string[] }`; `fromVSCode(source: string, id: string): ImportedTheme` (theme `source: 'imported'`)

- [ ] **Step 1: Install dependencies**

```bash
pnpm add jsonc-parser@3.3.1
pnpm add -D tm-themes@1.12.12
```

- [ ] **Step 2: Failing tests**

`src/themes/scopes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveScopeColor, scoreSelector } from './scopes';

const key = ['source.json', 'meta.structure.dictionary.json', 'string.json', 'support.type.property-name.json'];

describe('scoreSelector', () => {
  it('matches by dotted prefix only', () => {
    expect(scoreSelector('support.type.property-name', key)).toEqual([3, 3, 1]);
    expect(scoreSelector('support.type.prop', key)).toBeNull();
  });

  it('prefers deeper matches over shallower ones', () => {
    expect(scoreSelector('string', key)).toEqual([2, 1, 1]);
  });

  it('requires ancestor parts in order', () => {
    expect(scoreSelector('source.json support.type.property-name', key)).toEqual([3, 3, 2]);
    expect(scoreSelector('support.type.property-name source.json', key)).toBeNull();
  });

  it('ignores selectors with exclusions', () => {
    expect(scoreSelector('source.json - string', key)).toBeNull();
  });
});

describe('resolveScopeColor', () => {
  it('picks the most specific rule', () => {
    const rules = [
      { scope: 'string', settings: { foreground: '#111111' } },
      { scope: 'support.type.property-name', settings: { foreground: '#222222' } },
      { scope: 'source.json meta.structure.dictionary.json support.type.property-name.json', settings: { foreground: '#333333' } },
    ];
    expect(resolveScopeColor(rules, key)).toBe('#333333');
  });

  it('lets later rules win ties', () => {
    const rules = [
      { scope: 'support', settings: { foreground: '#111111' } },
      { scope: ['support'], settings: { foreground: '#222222' } },
    ];
    expect(resolveScopeColor(rules, key)).toBe('#222222');
  });

  it('splits comma-separated scopes and skips rules without a foreground', () => {
    const rules = [
      { scope: 'constant.numeric, constant.language', settings: { foreground: '#444444' } },
      { scope: 'constant.language', settings: { fontStyle: 'italic' } },
    ];
    expect(resolveScopeColor(rules, ['source.json', 'constant.language.json'])).toBe('#444444');
  });

  it('returns null when nothing matches', () => {
    expect(resolveScopeColor([{ scope: 'comment', settings: { foreground: '#555555' } }], key)).toBeNull();
  });
});
```

`src/themes/fromVSCode.test.ts`:

```ts
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

  it('falls back to a generic name', () => {
    expect(fromVSCode('{"colors":{"editor.background":"#000"}}', 'x').theme.name).toBe('Imported theme');
  });

  it('rejects invalid JSON, non-objects and files without colors', () => {
    expect(importErrors('{"colors": ')[0]).toMatch(/^Invalid JSON: /);
    expect(importErrors('[1, 2]')).toEqual(['Expected a JSON object with "colors" and "tokenColors"']);
    expect(importErrors('{"name":"x"}')).toEqual(['No "colors" or "tokenColors" found — is this a VS Code color theme?']);
  });
});
```

- [ ] **Step 3: Run and see failures**

Run: `pnpm vitest run src/themes/scopes.test.ts src/themes/fromVSCode.test.ts`
Expected: FAIL — unresolved imports.

- [ ] **Step 4: Implement `scopes.ts`**

`src/themes/scopes.ts`:

```ts
export interface TokenColorRule {
  scope?: unknown;
  settings?: { foreground?: unknown };
}

type Score = readonly [depth: number, segments: number, parts: number];

const matchesScope = (selector: string, scope: string): boolean =>
  scope === selector || scope.startsWith(`${selector}.`);

function selectorsOf(scope: unknown): string[] {
  if (typeof scope === 'string') return scope.split(',');
  if (Array.isArray(scope)) return scope.filter((s): s is string => typeof s === 'string');
  return [];
}

/**
 * Scores a TextMate selector ("a b c"; exclusions unsupported) against a scope
 * stack ordered outermost → innermost. Higher is more specific; null = no match.
 */
export function scoreSelector(selector: string, stack: readonly string[]): Score | null {
  const parts = selector.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part.startsWith('-'))) return null;
  const last = parts[parts.length - 1]!;
  let depth = -1;
  for (let i = stack.length - 1; i >= 0; i--) {
    if (matchesScope(last, stack[i]!)) {
      depth = i;
      break;
    }
  }
  if (depth < 0) return null;
  let j = depth - 1;
  for (let k = parts.length - 2; k >= 0; k--) {
    while (j >= 0 && !matchesScope(parts[k]!, stack[j]!)) j--;
    if (j < 0) return null;
    j--;
  }
  return [depth, last.split('.').length, parts.length];
}

const compare = (a: Score, b: Score): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** Foreground of the most specific matching rule; later rules win ties, as in VS Code. */
export function resolveScopeColor(rules: readonly TokenColorRule[], stack: readonly string[]): string | null {
  let best: Score | null = null;
  let color: string | null = null;
  for (const rule of rules) {
    const foreground = rule.settings?.foreground;
    if (typeof foreground !== 'string') continue;
    for (const selector of selectorsOf(rule.scope)) {
      const score = scoreSelector(selector, stack);
      if (score && (best === null || compare(score, best) >= 0)) {
        best = score;
        color = foreground;
      }
    }
  }
  return color;
}
```

- [ ] **Step 5: Implement `fromVSCode.ts`**

`src/themes/fromVSCode.ts`:

```ts
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
  if (editorColors['editor.background'] === undefined && rules.length === 0) {
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
  const globalRule = rules.find((rule) => rule.scope === undefined);
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
```

- [ ] **Step 6: Verify**

Run: `pnpm vitest run src/themes`, `pnpm test`, `pnpm compile`
Expected: PASS. If the Dracula expectation differs, do not edit the expected object: report the actual output (DONE_WITH_CONCERNS) — the values were computed from tm-themes 1.12.12 with this exact resolver.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/themes
git commit -m "feat(themes): convert VS Code color themes with TextMate scope resolution"
```

---

### Task 5: Built-in themes

**Files:**
- Create: `scripts/build-themes.ts`, `src/themes/builtin/generated.json` (generated), `src/themes/builtin/LICENSES.md` (generated), `src/themes/builtin/light-plus.json`
- Modify: `src/themes/builtin/index.ts`, `package.json` (script + dev dependency)
- Test: `src/themes/builtin/builtin.test.ts`

**Interfaces:**
- Consumes: `fromVSCode` (Task 4), `parseCompactTheme` (Task 3).
- Produces: `defaultTheme: Theme` (Dark+, unchanged), `defaultLightTheme: Theme` (Light+), `builtinThemes: readonly Theme[]` (16 themes, Dark+ and Light+ first), `getBuiltinTheme(id: string): Theme | undefined`; script `pnpm themes:build`.

- [ ] **Step 1: Failing test**

`src/themes/builtin/builtin.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseCompactTheme } from '../validate';
import { builtinThemes, defaultLightTheme, defaultTheme, getBuiltinTheme } from './index';

const IDS = [
  'dark-plus', 'light-plus', 'one-dark-pro', 'dracula', 'github-dark', 'github-light', 'monokai', 'tokyo-night',
  'catppuccin-mocha', 'catppuccin-latte', 'nord', 'night-owl', 'solarized-dark', 'solarized-light', 'ayu-dark',
  'material-theme',
];

describe('builtinThemes', () => {
  it('contains the 16 themes in order, Dark+ and Light+ first', () => {
    expect(builtinThemes.map((t) => t.id)).toEqual(IDS);
    expect(builtinThemes[0]).toBe(defaultTheme);
    expect(builtinThemes[1]).toBe(defaultLightTheme);
  });

  it('only contains valid built-in themes', () => {
    for (const theme of builtinThemes) {
      expect(parseCompactTheme(theme)).toEqual({ ok: true, theme });
      expect(theme.source).toBe('builtin');
    }
  });

  it('has the expected types and Dracula key color', () => {
    expect(defaultLightTheme.type).toBe('light');
    expect(getBuiltinTheme('github-light')?.type).toBe('light');
    expect(getBuiltinTheme('dracula')?.colors.key).toBe('#8be9fd');
    expect(getBuiltinTheme('nope')).toBeUndefined();
  });
});
```

Run: `pnpm vitest run src/themes/builtin`
Expected: FAIL — `defaultLightTheme`/`builtinThemes` not exported.

- [ ] **Step 2: Add the script and Light+**

```bash
pnpm add -D tsx@4.23.15
```

Add to `package.json` `scripts`: `"themes:build": "tsx scripts/build-themes.ts"`.

`scripts/build-themes.ts`:

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromVSCode } from '../src/themes/fromVSCode';

const require = createRequire(import.meta.url);

// tm-themes file names; they double as our theme ids, which are stored in user settings — never rename.
const THEMES = [
  'one-dark-pro', 'dracula', 'github-dark', 'github-light', 'monokai', 'tokyo-night', 'catppuccin-mocha',
  'catppuccin-latte', 'nord', 'night-owl', 'solarized-dark', 'solarized-light', 'ayu-dark', 'material-theme',
] as const;

const outDir = fileURLToPath(new URL('../src/themes/builtin/', import.meta.url));
const themePath = (name: string) => require.resolve(`tm-themes/themes/${name}.json`);

const themes = THEMES.map((name) => {
  const { theme, warnings } = fromVSCode(readFileSync(themePath(name), 'utf8'), name);
  for (const warning of warnings) console.warn(`[${name}] ${warning}`);
  return { ...theme, source: 'builtin' as const };
});
writeFileSync(join(outDir, 'generated.json'), `${JSON.stringify(themes, null, 2)}\n`);

// Copy each bundled theme's license notice from tm-themes' NOTICE file.
const notice = readFileSync(join(dirname(themePath('dracula')), '..', 'NOTICE'), 'utf8');
const sections = notice.split(/^=+$/m).filter((section) =>
  THEMES.some((name) => new RegExp(`^Files:\\s+${name}\\.json\\s*$`, 'm').test(section)),
);
const licenses = [
  '# Third-party theme licenses',
  '',
  'Dark+ and Light+ (`dark-plus.json`, `light-plus.json`) are hand-written from the VS Code defaults (MIT, Microsoft).',
  'The themes in `generated.json` are converted with `pnpm themes:build` from',
  '[tm-themes](https://github.com/shikijs/textmate-grammars-themes) (MIT), which redistributes them under their',
  'original licenses, reproduced below.',
  '',
  ...sections.map((section) => ['```text', section.trim(), '```', ''].join('\n')),
].join('\n');
writeFileSync(join(outDir, 'LICENSES.md'), `${licenses}\n`);

console.log(`Wrote ${themes.length} themes and ${sections.length} license notices.`);
```

`src/themes/builtin/light-plus.json`:

```json
{
  "id": "light-plus",
  "name": "Light+",
  "type": "light",
  "source": "builtin",
  "colors": {
    "background": "#ffffff",
    "foreground": "#000000",
    "gutterBackground": "#ffffff",
    "gutterForeground": "#237893",
    "activeLine": "#f3f3f3",
    "selection": "#add6ff",
    "cursor": "#000000",
    "foldPlaceholder": "#808080",
    "key": "#0451a5",
    "string": "#a31515",
    "number": "#098658",
    "boolean": "#0000ff",
    "null": "#0000ff",
    "punctuation": "#000000",
    "link": "#006ab1",
    "toolbarBackground": "#f3f3f3",
    "border": "#e5e5e5"
  }
}
```

- [ ] **Step 3: Generate and wire up**

Run: `pnpm themes:build`
Expected: `Wrote 14 themes and 14 license notices.` (warnings, if any, are printed per theme — include them in the report). Open `src/themes/builtin/LICENSES.md` and check it has 14 fenced notices.

Replace `src/themes/builtin/index.ts` with:

```ts
import type { Theme } from '../types';
import darkPlus from './dark-plus.json';
import generated from './generated.json';
import lightPlus from './light-plus.json';

export const defaultTheme = darkPlus as Theme;
export const defaultLightTheme = lightPlus as Theme;

/** Built-in themes. Their ids are stored in user settings, so never rename them. */
export const builtinThemes: readonly Theme[] = [defaultTheme, defaultLightTheme, ...(generated as Theme[])];

export function getBuiltinTheme(id: string): Theme | undefined {
  return builtinThemes.find((theme) => theme.id === id);
}
```

- [ ] **Step 4: Verify**

Run: `pnpm test`, `pnpm compile`, `pnpm build`
Expected: PASS; the build succeeds (the viewer bundle grows by roughly 10 kB of theme JSON).

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml scripts src/themes/builtin
git commit -m "feat(themes): bundle 16 built-in themes generated from tm-themes"
```

---

### Task 6: Custom theme store and active theme selection

**Files:**
- Create: `src/themes/store.ts`, `src/themes/active.ts`
- Test: `src/themes/store.test.ts`, `src/themes/active.test.ts`

**Interfaces:**
- Consumes: `parseCompactTheme`, `THEME_ID_PATTERN`; `getBuiltinTheme`, `defaultTheme`, `defaultLightTheme`; `Settings`, `ThemeMode`.
- Produces:
  - `class ThemeValidationError extends Error { readonly errors: string[] }`
  - `uniqueThemeId(name: string, taken: Iterable<string>): string`
  - `listCustomThemes(): Promise<Theme[]>`; `saveCustomTheme(theme: Theme): Promise<void>`; `deleteCustomTheme(id: string): Promise<void>`; `watchCustomThemes(callback: () => void): () => void`
  - `type ThemeKind = 'light' | 'dark'`; `pickThemeKind(mode: ThemeMode, prefersDark: boolean, override: ThemeKind | null): ThemeKind`; `findTheme(id: string, customThemes: readonly Theme[], kind: ThemeKind): Theme`; `activeTheme(settings: Pick<Settings, 'themeMode' | 'lightThemeId' | 'darkThemeId'>, customThemes: readonly Theme[], prefersDark: boolean, override: ThemeKind | null): Theme`

- [ ] **Step 1: Failing tests**

`src/themes/active.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultSettings } from '@/settings/schema';
import { activeTheme, findTheme, pickThemeKind } from './active';
import { defaultLightTheme, defaultTheme, getBuiltinTheme } from './builtin';
import type { Theme } from './types';

const mine: Theme = { id: 'mine', name: 'Mine', type: 'dark', source: 'custom', colors: { background: '#000000', foreground: '#ffffff' } };

describe('pickThemeKind', () => {
  it.each([
    ['auto', true, null, 'dark'],
    ['auto', false, null, 'light'],
    ['light', true, null, 'light'],
    ['dark', false, null, 'dark'],
    ['dark', false, 'light', 'light'],
    ['auto', false, 'dark', 'dark'],
  ] as const)('%s, prefersDark=%s, override=%s → %s', (mode, prefersDark, override, expected) => {
    expect(pickThemeKind(mode, prefersDark, override)).toBe(expected);
  });
});

describe('findTheme', () => {
  it('finds built-in and custom themes', () => {
    expect(findTheme('dracula', [], 'dark')).toBe(getBuiltinTheme('dracula'));
    expect(findTheme('mine', [mine], 'dark')).toBe(mine);
  });

  it('falls back to Dark+ or Light+ for unknown ids', () => {
    expect(findTheme('ghost', [], 'dark')).toBe(defaultTheme);
    expect(findTheme('ghost', [mine], 'light')).toBe(defaultLightTheme);
  });
});

describe('activeTheme', () => {
  it('uses the slot that matches the resolved kind', () => {
    const settings = { ...defaultSettings, lightThemeId: 'github-light', darkThemeId: 'mine' };
    expect(activeTheme(settings, [mine], true, null)).toBe(mine);
    expect(activeTheme(settings, [mine], false, null)).toBe(getBuiltinTheme('github-light'));
    expect(activeTheme({ ...settings, themeMode: 'light' }, [mine], true, 'dark')).toBe(mine);
  });
});
```

`src/themes/store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { deleteCustomTheme, listCustomThemes, saveCustomTheme, ThemeValidationError, uniqueThemeId, watchCustomThemes } from './store';
import type { Theme } from './types';

const theme = (id: string, name = id): Theme => ({
  id,
  name,
  type: 'dark',
  source: 'custom',
  colors: { background: '#FFF', foreground: '#000000' },
});

describe('uniqueThemeId', () => {
  it('slugifies names', () => {
    expect(uniqueThemeId('Dracula Theme', [])).toBe('dracula-theme');
    expect(uniqueThemeId('Café Night!', [])).toBe('cafe-night');
    expect(uniqueThemeId('***', [])).toBe('theme');
  });

  it('avoids taken ids', () => {
    expect(uniqueThemeId('Nord', ['nord'])).toBe('nord-2');
    expect(uniqueThemeId('Nord', ['nord', 'nord-2'])).toBe('nord-3');
  });

  it('keeps ids within the allowed length', () => {
    expect(uniqueThemeId('x'.repeat(200), []).length).toBeLessThanOrEqual(48);
  });
});

describe('custom theme store', () => {
  beforeEach(() => fakeBrowser.reset());

  it('saves, lists (normalized) and deletes themes', async () => {
    await saveCustomTheme(theme('one'));
    await saveCustomTheme(theme('two'));
    expect((await listCustomThemes()).map((t) => t.id)).toEqual(['one', 'two']);
    expect((await listCustomThemes())[0]?.colors.background).toBe('#ffffff');
    await deleteCustomTheme('one');
    expect((await listCustomThemes()).map((t) => t.id)).toEqual(['two']);
    expect((await fakeBrowser.storage.sync.get('customTheme:one'))['customTheme:one']).toBeUndefined();
  });

  it('updates an existing theme without duplicating its id', async () => {
    await saveCustomTheme(theme('one', 'First'));
    await saveCustomTheme(theme('one', 'Renamed'));
    const list = await listCustomThemes();
    expect(list.map((t) => t.name)).toEqual(['Renamed']);
  });

  it('rejects invalid themes and built-in ids', async () => {
    await expect(saveCustomTheme({ ...theme('one'), name: '' })).rejects.toBeInstanceOf(ThemeValidationError);
    await expect(saveCustomTheme(theme('dracula'))).rejects.toThrow('"dracula" is a built-in theme id');
  });

  it('skips corrupted stored entries', async () => {
    await saveCustomTheme(theme('good'));
    await fakeBrowser.storage.sync.set({ customThemeIds: ['good', 'bad'], 'customTheme:bad': { id: 'bad' } });
    expect((await listCustomThemes()).map((t) => t.id)).toEqual(['good']);
  });

  it('notifies watchers about theme changes only', async () => {
    let calls = 0;
    const stop = watchCustomThemes(() => calls++);
    await saveCustomTheme(theme('one'));
    const afterSave = calls;
    await fakeBrowser.storage.sync.set({ unrelated: 1 });
    expect(calls).toBe(afterSave);
    expect(afterSave).toBeGreaterThan(0);
    stop();
    await deleteCustomTheme('one');
    expect(calls).toBe(afterSave);
  });
});
```

Run: `pnpm vitest run src/themes/store.test.ts src/themes/active.test.ts`
Expected: FAIL — unresolved imports.

- [ ] **Step 2: Implement**

`src/themes/active.ts`:

```ts
import type { Settings, ThemeMode } from '@/settings/schema';
import { defaultLightTheme, defaultTheme, getBuiltinTheme } from './builtin';
import type { Theme } from './types';

export type ThemeKind = 'light' | 'dark';

export function pickThemeKind(mode: ThemeMode, prefersDark: boolean, override: ThemeKind | null): ThemeKind {
  if (override !== null) return override;
  if (mode === 'auto') return prefersDark ? 'dark' : 'light';
  return mode;
}

/** Built-in or custom theme by id; unknown ids (deleted, or synced without the theme) fall back to Dark+/Light+. */
export function findTheme(id: string, customThemes: readonly Theme[], kind: ThemeKind): Theme {
  return (
    getBuiltinTheme(id) ??
    customThemes.find((theme) => theme.id === id) ??
    (kind === 'dark' ? defaultTheme : defaultLightTheme)
  );
}

export function activeTheme(
  settings: Pick<Settings, 'themeMode' | 'lightThemeId' | 'darkThemeId'>,
  customThemes: readonly Theme[],
  prefersDark: boolean,
  override: ThemeKind | null,
): Theme {
  const kind = pickThemeKind(settings.themeMode, prefersDark, override);
  return findTheme(kind === 'dark' ? settings.darkThemeId : settings.lightThemeId, customThemes, kind);
}
```

`src/themes/store.ts`:

```ts
import { storage } from '#imports';
import { browser } from 'wxt/browser';
import { getBuiltinTheme } from './builtin';
import type { Theme } from './types';
import { parseCompactTheme } from './validate';

// One sync item per theme keeps each well under storage.sync's 8 KB per-item quota.
const INDEX_KEY = 'sync:customThemeIds';
const themeKey = (id: string) => `sync:customTheme:${id}` as const;

export class ThemeValidationError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(errors.join('\n'));
    this.name = 'ThemeValidationError';
    this.errors = errors;
  }
}

const ID_MAX_BASE = 48;

export function uniqueThemeId(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base =
    name
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, ID_MAX_BASE)
      .replace(/-+$/, '') || 'theme';
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const id = `${base}-${n}`;
    if (!used.has(id)) return id;
  }
}

async function readIndex(): Promise<string[]> {
  const ids = await storage.getItem<unknown>(INDEX_KEY);
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
}

export async function listCustomThemes(): Promise<Theme[]> {
  const ids = await readIndex();
  if (ids.length === 0) return [];
  const items = await storage.getItems(ids.map(themeKey));
  return items.flatMap(({ value }) => {
    const result = parseCompactTheme(value);
    return result.ok ? [result.theme] : [];
  });
}

export async function saveCustomTheme(theme: Theme): Promise<void> {
  const result = parseCompactTheme({ ...theme, source: theme.source === 'builtin' ? 'custom' : theme.source });
  if (!result.ok) throw new ThemeValidationError(result.errors);
  if (getBuiltinTheme(theme.id)) throw new ThemeValidationError([`"${theme.id}" is a built-in theme id`]);
  await storage.setItem(themeKey(theme.id), result.theme);
  const ids = await readIndex();
  if (!ids.includes(theme.id)) await storage.setItem(INDEX_KEY, [...ids, theme.id]);
}

export async function deleteCustomTheme(id: string): Promise<void> {
  await storage.removeItem(themeKey(id));
  const ids = await readIndex();
  await storage.setItem(
    INDEX_KEY,
    ids.filter((existing) => existing !== id),
  );
}

export function watchCustomThemes(callback: () => void): () => void {
  const listener: Parameters<typeof browser.storage.onChanged.addListener>[0] = (changes, area) => {
    if (area !== 'sync') return;
    if (Object.keys(changes).some((key) => key === 'customThemeIds' || key.startsWith('customTheme:'))) callback();
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
```

- [ ] **Step 3: Verify**

Run: `pnpm vitest run src/themes`, `pnpm test`, `pnpm compile`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/themes
git commit -m "feat(themes): store custom themes in sync storage and resolve the active theme"
```

---

### Task 7: Viewer components — compartments, theme toggle, settings button, custom CSS

**Files:**
- Create: `src/components/viewer.css` (moved from `src/entrypoints/viewer.content/style.css`, which is deleted), `src/components/CodeView.test.ts`, `src/components/JsonViewer.test.ts`
- Modify: `src/components/CodeView.vue`, `src/components/JsonViewer.vue`, `src/components/ViewerToolbar.vue`, `src/entrypoints/viewer.content/index.ts` (import path + `.jv-page` wrapper only), `vitest.config.ts`, `package.json`

**Interfaces:**
- Consumes: `buildExtensions`, `errorPosition`, `ErrorLocation` (Task 1); `defaultTheme`, `defaultLightTheme` (Task 5).
- Produces:
  - `<CodeView :doc :options :theme :error>` — reconfigures in place (same `EditorView`, folds/scroll/selection kept); focuses only on mount.
  - `<JsonViewer :raw :options :theme :custom-css? :source? @toggle-theme @open-settings>`; root `.jv-root.jv-dark|jv-light`; custom CSS rendered as a `<style>` text node inside the root.
  - `<ViewerToolbar v-model:mode :source :theme-type @toggle-theme @open-settings>`; buttons with accessible names `Toggle light/dark theme` and `Open settings`.
  - CSS: `.jv-page` (fixed full-page wrapper used by the content script); `.jv-root` fills its parent.

- [ ] **Step 1: Enable Vue in Vitest**

```bash
pnpm add -D @vitejs/plugin-vue@6.0.10
```

Replace `vitest.config.ts` with:

```ts
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [vue(), WxtVitest()],
  test: {
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
});
```

Run `pnpm test` — expected: all existing tests still pass.

- [ ] **Step 2: Failing component tests**

`src/components/CodeView.test.ts`:

```ts
// @vitest-environment happy-dom
import { foldAll } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, reactive, type App } from 'vue';
import type { ErrorLocation } from '@/editor/errorLine';
import { defaultTheme } from '@/themes/builtin';
import { defaultViewerOptions } from '@/viewer/options';
import CodeView from './CodeView.vue';

let app: App | undefined;
let host: HTMLElement | undefined;

function mount(doc: string, error: ErrorLocation | null = null) {
  host = document.createElement('div');
  document.body.append(host);
  const state = reactive({ doc, options: { ...defaultViewerOptions }, error });
  app = createApp({ render: () => h(CodeView, { doc: state.doc, options: state.options, theme: defaultTheme, error: state.error }) });
  app.mount(host);
  const editor = host.querySelector<HTMLElement>('.cm-editor')!;
  return { state, editor, view: EditorView.findFromDOM(editor)! };
}

afterEach(() => {
  app?.unmount();
  host?.remove();
  document.body.innerHTML = '';
});

describe('CodeView', () => {
  it('keeps the same editor and its folds when options change', async () => {
    const { state, editor, view } = mount('{\n  "a": [\n    1,\n    2\n  ]\n}');
    foldAll(view);
    expect(editor.querySelectorAll('.cm-foldPlaceholder').length).toBeGreaterThan(0);
    state.options = { ...state.options, lineNumbers: false };
    await nextTick();
    expect(host!.querySelector('.cm-editor')).toBe(editor);
    expect(editor.querySelector('.cm-lineNumbers')).toBeNull();
    expect(editor.querySelectorAll('.cm-foldPlaceholder').length).toBeGreaterThan(0);
  });

  it('focuses the editor on mount but not when options change', async () => {
    const { state, view } = mount('{"a": 1}');
    expect(document.activeElement).toBe(view.contentDOM);
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    state.options = { ...state.options, tabSize: 4 };
    await nextTick();
    expect(document.activeElement).toBe(input);
  });

  it('replaces the document when it changes', async () => {
    const { state, view } = mount('{"a": 1}');
    state.doc = '[1, 2]';
    await nextTick();
    expect(view.state.doc.toString()).toBe('[1, 2]');
  });

  it('puts the cursor on the error', () => {
    const { view } = mount('{\n  "a": 1,\n}', { line: 3, column: 1 });
    expect(view.state.selection.main.head).toBe(12);
  });
});
```

`src/components/JsonViewer.test.ts`:

```ts
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, type App } from 'vue';
import { defaultLightTheme, defaultTheme } from '@/themes/builtin';
import type { Theme } from '@/themes/types';
import { defaultViewerOptions } from '@/viewer/options';
import JsonViewer from './JsonViewer.vue';

let app: App | undefined;

function mount(props: { theme?: Theme; customCss?: string; onToggleTheme?: () => void; onOpenSettings?: () => void }) {
  const host = document.createElement('div');
  document.body.append(host);
  app = createApp({
    render: () => h(JsonViewer, { raw: '{"a":1}', options: defaultViewerOptions, theme: defaultTheme, ...props }),
  });
  app.mount(host);
  return host;
}

afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
});

describe('JsonViewer', () => {
  it('emits toggleTheme and openSettings from the toolbar', () => {
    const onToggleTheme = vi.fn();
    const onOpenSettings = vi.fn();
    const host = mount({ onToggleTheme, onOpenSettings });
    host.querySelector<HTMLButtonElement>('[aria-label="Toggle light/dark theme"]')!.click();
    host.querySelector<HTMLButtonElement>('[aria-label="Open settings"]')!.click();
    expect(onToggleTheme).toHaveBeenCalledOnce();
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it('injects custom CSS as text, never as markup', () => {
    const host = mount({ customCss: '.cm-content { color: red; } </style><img src=x onerror="alert(1)">' });
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('.jv-root > style')?.textContent).toContain('</style><img');
  });

  it('renders no style element without custom CSS', () => {
    expect(mount({}).querySelector('.jv-root > style')).toBeNull();
  });

  it('marks the root with the theme type', () => {
    expect(mount({ theme: defaultLightTheme }).querySelector('.jv-root')?.classList.contains('jv-light')).toBe(true);
  });
});
```

Run: `pnpm vitest run src/components`
Expected: FAIL — buttons missing, folds lost after option change, focus stolen.

- [ ] **Step 3: Rewrite `CodeView.vue`**

```vue
<script setup lang="ts">
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { errorPosition, type ErrorLocation } from '@/editor/errorLine';
import { buildExtensions } from '@/editor/setup';
import type { Theme } from '@/themes/types';
import type { ViewerOptions } from '@/viewer/options';

const props = defineProps<{
  doc: string;
  options: ViewerOptions;
  theme: Theme;
  error: ErrorLocation | null;
}>();

const host = ref<HTMLDivElement>();
const config = new Compartment();
let view: EditorView | undefined;

function currentExtensions() {
  return buildExtensions({ options: props.options, theme: props.theme, error: props.error });
}

function revealError(): void {
  if (!view || props.error === null) return;
  const position = errorPosition(view.state.doc, props.error);
  if (position === null) return;
  view.dispatch({
    selection: { anchor: position },
    effects: EditorView.scrollIntoView(position, { y: 'center', x: 'center' }),
  });
}

onMounted(() => {
  view = new EditorView({
    state: EditorState.create({ doc: props.doc, extensions: config.of(currentExtensions()) }),
    parent: host.value!,
  });
  revealError();
  // Without focus Ctrl+F opens the browser find, which misses virtualized content.
  view.focus();
});

watch(
  () => props.doc,
  (doc) => {
    if (!view) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: doc } });
  },
);

// Reconfigure in place so scroll position, folds and selection survive option and theme changes.
watch(
  () => [props.options, props.theme, props.error] as const,
  () => view?.dispatch({ effects: config.reconfigure(currentExtensions()) }),
);

watch(
  () => [props.doc, props.error] as const,
  () => revealError(),
  { flush: 'post' },
);

onBeforeUnmount(() => view?.destroy());
</script>

<template>
  <div ref="host" class="jv-code" />
</template>
```

- [ ] **Step 4: Rewrite `ViewerToolbar.vue` and `JsonViewer.vue`**

`src/components/ViewerToolbar.vue`:

```vue
<script setup lang="ts">
defineProps<{ source?: { url: string; loadedAt: Date }; themeType: 'dark' | 'light' }>();
const emit = defineEmits<{ toggleTheme: []; openSettings: [] }>();
const mode = defineModel<'code' | 'raw'>('mode', { required: true });
</script>

<template>
  <header class="jv-toolbar">
    <div class="jv-modes" role="tablist">
      <button type="button" role="tab" :aria-selected="mode === 'code'" @click="mode = 'code'">Code</button>
      <button type="button" role="tab" :aria-selected="mode === 'raw'" @click="mode = 'raw'">Raw</button>
    </div>
    <div v-if="source" class="jv-source" :title="source.url">
      <span class="jv-url">{{ source.url }}</span>
      <time :datetime="source.loadedAt.toISOString()">{{ source.loadedAt.toLocaleString() }}</time>
    </div>
    <div class="jv-actions">
      <button
        type="button"
        class="jv-icon-button"
        aria-label="Toggle light/dark theme"
        :title="themeType === 'dark' ? 'Switch to a light theme' : 'Switch to a dark theme'"
        @click="emit('toggleTheme')"
      >
        {{ themeType === 'dark' ? '☀' : '☾' }}
      </button>
      <button type="button" class="jv-icon-button" aria-label="Open settings" title="Settings" @click="emit('openSettings')">
        ⚙
      </button>
    </div>
  </header>
</template>
```

`src/components/JsonViewer.vue`:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import CodeView from './CodeView.vue';
import ViewerToolbar from './ViewerToolbar.vue';
import { toCssVars } from '@/themes/css';
import { resolveColors } from '@/themes/resolve';
import type { Theme } from '@/themes/types';
import type { ViewerOptions } from '@/viewer/options';
import { prepareDocument } from '@/viewer/prepare';

const props = withDefaults(
  defineProps<{
    raw: string;
    options: ViewerOptions;
    theme: Theme;
    customCss?: string;
    source?: { url: string; loadedAt: Date };
  }>(),
  { customCss: '', source: undefined },
);
const emit = defineEmits<{ toggleTheme: []; openSettings: [] }>();

// Primitive computeds only notify when their value changes, so replacing the options
// object with unrelated changes (e.g. lineNumbers) doesn't re-run the formatter.
const tabSize = computed(() => props.options.tabSize);
const sortKeys = computed(() => props.options.sortKeys);
const indentCStyle = computed(() => props.options.indentCStyle);
const prepared = computed(() =>
  prepareDocument(props.raw, { tabSize: tabSize.value, sortKeys: sortKeys.value, indentCStyle: indentCStyle.value }),
);
const cssVars = computed(() => toCssVars(resolveColors(props.theme)));
// autoHighlight=false starts on Raw; the Code tab still formats on demand.
const mode = ref<'code' | 'raw'>(props.options.autoHighlight ? 'code' : 'raw');
</script>

<template>
  <div class="jv-root" :class="`jv-${theme.type}`" :style="cssVars">
    <component :is="'style'" v-if="customCss">{{ customCss }}</component>
    <ViewerToolbar
      v-model:mode="mode"
      :source="options.showHeader ? source : undefined"
      :theme-type="theme.type"
      @toggle-theme="emit('toggleTheme')"
      @open-settings="emit('openSettings')"
    />
    <div v-if="!prepared.ok" class="jv-error" role="alert">
      {{ prepared.error.message
      }}<template v-if="prepared.error.line !== null">
        — line {{ prepared.error.line }}, column {{ prepared.error.column }}</template
      >
    </div>
    <CodeView
      v-if="mode === 'code'"
      class="jv-body"
      :doc="prepared.text"
      :options="options"
      :theme="theme"
      :error="prepared.ok ? null : prepared.error"
    />
    <pre v-else class="jv-body jv-raw">{{ raw }}</pre>
  </div>
</template>
```

- [ ] **Step 5: Move and update the stylesheet**

Create `src/components/viewer.css` with the full content of `src/entrypoints/viewer.content/style.css`, then delete the old file (`git rm src/entrypoints/viewer.content/style.css`). In the new file:

1. Replace the `.jv-root { … }` rule's first three declarations `position: fixed; inset: 0; z-index: 2147483647;` with `height: 100%; min-height: 0;` (keep every other declaration of that rule).
2. Replace the `.jv-error { … }` rule with:

```css
.jv-error {
  padding: 6px 10px;
  border-bottom: 1px solid var(--jv-border);
}

.jv-dark .jv-error {
  background: #5a1d1d;
  color: #ffd7d7;
}

.jv-light .jv-error {
  background: #fde7e9;
  color: #a1260d;
}
```

3. Append:

```css
/* Full-page container used by the content script; the options preview embeds .jv-root directly. */
.jv-page {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
}

.jv-page > .jv-root {
  flex: 1;
}

.jv-source time {
  white-space: nowrap;
}

.jv-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}

.jv-icon-button {
  width: 26px;
  height: 24px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}

.jv-icon-button:hover,
.jv-icon-button:focus-visible {
  border-color: var(--jv-border);
}
```

In `src/entrypoints/viewer.content/index.ts`: change `import './style.css';` to `import '@/components/viewer.css';`, add `h` to the `vue` import, and replace `const app = createApp(JsonViewer, { … });` with:

```ts
          const app = createApp({
            render: () =>
              h('div', { class: 'jv-page' }, [
                h(JsonViewer, {
                  raw,
                  options: defaultViewerOptions,
                  theme: defaultTheme,
                  source: { url: location.href, loadedAt: new Date() },
                }),
              ]),
          });
```

(Task 8 replaces this wiring with live settings.)

- [ ] **Step 6: Verify**

Run: `pnpm test`, `pnpm compile`, `pnpm test:e2e`
Expected: all unit tests (incl. the new component tests) pass; all 14 e2e pass. If happy-dom cannot move focus into CodeMirror's content element, report NEEDS_CONTEXT with the failing output instead of weakening the focus assertion.

- [ ] **Step 7: Commit**

```bash
git add -A src/components src/entrypoints/viewer.content vitest.config.ts package.json pnpm-lock.yaml
git commit -m "feat(viewer): reconfigure the editor in place and add theme toggle, settings button and custom CSS"
```

---

### Task 8: Live settings and themes in the viewer

**Files:**
- Modify: `src/messages.ts`, `src/messages.test.ts`, `src/entrypoints/background.ts`, `src/entrypoints/viewer.content/index.ts`, `e2e/fixtures.ts`
- Create: `e2e/storage.ts`, `e2e/settings.spec.ts`

**Interfaces:**
- Consumes: `loadSettings`, `watchSettings`, `customCssItem` (Task 2); `listCustomThemes`, `watchCustomThemes`, `activeTheme`, `ThemeKind` (Task 6); `JsonViewer` events (Task 7).
- Produces: `OPEN_OPTIONS = 'open-options'`, `interface OpenOptionsMessage { type: 'open-options' }`, `isOpenOptionsMessage(value: unknown): value is OpenOptionsMessage`; e2e helper `setStorage(context, area: 'sync' | 'local', items)`; e2e contexts default to `colorScheme: 'dark'`.

- [ ] **Step 1: Messages (TDD)**

Add to `src/messages.test.ts`:

```ts
import { isOpenOptionsMessage, OPEN_OPTIONS } from './messages';

describe('isOpenOptionsMessage', () => {
  it('accepts the open-options message only', () => {
    expect(isOpenOptionsMessage({ type: OPEN_OPTIONS })).toBe(true);
    expect(isOpenOptionsMessage({ type: 'json-detected' })).toBe(false);
    expect(isOpenOptionsMessage(undefined)).toBe(false);
  });
});
```

(merge the import into the file's existing import line.) Run `pnpm vitest run src/messages.test.ts` — expected FAIL. Then append to `src/messages.ts`:

```ts
export const OPEN_OPTIONS = 'open-options';

export interface OpenOptionsMessage {
  type: typeof OPEN_OPTIONS;
}

export function isOpenOptionsMessage(value: unknown): value is OpenOptionsMessage {
  return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === OPEN_OPTIONS;
}
```

Run again — expected PASS.

In `src/entrypoints/background.ts` import `isOpenOptionsMessage` alongside `isJsonDetectedMessage` and make the listener's first statements:

```ts
    if (isOpenOptionsMessage(message)) {
      void browser.runtime.openOptionsPage();
      return;
    }
```

- [ ] **Step 2: e2e harness changes**

In `e2e/fixtures.ts`, add `colorScheme: 'dark',` to the `chromium.launchPersistentContext('', { … })` options (existing Dark+ expectations rely on it; Playwright defaults to light).

Create `e2e/storage.ts`:

```ts
import type { BrowserContext } from '@playwright/test';

type StorageArea = 'sync' | 'local';
type ChromeStorage = { storage: Record<StorageArea, { set(items: Record<string, unknown>): Promise<void> }> };

/** Writes raw chrome.storage items from the extension's service worker (keys without WXT's "sync:"/"local:" prefix). */
export async function setStorage(context: BrowserContext, area: StorageArea, items: Record<string, unknown>): Promise<void> {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  await worker.evaluate(
    ([target, values]) => (globalThis as unknown as { chrome: ChromeStorage }).chrome.storage[target].set(values),
    [area, items] as const,
  );
}
```

- [ ] **Step 3: Failing e2e**

`e2e/settings.spec.ts`:

```ts
import { expect, test } from './fixtures';
import { setStorage } from './storage';

const viewer = 'json-viewer-app';
const darkTheme = { type: 'dark', source: 'custom' };

test.beforeEach(async ({ extensionId }) => {
  expect(extensionId).toMatch(/^[a-p]{32}$/);
});

test('applies the configured light theme', async ({ context, server }) => {
  await setStorage(context, 'sync', { settings: { themeMode: 'light' } });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .jv-root`)).toHaveClass(/jv-light/);
  await expect(page.locator(`${viewer} .jv-root`)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('follows the system color scheme in auto mode, live', async ({ context, server }) => {
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .jv-root`)).toHaveClass(/jv-light/);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator(`${viewer} .jv-root`)).toHaveClass(/jv-dark/);
});

test('updates an open viewer when settings change', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const secondLine = page.locator(`${viewer} .cm-line`).nth(1);
  await expect.poll(() => secondLine.evaluate((el) => el.textContent)).toMatch(/^ {2}"name"/);
  await setStorage(context, 'sync', { settings: { viewer: { tabSize: 4 } } });
  await expect.poll(() => secondLine.evaluate((el) => el.textContent)).toMatch(/^ {4}"name"/);
});

test('the toolbar toggles light/dark for this tab', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .jv-root`)).toHaveClass(/jv-dark/);
  await page.getByRole('button', { name: 'Toggle light/dark theme' }).click();
  await expect(page.locator(`${viewer} .jv-root`)).toHaveClass(/jv-light/);
});

test('applies custom CSS', async ({ context, server }) => {
  await setStorage(context, 'local', { customCss: '.cm-content { letter-spacing: 3px; }' });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toHaveCSS('letter-spacing', '3px');
});

test('uses a custom theme from storage', async ({ context, server }) => {
  await setStorage(context, 'sync', {
    settings: { themeMode: 'dark', darkThemeId: 'mine' },
    customThemeIds: ['mine'],
    'customTheme:mine': { id: 'mine', name: 'Mine', ...darkTheme, colors: { background: '#101010', foreground: '#eeeeee', key: '#ff0000' } },
  });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const keyLine = page.locator(`${viewer} .cm-line`, { hasText: '"name"' });
  await expect(keyLine.locator('span').first()).toHaveCSS('color', 'rgb(255, 0, 0)');
  await expect(page.locator(`${viewer} .jv-root`)).toHaveCSS('background-color', 'rgb(16, 16, 16)');
});

test('falls back to Dark+ when the selected theme is missing', async ({ context, server }) => {
  await setStorage(context, 'sync', { settings: { themeMode: 'dark', darkThemeId: 'ghost' } });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const keyLine = page.locator(`${viewer} .cm-line`, { hasText: '"name"' });
  await expect(keyLine.locator('span').first()).toHaveCSS('color', 'rgb(156, 220, 254)');
});

test('renders with defaults when stored settings are garbage', async ({ context, server }) => {
  await setStorage(context, 'sync', { settings: 'not an object', customThemeIds: 7 });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name": "x"');
});
```

Run: `pnpm test:e2e`
Expected: the new tests FAIL (viewer still uses hard-coded defaults); the previous 14 still pass.

- [ ] **Step 4: Wire the viewer entry**

Replace `src/entrypoints/viewer.content/index.ts` with:

```ts
import '@/components/viewer.css';
import { browser } from 'wxt/browser';
import { computed, createApp, h, reactive } from 'vue';
import JsonViewer from '@/components/JsonViewer.vue';
import { readRawText } from '@/detect/readRawText';
import { OPEN_OPTIONS, type OpenOptionsMessage } from '@/messages';
import { customCssItem, loadSettings, watchSettings } from '@/settings/storage';
import { activeTheme, type ThemeKind } from '@/themes/active';
import { listCustomThemes, watchCustomThemes } from '@/themes/store';
import { hideOriginal } from '@/viewer/hideOriginal';

const GUARD = 'data-json-viewer';

export default defineContentScript({
  matches: ['<all_urls>'],
  // Avoid broadcasting the extension ID to every page via window.postMessage.
  noScriptStartedPostMessage: true,
  registration: 'runtime',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const root = document.documentElement;
    const body = document.body;
    if (!body || root.hasAttribute(GUARD)) return;
    const raw = readRawText(document);
    if (raw === null) return;
    root.setAttribute(GUARD, '');

    let restore: (() => void) | undefined;
    let ui: Awaited<ReturnType<typeof createShadowRootUi>> | undefined;
    let failed = false;
    const fail = (error: unknown): void => {
      if (failed) return;
      failed = true;
      restore?.();
      ui?.remove();
      root.removeAttribute(GUARD);
      console.warn('[json-viewer] viewer failed to render', error);
    };

    try {
      const [settings, customCss, customThemes] = await Promise.all([
        loadSettings(),
        customCssItem.getValue(),
        listCustomThemes(),
      ]);
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const state = reactive({
        settings,
        customCss,
        customThemes,
        prefersDark: media.matches,
        override: null as ThemeKind | null,
      });
      const theme = computed(() => activeTheme(state.settings, state.customThemes, state.prefersDark, state.override));
      const source = { url: location.href, loadedAt: new Date() };

      const onMediaChange = (event: MediaQueryListEvent) => {
        state.prefersDark = event.matches;
      };
      media.addEventListener('change', onMediaChange);
      const stops = [
        watchSettings((value) => {
          state.settings = value;
        }),
        customCssItem.watch((value) => {
          state.customCss = value ?? '';
        }),
        watchCustomThemes(() => {
          void listCustomThemes().then((list) => {
            state.customThemes = list;
          });
        }),
        () => media.removeEventListener('change', onMediaChange),
      ];
      ctx.onInvalidated(() => stops.forEach((stop) => stop()));

      const openSettings = () => {
        const message: OpenOptionsMessage = { type: OPEN_OPTIONS };
        void browser.runtime.sendMessage(message).catch(() => {});
      };

      ui = await createShadowRootUi(ctx, {
        name: 'json-viewer-app',
        position: 'inline',
        anchor: 'body',
        onMount(container) {
          const app = createApp({
            render: () =>
              h('div', { class: 'jv-page' }, [
                h(JsonViewer, {
                  raw,
                  options: state.settings.viewer,
                  theme: theme.value,
                  customCss: state.customCss,
                  source,
                  onToggleTheme: () => {
                    state.override = theme.value.type === 'dark' ? 'light' : 'dark';
                  },
                  onOpenSettings: openSettings,
                }),
              ]),
          });
          app.config.errorHandler = fail;
          app.mount(container);
          return app;
        },
        onRemove(app) {
          app?.unmount();
        },
      });
      // Hide (don't remove) the browser's rendering so the original stays recoverable.
      restore = hideOriginal(body);
      ui.mount();
    } catch (error) {
      fail(error);
    }
  },
});
```

- [ ] **Step 5: Verify**

Run: `pnpm test`, `pnpm compile`, `pnpm test:e2e`
Expected: all pass (14 + 8 e2e). Check `.output/chrome-mv3/content-scripts/viewer.js` still has 0 non-ASCII bytes (`LC_ALL=C grep -c -P '[^\x00-\x7F]' …` prints 0) and `detector.js` ≤ 8192 bytes.

- [ ] **Step 6: Commit**

```bash
git add src/messages.ts src/messages.test.ts src/entrypoints e2e
git commit -m "feat(viewer): apply stored settings, themes and custom CSS live"
```

---

### Task 9: Options page — shell, behavior, structure, advanced, live preview

**Files:**
- Create: `src/entrypoints/options/index.html`, `src/entrypoints/options/main.ts`, `src/entrypoints/options/App.vue`, `src/options/types.ts`, `src/options/sample.ts`, `src/options/useSettings.ts`, `src/options/useCustomThemes.ts`, `src/options/options.css`, `src/options/fields/ToggleField.vue`, `src/options/fields/NumberField.vue`, `src/options/fields/SelectField.vue`, `src/options/sections/BehaviorSection.vue`, `src/options/sections/StructureSection.vue`, `src/options/sections/AdvancedSection.vue`, `src/options/sections/AboutSection.vue`, `src/options/PreviewPane.vue`, `src/options/CssEditor.vue`
- Modify: `package.json` (`@codemirror/lang-css`)
- Test: `src/options/useSettings.test.ts`, `e2e/options.spec.ts`

**Interfaces:**
- Consumes: `Settings`, `defaultSettings`, `loadSettings`, `saveSettings`, `customCssItem`, `TAB_SIZE_MIN`, `TAB_SIZE_MAX` (Task 2); `listCustomThemes`, `watchCustomThemes` (Task 6); `activeTheme`, `ThemeKind` (Task 6); `JsonViewer` (Task 7).
- Produces:
  - `SAVE_DELAY_MS = 300`; `useSettings(): { settings: Ref<Settings>; customCss: Ref<string>; loaded: Ref<boolean>; reset(): void }` (debounced, skips unchanged writes)
  - `useCustomThemes(): { customThemes: Ref<Theme[]> }`
  - `interface SelectOption { value: string; label: string; group?: string }`
  - `<ToggleField v-model label hint?>` (checkbox with `role="switch"`), `<NumberField v-model label min max hint?>`, `<SelectField v-model label options hint?>`
  - `<PreviewPane :settings :custom-css :custom-themes :theme-override?>`
  - Options page at `options.html`, opened in a tab; App sections have ids `behavior`, `structure`, `advanced`, `about` (Task 10 adds `appearance`).

- [ ] **Step 1: Install**

```bash
pnpm add @codemirror/lang-css@6.3.1
```

- [ ] **Step 2: Failing unit test for the debounced saver**

`src/options/useSettings.test.ts`:

```ts
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { defaultSettings } from '@/settings/schema';
import { SAVE_DELAY_MS, useSettings } from './useSettings';

let app: App | undefined;

async function mountModel() {
  let model!: ReturnType<typeof useSettings>;
  app = createApp({
    setup() {
      model = useSettings();
      return () => null;
    },
  });
  app.mount(document.createElement('div'));
  await vi.waitFor(() => expect(model.loaded.value).toBe(true));
  return model;
}

describe('useSettings', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    app?.unmount();
    vi.useRealTimers();
  });

  it('loads stored settings', async () => {
    await fakeBrowser.storage.sync.set({ settings: { themeMode: 'dark' } });
    const model = await mountModel();
    expect(model.settings.value.themeMode).toBe('dark');
  });

  // WXT may also write version metadata ("settings$"), so count only writes of the settings value.
  const settingsWrites = (set: { mock: { calls: unknown[][] } }) =>
    set.mock.calls.filter(([items]) => typeof items === 'object' && items !== null && 'settings' in items).length;

  it('debounces many quick edits into one sync write', async () => {
    const model = await mountModel();
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set');
    for (let size = 1; size <= 8; size++) {
      model.settings.value.viewer.tabSize = size;
      await nextTick();
      vi.advanceTimersByTime(50);
    }
    expect(settingsWrites(set)).toBe(0);
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    await vi.waitFor(() => expect(settingsWrites(set)).toBe(1));
    expect((await fakeBrowser.storage.sync.get('settings')).settings).toMatchObject({ viewer: { tabSize: 8 } });
  });

  it('does not write when nothing changed', async () => {
    const model = await mountModel();
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set');
    model.settings.value.viewer.tabSize = 4;
    await nextTick();
    model.settings.value.viewer.tabSize = defaultSettings.viewer.tabSize;
    await nextTick();
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    await Promise.resolve();
    expect(settingsWrites(set)).toBe(0);
  });

  it('saves custom CSS to local storage and resets to defaults', async () => {
    const model = await mountModel();
    model.customCss.value = '.cm-content { color: red; }';
    model.settings.value.themeMode = 'light';
    await nextTick();
    vi.advanceTimersByTime(SAVE_DELAY_MS);
    await vi.waitFor(async () =>
      expect((await fakeBrowser.storage.local.get('customCss')).customCss).toBe('.cm-content { color: red; }'),
    );
    model.reset();
    expect(model.settings.value).toEqual(defaultSettings);
    expect(model.customCss.value).toBe('');
  });
});
```

Run: `pnpm vitest run src/options`
Expected: FAIL — `Failed to resolve import "./useSettings"`.

- [ ] **Step 3: Composables and shared bits**

`src/options/useSettings.ts`:

```ts
import { onMounted, ref, watch, type Ref } from 'vue';
import { defaultSettings, type Settings } from '@/settings/schema';
import { customCssItem, loadSettings, saveSettings } from '@/settings/storage';

// storage.sync allows ~120 writes per minute; typing in a field must not burst past that.
export const SAVE_DELAY_MS = 300;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

export interface SettingsModel {
  settings: Ref<Settings>;
  customCss: Ref<string>;
  loaded: Ref<boolean>;
  reset(): void;
}

export function useSettings(): SettingsModel {
  const settings = ref<Settings>(clone(defaultSettings));
  const customCss = ref('');
  const loaded = ref(false);
  let savedSettings = '';
  let savedCss = '';

  const flushSettings = debounce(() => {
    const json = JSON.stringify(settings.value);
    if (json === savedSettings) return;
    savedSettings = json;
    void saveSettings(JSON.parse(json) as Settings);
  }, SAVE_DELAY_MS);
  const flushCss = debounce(() => {
    if (customCss.value === savedCss) return;
    savedCss = customCss.value;
    void customCssItem.setValue(savedCss);
  }, SAVE_DELAY_MS);

  onMounted(async () => {
    settings.value = await loadSettings();
    customCss.value = await customCssItem.getValue();
    savedSettings = JSON.stringify(settings.value);
    savedCss = customCss.value;
    loaded.value = true;
  });

  watch(settings, () => loaded.value && flushSettings(), { deep: true });
  watch(customCss, () => loaded.value && flushCss());

  return {
    settings,
    customCss,
    loaded,
    reset() {
      settings.value = clone(defaultSettings);
      customCss.value = '';
    },
  };
}
```

`src/options/useCustomThemes.ts`:

```ts
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { listCustomThemes, watchCustomThemes } from '@/themes/store';
import type { Theme } from '@/themes/types';

export function useCustomThemes(): { customThemes: Ref<Theme[]> } {
  const customThemes = ref<Theme[]>([]);
  const reload = async () => {
    customThemes.value = await listCustomThemes();
  };
  let stop: (() => void) | undefined;
  onMounted(() => {
    void reload();
    stop = watchCustomThemes(() => void reload());
  });
  onBeforeUnmount(() => stop?.());
  return { customThemes };
}
```

`src/options/types.ts`:

```ts
export interface SelectOption {
  value: string;
  label: string;
  group?: string;
}
```

`src/options/sample.ts`:

```ts
export const SAMPLE_URL = 'https://api.example.com/users/7';

// Same spirit as the original extension's options sample, plus every token kind.
export const SAMPLE_JSON =
  '{"title":"JSON Example","homepage":"https://github.com/tulios/json-viewer","nested":{"someInteger":7,"someFloat":3.14,"someBoolean":true,"someNull":null,"someArray":["list of","fake strings","and fake keys"],"bigId":12345678901234567890}}';
```

Run `pnpm vitest run src/options` — expected PASS.

- [ ] **Step 4: Field components**

`src/options/fields/ToggleField.vue`:

```vue
<script setup lang="ts">
defineProps<{ label: string; hint?: string }>();
const model = defineModel<boolean>({ required: true });
</script>

<template>
  <label class="opt-field opt-toggle">
    <input v-model="model" type="checkbox" role="switch" />
    <span class="opt-label">{{ label }}</span>
    <small v-if="hint" class="opt-hint">{{ hint }}</small>
  </label>
</template>
```

`src/options/fields/NumberField.vue`:

```vue
<script setup lang="ts">
const props = defineProps<{ label: string; min: number; max: number; hint?: string }>();
const model = defineModel<number>({ required: true });

function onChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  model.value = Number.isFinite(value) ? Math.min(props.max, Math.max(props.min, Math.round(value))) : props.min;
  input.value = String(model.value);
}
</script>

<template>
  <label class="opt-field">
    <span class="opt-label">{{ label }}</span>
    <input type="number" :min="min" :max="max" :value="model" @change="onChange" />
    <small v-if="hint" class="opt-hint">{{ hint }}</small>
  </label>
</template>
```

`src/options/fields/SelectField.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import type { SelectOption } from '../types';

const props = defineProps<{ label: string; options: SelectOption[]; hint?: string }>();
const model = defineModel<string>({ required: true });

const groups = computed(() => {
  const map = new Map<string, SelectOption[]>();
  for (const option of props.options) {
    const group = option.group ?? '';
    map.set(group, [...(map.get(group) ?? []), option]);
  }
  return [...map.entries()];
});
</script>

<template>
  <label class="opt-field">
    <span class="opt-label">{{ label }}</span>
    <select v-model="model">
      <template v-for="[group, items] in groups" :key="group">
        <optgroup v-if="group" :label="group">
          <option v-for="option in items" :key="option.value" :value="option.value">{{ option.label }}</option>
        </optgroup>
        <template v-else>
          <option v-for="option in items" :key="option.value" :value="option.value">{{ option.label }}</option>
        </template>
      </template>
    </select>
    <small v-if="hint" class="opt-hint">{{ hint }}</small>
  </label>
</template>
```

- [ ] **Step 5: Sections, CSS editor and preview**

`src/options/sections/BehaviorSection.vue`:

```vue
<script setup lang="ts">
import ToggleField from '../fields/ToggleField.vue';
import type { ViewerOptions } from '@/viewer/options';

defineProps<{ viewer: ViewerOptions }>();
</script>

<template>
  <section id="behavior" class="opt-section">
    <h2>Behavior</h2>
    <ToggleField v-model="viewer.showHeader" label="Show URL and load time in the toolbar" />
    <ToggleField v-model="viewer.autoHighlight" label="Format JSON automatically" hint="When off, pages open on the Raw tab." />
    <ToggleField v-model="viewer.sortKeys" label="Sort object keys" />
    <ToggleField v-model="viewer.clickableUrls" label="Make URLs clickable" />
    <ToggleField
      v-model="viewer.wrapLinkWithAnchorTag"
      label="Render URLs as real links"
      hint="Enables right-click › Copy link address."
    />
    <ToggleField v-model="viewer.openLinksInNewWindow" label="Open links in a new tab" />
  </section>
</template>
```

`src/options/sections/StructureSection.vue`:

```vue
<script setup lang="ts">
import NumberField from '../fields/NumberField.vue';
import ToggleField from '../fields/ToggleField.vue';
import { TAB_SIZE_MAX, TAB_SIZE_MIN } from '@/settings/schema';
import type { ViewerOptions } from '@/viewer/options';

defineProps<{ viewer: ViewerOptions }>();
</script>

<template>
  <section id="structure" class="opt-section">
    <h2>Structure</h2>
    <NumberField v-model="viewer.tabSize" label="Indent size (spaces)" :min="TAB_SIZE_MIN" :max="TAB_SIZE_MAX" />
    <ToggleField v-model="viewer.lineNumbers" label="Show line numbers" />
    <ToggleField v-model="viewer.lineWrapping" label="Wrap long lines" />
    <ToggleField v-model="viewer.foldGutter" label="Show fold arrows" />
    <ToggleField v-model="viewer.showArraySize" label="Show item counts on folded blocks" />
    <ToggleField v-model="viewer.indentCStyle" label="C-style braces" hint="Opening braces on their own line." />
  </section>
</template>
```

`src/options/CssEditor.vue`:

```vue
<script setup lang="ts">
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { css } from '@codemirror/lang-css';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const model = defineModel<string>({ required: true });
const host = ref<HTMLDivElement>();
let view: EditorView | undefined;

onMounted(() => {
  view = new EditorView({
    parent: host.value!,
    state: EditorState.create({
      doc: model.value,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        css(),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ 'aria-label': 'Custom CSS' }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) model.value = update.state.doc.toString();
        }),
      ],
    }),
  });
});

watch(model, (value) => {
  if (view && value !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }
});

onBeforeUnmount(() => view?.destroy());
</script>

<template>
  <div ref="host" class="opt-css" />
</template>
```

`src/options/sections/AdvancedSection.vue`:

```vue
<script setup lang="ts">
import CssEditor from '../CssEditor.vue';

const customCss = defineModel<string>('customCss', { required: true });
</script>

<template>
  <section id="advanced" class="opt-section">
    <h2>Advanced</h2>
    <p class="opt-hint">
      Custom CSS for the viewer. Useful selectors: <code>.jv-root</code>, <code>.jv-toolbar</code>,
      <code>.cm-editor</code>, <code>.cm-content</code>, <code>.cm-line</code>. Variables:
      <code>--jv-font-family</code>, <code>--jv-font-size</code>, <code>--jv-line-height</code> and the theme colors
      <code>--jv-key</code>, <code>--jv-string</code>, <code>--jv-background</code>…
    </p>
    <CssEditor v-model="customCss" />
  </section>
</template>
```

`src/options/sections/AboutSection.vue`:

```vue
<script setup lang="ts">
import { browser } from 'wxt/browser';

const version = browser.runtime.getManifest().version;
</script>

<template>
  <section id="about" class="opt-section">
    <h2>About</h2>
    <p>JSON Viewer {{ version }} — inspired by <a href="https://github.com/tulios/json-viewer" target="_blank" rel="noopener">tulios/json-viewer</a>.</p>
    <p class="opt-hint">Built-in themes are converted from VS Code themes via tm-themes; see their licenses in the repository.</p>
  </section>
</template>
```

`src/options/PreviewPane.vue`:

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { SAMPLE_JSON, SAMPLE_URL } from './sample';
import JsonViewer from '@/components/JsonViewer.vue';
import type { Settings } from '@/settings/schema';
import { activeTheme, type ThemeKind } from '@/themes/active';
import type { Theme } from '@/themes/types';

const props = defineProps<{
  settings: Settings;
  customCss: string;
  customThemes: Theme[];
  themeOverride?: Theme | null;
}>();

const media = window.matchMedia('(prefers-color-scheme: dark)');
const prefersDark = ref(media.matches);
const override = ref<ThemeKind | null>(null);
const onMediaChange = (event: MediaQueryListEvent) => {
  prefersDark.value = event.matches;
};
onMounted(() => media.addEventListener('change', onMediaChange));
onBeforeUnmount(() => media.removeEventListener('change', onMediaChange));

const theme = computed(
  () => props.themeOverride ?? activeTheme(props.settings, props.customThemes, prefersDark.value, override.value),
);
const source = { url: SAMPLE_URL, loadedAt: new Date() };

function toggleTheme(): void {
  override.value = theme.value.type === 'dark' ? 'light' : 'dark';
}
</script>

<template>
  <div class="opt-preview-frame">
    <!-- autoHighlight only sets the initial tab, so remount when it changes. -->
    <JsonViewer
      :key="String(settings.viewer.autoHighlight)"
      :raw="SAMPLE_JSON"
      :options="settings.viewer"
      :theme="theme"
      :custom-css="customCss"
      :source="source"
      @toggle-theme="toggleTheme"
    />
  </div>
</template>
```

- [ ] **Step 6: Entry point, App and styles**

`src/entrypoints/options/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>JSON Viewer Settings</title>
    <meta name="manifest.open_in_tab" content="true" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

`src/entrypoints/options/main.ts`:

```ts
import '@/components/viewer.css';
import '@/options/options.css';
import { createApp } from 'vue';
import App from './App.vue';

createApp(App).mount('#app');
```

`src/entrypoints/options/App.vue`:

```vue
<script setup lang="ts">
import AboutSection from '@/options/sections/AboutSection.vue';
import AdvancedSection from '@/options/sections/AdvancedSection.vue';
import BehaviorSection from '@/options/sections/BehaviorSection.vue';
import StructureSection from '@/options/sections/StructureSection.vue';
import PreviewPane from '@/options/PreviewPane.vue';
import { useCustomThemes } from '@/options/useCustomThemes';
import { useSettings } from '@/options/useSettings';

const { settings, customCss, loaded, reset } = useSettings();
const { customThemes } = useCustomThemes();

function onReset(): void {
  if (window.confirm('Reset all settings to their defaults? Custom themes are kept.')) reset();
}
</script>

<template>
  <div class="opt-app">
    <aside class="opt-nav">
      <h1 class="opt-title"><img src="/icons/48.png" alt="" width="24" height="24" /> JSON Viewer</h1>
      <nav aria-label="Sections">
        <a href="#behavior">Behavior</a>
        <a href="#structure">Structure</a>
        <a href="#advanced">Advanced</a>
        <a href="#about">About</a>
      </nav>
      <button type="button" class="opt-reset" @click="onReset">Reset to defaults</button>
    </aside>
    <main v-if="loaded" class="opt-main">
      <BehaviorSection :viewer="settings.viewer" />
      <StructureSection :viewer="settings.viewer" />
      <AdvancedSection v-model:custom-css="customCss" />
      <AboutSection />
    </main>
    <section class="opt-preview" aria-label="Live preview">
      <PreviewPane :settings="settings" :custom-css="customCss" :custom-themes="customThemes" />
    </section>
  </div>
</template>
```

`src/options/options.css`:

```css
:root {
  color-scheme: light dark;
  --opt-bg: #ffffff;
  --opt-fg: #1f2328;
  --opt-muted: #59636e;
  --opt-panel: #f6f8fa;
  --opt-border: #d1d9e0;
  --opt-accent: #0969da;
  --opt-danger: #d1242f;
  --opt-success: #1a7f37;
}

@media (prefers-color-scheme: dark) {
  :root {
    --opt-bg: #0d1117;
    --opt-fg: #e6edf3;
    --opt-muted: #9198a1;
    --opt-panel: #151b23;
    --opt-border: #3d444d;
    --opt-accent: #4493f8;
    --opt-danger: #f85149;
    --opt-success: #3fb950;
  }
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  height: 100%;
  background: var(--opt-bg);
  color: var(--opt-fg);
  font: 14px/1.5 system-ui, sans-serif;
}

.opt-app {
  display: grid;
  grid-template-columns: 200px minmax(340px, 1fr) minmax(360px, 1fr);
  height: 100vh;
}

.opt-nav {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 16px;
  border-right: 1px solid var(--opt-border);
  background: var(--opt-panel);
}

.opt-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
}

.opt-nav nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.opt-nav a {
  padding: 4px 8px;
  border-radius: 6px;
  color: inherit;
  text-decoration: none;
}

.opt-nav a:hover {
  background: var(--opt-border);
}

.opt-reset {
  margin-top: auto;
}

.opt-main {
  overflow: auto;
  padding: 8px 24px 48px;
}

.opt-section {
  padding: 16px 0;
  border-bottom: 1px solid var(--opt-border);
}

.opt-section h2 {
  margin: 0 0 12px;
  font-size: 18px;
}

.opt-section h3 {
  margin: 16px 0 8px;
  font-size: 15px;
}

.opt-field {
  display: grid;
  gap: 4px;
  margin: 10px 0;
}

.opt-toggle {
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: 10px;
}

.opt-toggle .opt-hint {
  grid-column: 2;
}

.opt-label {
  font-weight: 500;
}

.opt-hint {
  color: var(--opt-muted);
  font-size: 12px;
}

.opt-field input[type='number'],
.opt-field input[type='text'],
.opt-field select,
.opt-field textarea {
  width: 100%;
  max-width: 420px;
  padding: 6px 8px;
  border: 1px solid var(--opt-border);
  border-radius: 6px;
  background: var(--opt-bg);
  color: inherit;
  font: inherit;
}

.opt-field textarea {
  max-width: none;
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-size: 12px;
}

button {
  padding: 6px 12px;
  border: 1px solid var(--opt-border);
  border-radius: 6px;
  background: var(--opt-panel);
  color: inherit;
  font: inherit;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.opt-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.opt-css {
  border: 1px solid var(--opt-border);
  border-radius: 6px;
  overflow: hidden;
}

.opt-css .cm-editor {
  min-height: 160px;
  max-height: 360px;
}

.opt-preview {
  display: flex;
  min-width: 0;
  padding: 16px;
  border-left: 1px solid var(--opt-border);
}

.opt-preview-frame {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--opt-border);
  border-radius: 8px;
}

.opt-errors {
  color: var(--opt-danger);
}

.opt-success {
  color: var(--opt-success);
}

.opt-warnings {
  color: var(--opt-muted);
}

@media (max-width: 960px) {
  .opt-app {
    grid-template-columns: 1fr;
    height: auto;
  }

  .opt-nav {
    border-right: none;
  }

  .opt-preview {
    height: 420px;
    border-left: none;
  }
}
```

- [ ] **Step 7: e2e**

`e2e/options.spec.ts`:

```ts
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const viewer = 'json-viewer-app';

async function openOptions(page: Page, extensionId: string): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByRole('heading', { name: 'Behavior' })).toBeVisible();
}

test('a behavior change reaches an open viewer', async ({ context, server, extensionId }) => {
  const viewerPage = await context.newPage();
  await viewerPage.goto(server.url('/data.json'));
  await expect(viewerPage.locator(`${viewer} .jv-url`)).toBeVisible();
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByRole('switch', { name: 'Show URL and load time in the toolbar' }).uncheck();
  await expect(viewerPage.locator(`${viewer} .jv-url`)).toHaveCount(0);
});

test('the preview follows the indent size', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  const secondLine = options.locator('.opt-preview .cm-line').nth(1);
  await expect.poll(() => secondLine.evaluate((el) => el.textContent)).toMatch(/^ {2}"title"/);
  await options.getByLabel('Indent size (spaces)').fill('4');
  await options.getByLabel('Indent size (spaces)').press('Tab');
  await expect.poll(() => secondLine.evaluate((el) => el.textContent)).toMatch(/^ {4}"title"/);
});

test('turning off automatic formatting opens pages on Raw', async ({ context, server, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByRole('switch', { name: 'Format JSON automatically' }).uncheck();
  await expect(options.locator('.opt-preview .jv-raw')).toBeVisible();
  await options.waitForTimeout(500);
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .jv-raw`)).toBeVisible();
});

test('custom CSS from the editor applies to the viewer', async ({ context, server, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByLabel('Custom CSS').click();
  await options.keyboard.type('.cm-content { letter-spacing: 3px; }');
  await expect(options.locator('.opt-preview .cm-content')).toHaveCSS('letter-spacing', '3px');
  await options.waitForTimeout(500);
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toHaveCSS('letter-spacing', '3px');
});

test('the settings button in the viewer opens the options page', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const [options] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('button', { name: 'Open settings' }).click(),
  ]);
  await options.waitForURL(/\/options\.html$/);
});

test('reset restores the defaults', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  const sortKeys = options.getByRole('switch', { name: 'Sort object keys' });
  await sortKeys.check();
  options.once('dialog', (dialog) => void dialog.accept());
  await options.getByRole('button', { name: 'Reset to defaults' }).click();
  await expect(sortKeys).not.toBeChecked();
});
```

- [ ] **Step 8: Verify**

Run: `pnpm test`, `pnpm compile`, `pnpm test:e2e`
Expected: all pass. Also check `.output/chrome-mv3/manifest.json` has `"options_ui":{"page":"options.html","open_in_tab":true}`.

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml src/entrypoints/options src/options e2e/options.spec.ts
git commit -m "feat(options): add the options page with live preview, behavior, structure and custom CSS"
```

---

### Task 10: Appearance — theme mode, theme pickers, VS Code import

**Files:**
- Create: `src/options/ThemeSwatch.vue`, `src/options/ThemeImport.vue`, `src/options/sections/AppearanceSection.vue`, `e2e/themes.spec.ts`
- Modify: `src/entrypoints/options/App.vue`

**Interfaces:**
- Consumes: `builtinThemes` (Task 5); `fromVSCode`, `ThemeImportError` (Task 4); `saveCustomTheme`, `deleteCustomTheme`, `uniqueThemeId` (Task 6); `findTheme` (Task 6); `SelectField` (Task 9).
- Produces: `<AppearanceSection :settings :custom-themes>` (section id `appearance`); `<ThemeImport :taken-ids @imported>`; `<ThemeSwatch :theme>`. Labels: `Theme mode`, `Light theme`, `Dark theme`, `VS Code theme JSON`, button `Import`, delete buttons named `Delete <theme name>`.

- [ ] **Step 1: Failing e2e**

`e2e/themes.spec.ts`:

```ts
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const viewer = 'json-viewer-app';

const VSCODE_THEME = `{
  // Exported from VS Code
  "name": "Test Night",
  "type": "dark",
  "colors": { "editor.background": "#101010", "editor.foreground": "#eeeeee" },
  "tokenColors": [{ "scope": "support.type.property-name", "settings": { "foreground": "#ff0000" } }],
}`;

async function openOptions(page: Page, extensionId: string): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
}

async function keyColor(page: Page): Promise<string> {
  const keyLine = page.locator(`${viewer} .cm-line`, { hasText: '"name"' });
  return keyLine.locator('span').first().evaluate((el) => getComputedStyle(el).color);
}

test('imports a pasted VS Code theme and uses it', async ({ context, server, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByLabel('Theme mode').selectOption('dark');
  await options.getByLabel('VS Code theme JSON').fill(VSCODE_THEME);
  await options.getByRole('button', { name: 'Import' }).click();
  await expect(options.getByRole('status')).toContainText('Imported “Test Night” as a dark theme.');
  await expect(options.getByLabel('Dark theme')).toHaveValue('test-night');
  await options.waitForTimeout(500);
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect.poll(() => keyColor(page)).toBe('rgb(255, 0, 0)');
  await expect(page.locator(`${viewer} .jv-root`)).toHaveCSS('background-color', 'rgb(16, 16, 16)');
});

test('reports invalid theme files', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByLabel('VS Code theme JSON').fill('{"colors": ');
  await options.getByRole('button', { name: 'Import' }).click();
  await expect(options.getByRole('alert')).toContainText('Invalid JSON');
});

test('switches to a built-in theme', async ({ context, server, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByLabel('Theme mode').selectOption('dark');
  await options.getByLabel('Dark theme').selectOption('dracula');
  await options.waitForTimeout(500);
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .jv-root`)).toHaveCSS('background-color', 'rgb(40, 42, 54)');
});

test('deletes a custom theme and falls back to the default', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByLabel('VS Code theme JSON').fill(VSCODE_THEME);
  await options.getByRole('button', { name: 'Import' }).click();
  await expect(options.getByLabel('Dark theme')).toHaveValue('test-night');
  options.once('dialog', (dialog) => void dialog.accept());
  await options.getByRole('button', { name: 'Delete Test Night' }).click();
  await expect(options.getByRole('button', { name: 'Delete Test Night' })).toHaveCount(0);
  await expect(options.getByLabel('Dark theme')).toHaveValue('dark-plus');
});
```

Run: `pnpm test:e2e` — expected: the 4 new tests FAIL (no Appearance section).

- [ ] **Step 2: Components**

`src/options/ThemeSwatch.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { resolveColors } from '@/themes/resolve';
import type { Theme } from '@/themes/types';

const props = defineProps<{ theme: Theme }>();
const colors = computed(() => resolveColors(props.theme));
</script>

<template>
  <span class="opt-swatch" :style="{ background: colors.background, borderColor: colors.border }" aria-hidden="true">
    <i :style="{ background: colors.key }" />
    <i :style="{ background: colors.string }" />
    <i :style="{ background: colors.number }" />
    <i :style="{ background: colors.boolean }" />
  </span>
</template>
```

`src/options/ThemeImport.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { fromVSCode, ThemeImportError } from '@/themes/fromVSCode';
import { saveCustomTheme, uniqueThemeId } from '@/themes/store';
import type { Theme } from '@/themes/types';

const props = defineProps<{ takenIds: string[] }>();
const emit = defineEmits<{ imported: [theme: Theme] }>();

const text = ref('');
const errors = ref<string[]>([]);
const warnings = ref<string[]>([]);
const message = ref('');

async function importTheme(source: string): Promise<void> {
  errors.value = [];
  warnings.value = [];
  message.value = '';
  try {
    const result = fromVSCode(source, 'imported');
    const theme: Theme = { ...result.theme, id: uniqueThemeId(result.theme.name, props.takenIds) };
    await saveCustomTheme(theme);
    warnings.value = result.warnings;
    message.value = `Imported “${theme.name}” as a ${theme.type} theme.`;
    text.value = '';
    emit('imported', theme);
  } catch (error) {
    errors.value = error instanceof ThemeImportError ? error.errors : [error instanceof Error ? error.message : String(error)];
  }
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) await importTheme(await file.text());
}
</script>

<template>
  <div class="opt-import">
    <h3>Import a VS Code theme</h3>
    <p class="opt-hint">
      Paste a color theme's JSON (the <code>themes/*.json</code> file of a VS Code theme extension) or choose the file.
    </p>
    <label class="opt-field">
      <span class="opt-label">VS Code theme JSON</span>
      <textarea v-model="text" rows="6" spellcheck="false" />
    </label>
    <div class="opt-row">
      <button type="button" :disabled="!text.trim()" @click="importTheme(text)">Import</button>
      <label class="opt-file">
        Choose file…
        <input type="file" accept=".json,.jsonc,application/json" @change="onFile" />
      </label>
    </div>
    <p v-if="message" class="opt-success" role="status">{{ message }}</p>
    <ul v-if="warnings.length" class="opt-warnings">
      <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
    </ul>
    <ul v-if="errors.length" class="opt-errors" role="alert">
      <li v-for="error in errors" :key="error">{{ error }}</li>
    </ul>
  </div>
</template>
```

`src/options/sections/AppearanceSection.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import SelectField from '../fields/SelectField.vue';
import ThemeImport from '../ThemeImport.vue';
import ThemeSwatch from '../ThemeSwatch.vue';
import type { SelectOption } from '../types';
import { defaultSettings, type Settings } from '@/settings/schema';
import { findTheme } from '@/themes/active';
import { builtinThemes } from '@/themes/builtin';
import { deleteCustomTheme } from '@/themes/store';
import type { Theme } from '@/themes/types';

const props = defineProps<{ settings: Settings; customThemes: Theme[] }>();

const modeOptions: SelectOption[] = [
  { value: 'auto', label: 'Follow the system' },
  { value: 'light', label: 'Always light' },
  { value: 'dark', label: 'Always dark' },
];

const themeOptions = computed<SelectOption[]>(() => [
  ...builtinThemes.filter((t) => t.type === 'light').map((t) => ({ value: t.id, label: t.name, group: 'Light themes' })),
  ...builtinThemes.filter((t) => t.type === 'dark').map((t) => ({ value: t.id, label: t.name, group: 'Dark themes' })),
  ...props.customThemes.map((t) => ({ value: t.id, label: `${t.name} (${t.type})`, group: 'Custom' })),
]);

const lightTheme = computed(() => findTheme(props.settings.lightThemeId, props.customThemes, 'light'));
const darkTheme = computed(() => findTheme(props.settings.darkThemeId, props.customThemes, 'dark'));
const takenIds = computed(() => [...builtinThemes, ...props.customThemes].map((t) => t.id));

function onImported(theme: Theme): void {
  if (theme.type === 'dark') props.settings.darkThemeId = theme.id;
  else props.settings.lightThemeId = theme.id;
}

async function remove(theme: Theme): Promise<void> {
  if (!window.confirm(`Delete “${theme.name}”?`)) return;
  await deleteCustomTheme(theme.id);
  if (props.settings.lightThemeId === theme.id) props.settings.lightThemeId = defaultSettings.lightThemeId;
  if (props.settings.darkThemeId === theme.id) props.settings.darkThemeId = defaultSettings.darkThemeId;
}
</script>

<template>
  <section id="appearance" class="opt-section">
    <h2>Appearance</h2>
    <SelectField v-model="settings.themeMode" label="Theme mode" :options="modeOptions" />
    <div class="opt-theme-row">
      <SelectField v-model="settings.lightThemeId" label="Light theme" :options="themeOptions" />
      <ThemeSwatch :theme="lightTheme" />
    </div>
    <div class="opt-theme-row">
      <SelectField v-model="settings.darkThemeId" label="Dark theme" :options="themeOptions" />
      <ThemeSwatch :theme="darkTheme" />
    </div>
    <ThemeImport :taken-ids="takenIds" @imported="onImported" />
    <div v-if="customThemes.length" class="opt-custom-list">
      <h3>Custom themes</h3>
      <ul>
        <li v-for="theme in customThemes" :key="theme.id" class="opt-row">
          <ThemeSwatch :theme="theme" />
          <span>{{ theme.name }}</span>
          <button type="button" :aria-label="`Delete ${theme.name}`" @click="remove(theme)">Delete</button>
        </li>
      </ul>
    </div>
  </section>
</template>
```

Append to `src/options/options.css`:

```css
.opt-theme-row {
  display: flex;
  align-items: end;
  gap: 12px;
}

.opt-theme-row .opt-field {
  flex: 1;
}

.opt-swatch {
  display: inline-flex;
  gap: 4px;
  margin-bottom: 14px;
  padding: 5px 6px;
  border: 1px solid;
  border-radius: 6px;
}

.opt-swatch i {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.opt-custom-list ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.opt-custom-list li {
  margin: 6px 0;
}

.opt-custom-list .opt-swatch {
  margin-bottom: 0;
}

.opt-file input {
  margin-left: 6px;
}
```

In `src/entrypoints/options/App.vue`: import `AppearanceSection from '@/options/sections/AppearanceSection.vue'`; add `<a href="#appearance">Appearance</a>` as the first nav link; render `<AppearanceSection :settings="settings" :custom-themes="customThemes" />` as the first child of `<main>`.

- [ ] **Step 3: Verify**

Run: `pnpm test`, `pnpm compile`, `pnpm test:e2e`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/options src/entrypoints/options e2e/themes.spec.ts
git commit -m "feat(options): pick light/dark themes and import VS Code themes"
```

---

### Task 11: Theme editor

**Files:**
- Create: `src/options/ThemeEditor.vue`
- Modify: `src/options/sections/AppearanceSection.vue`, `src/entrypoints/options/App.vue`, `src/options/options.css`, `e2e/themes.spec.ts`

**Interfaces:**
- Consumes: `resolveColors`; `parseHex`, `toHex`; `themeColorKeys`, `Theme`, `ThemeColorKey`; `parseCompactTheme` (Task 3); `saveCustomTheme`, `uniqueThemeId` (Task 6); `PreviewPane` `themeOverride` (Task 9).
- Produces: `<ThemeEditor :initial :is-new :taken-ids @change @saved @cancel>`; AppearanceSection emits `edit(theme: Theme, isNew: boolean)`; buttons `Duplicate & edit light theme`, `Duplicate & edit dark theme`, `Edit <name>`; editor fields labelled `Theme name`, `<key> hex` (e.g. `key hex`), `Theme JSON`; buttons `Save theme`, `Cancel`.

- [ ] **Step 1: Failing e2e**

Append to `e2e/themes.spec.ts`:

```ts
test('duplicates and edits a theme with a live preview', async ({ context, server, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByLabel('Theme mode').selectOption('dark');
  await options.getByRole('button', { name: 'Duplicate & edit dark theme' }).click();
  await expect(options.getByLabel('Theme name')).toHaveValue('Dark+ (copy)');
  await options.getByLabel('key hex').fill('#00ff00');
  await options.getByLabel('key hex').press('Tab');
  const previewKey = options.locator('.opt-preview .cm-line', { hasText: '"title"' }).locator('span').first();
  await expect(previewKey).toHaveCSS('color', 'rgb(0, 255, 0)');
  await options.getByRole('button', { name: 'Save theme' }).click();
  await expect(options.getByLabel('Dark theme')).toHaveValue('dark-copy');
  await options.waitForTimeout(500);
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect.poll(() => keyColor(page)).toBe('rgb(0, 255, 0)');
});

test('blocks saving a theme with invalid JSON', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  await options.getByRole('button', { name: 'Duplicate & edit dark theme' }).click();
  await options.getByLabel('Theme JSON').fill('{"name": ');
  await expect(options.getByRole('alert')).toContainText('Invalid JSON');
  await expect(options.getByRole('button', { name: 'Save theme' })).toBeDisabled();
});
```

Note: `uniqueThemeId('Dark+ (copy)', …)` is `dark-copy`.

Run: `pnpm test:e2e` — expected: the 2 new tests FAIL.

- [ ] **Step 2: `ThemeEditor.vue`**

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { parseHex, toHex } from '@/themes/color';
import { resolveColors } from '@/themes/resolve';
import { saveCustomTheme, uniqueThemeId } from '@/themes/store';
import { themeColorKeys, type Theme, type ThemeColorKey, type ThemeColors } from '@/themes/types';
import { parseCompactTheme } from '@/themes/validate';

const props = defineProps<{ initial: Theme; isNew: boolean; takenIds: string[] }>();
const emit = defineEmits<{ change: [theme: Theme]; saved: [theme: Theme]; cancel: [] }>();

const clone = (theme: Theme): Theme => JSON.parse(JSON.stringify(theme)) as Theme;
const start = clone(props.initial);
const draft = ref<Theme>({
  ...start,
  name: props.isNew ? `${start.name} (copy)` : start.name,
  source: 'custom',
});

const jsonText = ref('');
const jsonErrors = ref<string[]>([]);
const saveError = ref('');
let editingJson = false;

const resolved = computed(() => resolveColors(draft.value));
const canSave = computed(() => jsonErrors.value.length === 0 && draft.value.name.trim() !== '');

watch(
  draft,
  (theme) => {
    if (!editingJson) jsonText.value = JSON.stringify(theme, null, 2);
    emit('change', clone(theme));
  },
  { deep: true, immediate: true },
);

function hexOrNull(value: string): string | null {
  try {
    return toHex(parseHex(value));
  } catch {
    return null;
  }
}

function setColor(key: ThemeColorKey, value: string): void {
  const trimmed = value.trim();
  if (trimmed === '' && key !== 'background' && key !== 'foreground') {
    // Clearing an optional color makes it derived again.
    delete (draft.value.colors as Partial<ThemeColors>)[key];
    return;
  }
  const hex = hexOrNull(trimmed);
  if (hex !== null) draft.value.colors[key] = hex;
}

function onJsonInput(): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText.value);
  } catch (error) {
    jsonErrors.value = [`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`];
    return;
  }
  const result = parseCompactTheme({ ...(parsed as object), id: draft.value.id, source: 'custom' });
  if (!result.ok) {
    jsonErrors.value = result.errors;
    return;
  }
  jsonErrors.value = [];
  editingJson = true;
  draft.value = result.theme;
  // Let the deep watcher run before JSON edits are reflected back again.
  queueMicrotask(() => {
    editingJson = false;
  });
}

async function save(): Promise<void> {
  saveError.value = '';
  const id = props.isNew ? uniqueThemeId(draft.value.name, props.takenIds) : draft.value.id;
  const theme: Theme = { ...clone(draft.value), id, name: draft.value.name.trim(), source: 'custom' };
  try {
    await saveCustomTheme(theme);
    emit('saved', theme);
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : String(error);
  }
}
</script>

<template>
  <section class="opt-editor" aria-label="Theme editor">
    <h3>{{ isNew ? 'New theme' : 'Edit theme' }}</h3>
    <label class="opt-field">
      <span class="opt-label">Theme name</span>
      <input v-model="draft.name" type="text" />
    </label>
    <label class="opt-field">
      <span class="opt-label">Type</span>
      <select v-model="draft.type">
        <option value="dark">Dark</option>
        <option value="light">Light</option>
      </select>
    </label>
    <div class="opt-color-grid">
      <div v-for="key in themeColorKeys" :key="key" class="opt-color-row">
        <span class="opt-color-name">{{ key }}</span>
        <input
          type="color"
          :aria-label="`${key} picker`"
          :value="resolved[key].slice(0, 7)"
          @input="setColor(key, ($event.target as HTMLInputElement).value)"
        />
        <input
          type="text"
          :aria-label="`${key} hex`"
          :value="draft.colors[key] ?? ''"
          :placeholder="resolved[key]"
          spellcheck="false"
          @change="setColor(key, ($event.target as HTMLInputElement).value)"
        />
        <small v-if="!draft.colors[key]" class="opt-hint">derived</small>
      </div>
    </div>
    <label class="opt-field">
      <span class="opt-label">Theme JSON</span>
      <textarea v-model="jsonText" rows="12" spellcheck="false" @input="onJsonInput" />
    </label>
    <ul v-if="jsonErrors.length" class="opt-errors" role="alert">
      <li v-for="error in jsonErrors" :key="error">{{ error }}</li>
    </ul>
    <p v-if="saveError" class="opt-errors" role="alert">{{ saveError }}</p>
    <div class="opt-row">
      <button type="button" :disabled="!canSave" @click="save">Save theme</button>
      <button type="button" @click="emit('cancel')">Cancel</button>
    </div>
  </section>
</template>
```

- [ ] **Step 3: Wire into Appearance and App**

In `src/options/sections/AppearanceSection.vue`:
- add `const emit = defineEmits<{ edit: [theme: Theme, isNew: boolean] }>();` after `defineProps`;
- after each theme row's `<ThemeSwatch …/>`, add a button: for light `<button type="button" aria-label="Duplicate & edit light theme" @click="emit('edit', lightTheme, true)">Duplicate &amp; edit</button>`, for dark the same with `dark` / `darkTheme`;
- in the custom theme list item, before the Delete button, add `<button type="button" :aria-label="`Edit ${theme.name}`" @click="emit('edit', theme, false)">Edit</button>`.

In `src/entrypoints/options/App.vue`:

```ts
import { computed, ref } from 'vue';
import ThemeEditor from '@/options/ThemeEditor.vue';
import { builtinThemes } from '@/themes/builtin';
import type { Theme } from '@/themes/types';

const editing = ref<{ theme: Theme; isNew: boolean } | null>(null);
const previewTheme = ref<Theme | null>(null);
const takenIds = computed(() => [...builtinThemes, ...customThemes.value].map((t) => t.id));

function startEditing(theme: Theme, isNew: boolean): void {
  editing.value = { theme, isNew };
}

function stopEditing(): void {
  editing.value = null;
  previewTheme.value = null;
}

function onSaved(theme: Theme): void {
  if (theme.type === 'dark') settings.value.darkThemeId = theme.id;
  else settings.value.lightThemeId = theme.id;
  stopEditing();
}
```

(merge these imports with the existing ones), change the Appearance usage to `<AppearanceSection :settings="settings" :custom-themes="customThemes" @edit="startEditing" />`, render right after it:

```vue
      <ThemeEditor
        v-if="editing"
        :key="`${editing.theme.id}-${editing.isNew}`"
        :initial="editing.theme"
        :is-new="editing.isNew"
        :taken-ids="takenIds"
        @change="previewTheme = $event"
        @saved="onSaved"
        @cancel="stopEditing"
      />
```

and pass `:theme-override="previewTheme"` to `<PreviewPane>`.

Append to `src/options/options.css`:

```css
.opt-editor {
  margin: 12px 0;
  padding: 12px 16px;
  border: 1px solid var(--opt-border);
  border-radius: 8px;
  background: var(--opt-panel);
}

.opt-color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 6px 16px;
  margin: 12px 0;
}

.opt-color-row {
  display: grid;
  grid-template-columns: 130px 32px 1fr auto;
  align-items: center;
  gap: 6px;
}

.opt-color-row input[type='color'] {
  width: 32px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--opt-border);
  border-radius: 4px;
  background: none;
}

.opt-color-row input[type='text'] {
  min-width: 0;
  padding: 4px 6px;
  border: 1px solid var(--opt-border);
  border-radius: 4px;
  background: var(--opt-bg);
  color: inherit;
  font: 12px ui-monospace, Consolas, monospace;
}

.opt-color-name {
  font: 12px ui-monospace, Consolas, monospace;
}
```

- [ ] **Step 4: Verify**

Run: `pnpm test`, `pnpm compile`, `pnpm test:e2e`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/options src/entrypoints/options e2e/themes.spec.ts
git commit -m "feat(options): duplicate and edit themes with a live preview"
```

---

### Task 12: Documentation

**Files:**
- Modify: `README.md`, `docs/notes/pendientes-fase-0-1.md`

- [ ] **Step 1: README**

Add after the "Cargar en Edge / Chrome" section:

````markdown
## Configuración

Abre las opciones desde el botón ⚙ del visor o con clic derecho en el ícono › Opciones. Los cambios se guardan
solos y se aplican en vivo a las pestañas abiertas.

- **Apariencia:** modo claro/oscuro (sigue al sistema o fijo), un tema para cada modo, importar temas de VS Code
  (pega el JSON del tema o elige el archivo) y un editor para duplicar y retocar cualquier tema.
- **Comportamiento** y **Estructura:** las mismas opciones del json-viewer original, con interruptores.
- **Avanzado:** CSS propio para el visor.

## Temas incluidos

Se generan desde [tm-themes](https://github.com/shikijs/textmate-grammars-themes):

```bash
pnpm themes:build   # regenera src/themes/builtin/generated.json y LICENSES.md
```
````

- [ ] **Step 2: Pending notes**

In `docs/notes/pendientes-fase-0-1.md`: delete the whole "Primera tarea del próximo plan" section and, from "Fase 2 (opciones, temas)", delete the bullets now done (Compartments/focus, tabSize clamp, theme validation, banner/error colors, autoHighlight/showHeader tests). Keep `showArraySize` wiring only if Task 9 did not cover it (it did not — keep the bullet: "Test de `showArraySize` desde la página de opciones").

- [ ] **Step 3: Commit**

```bash
git add README.md docs/notes/pendientes-fase-0-1.md
git commit -m "docs: document the options page and built-in themes"
```
