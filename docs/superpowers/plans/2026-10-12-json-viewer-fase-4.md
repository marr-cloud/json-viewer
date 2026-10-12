# JSON Viewer — Fase 4 (Navegación y acciones) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make big JSON documents easy to move around in and act on. The viewer gets a status bar with the cursor's JSON path (click to copy), size, line count and format; folding by level (from the toolbar and automatically on open); copy formatted, copy minified and download; a per-tab sort-keys toggle; a JSONPath filter; and keyboard shortcuts the user can change in the options page.

**Architecture:**
- `src/editor/` gains two CodeMirror helpers. `cursorPath.ts` turns a cursor position into `$.a["b-c"][3]` using the `@codemirror/lang-json` syntax tree. `foldLevel.ts` folds every multi-line container at a given nesting level or deeper.
- `src/viewer/` gains pure helpers: `stats.ts` (bytes, lines, counts), `download.ts`, `clipboard.ts` (Clipboard API with an `execCommand` fallback) and `jsonPath.ts` (a `jsonpath-plus` wrapper that formats the result).
- `src/settings/shortcuts.ts` defines the shortcut actions, their defaults, a validator and the key matcher. `Settings` gains `shortcuts`; `ViewerOptions` gains `foldFromLevel`.
- `CodeView` exposes `foldFromLevel`, `unfoldAll`, `openSearch` and `focus`, emits `path`, and folds on open. `JsonViewer` orchestrates the filter, sorting, copy/download and shortcuts. New components: `ViewerStatusBar.vue` and `JsonPathFilter.vue`.
- The options page gets a "Fold on open" select (Structure) and a new Shortcuts section with a key recorder.

**Tech Stack:** WXT 0.21.4, Vue 3.5, CodeMirror 6 (`@codemirror/language` 6.13.1, `@codemirror/lang-json` 6.0.2, `@codemirror/search` 6.7.x), `jsonpath-plus` 11.1.0 (new), TypeScript, pnpm 12, Node 24, Vitest 5 (+ happy-dom), Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-10-11-json-viewer-design.md`: §6.1 layout, §6.2 top bar, §6.3 bottom bar, §6.4 shortcuts, §6.7 `foldFromLevel`/`shortcuts`, §10 Fase 4. Pending note: `docs/notes/pendientes-fase-0-1.md`, "Fase 4 (navegación)": the URL click timer.

### Decisions that refine the spec (approved with this plan)

1. **JSONPath runs with `eval: 'safe'`, not `eval: false`.**
   - With `false`, jsonpath-plus rejects every filter expression (`[?(@.id > 1)]` throws "Eval [?(expr)] prevented"). Filters are the most useful part of JSONPath.
   - `'safe'` is jsonpath-plus's own interpreter. It never calls `eval` or `Function`, so it is CSP-safe. It cannot reach globals: `alert(1)` and `@.constructor.constructor(...)` both throw. This was verified on 11.1.0 on 2026-10-12.
   - The path is typed by the user in their own tab. The spec's intent (no arbitrary code execution) holds.
2. **`jsonpath-plus` pinned to `11.1.0`.** It was released 2026-09-25, so it is more than two weeks old. 11.2.0 is only six days old. The browser ESM build is 27 KB minified and ASCII-only. It only uses `new Function` in `eval: 'native'` mode, which we never use.
3. **Fold levels.**
   - The top-level value is level 1, its children level 2, and so on. `foldFromLevel: N` folds every multi-line object or array at level N or deeper. 0 means off.
   - `foldFromLevel: 2` matches the original `alwaysFold` ("fold from the second level").
   - The UI never shows the raw number. Both the toolbar and the options page say "Show 1 level" (= 2) … "Show 5 levels" (= 6). "Fold all" in the toolbar is level 2, because folding the top-level value to `{…}` hides everything.
   - Nested containers are folded too, so unfolding one block shows its children still folded.
   - Invalid documents are never folded on open: the error must stay visible.
4. **Shortcuts.**
   - They are stored as strings such as `"Ctrl+Shift+F"`, with modifiers in the order Ctrl, Alt, Shift, Meta. `""` disables the action.
   - Keys are matched by physical key (`KeyboardEvent.code`), so Shift, Alt and AltGr never change the key. AltGr arrives as Ctrl+Alt, so it never matches an `Alt+…` shortcut and typing `[` or `@` on a Spanish layout stays typing.
   - A shortcut needs Ctrl, Alt or Meta, or must be a function key. When two actions share a combination, the first in `SHORTCUT_ACTIONS` order wins, and the options page warns.
   - The viewer catches shortcuts on its root in the capture phase. CodeMirror's own `Mod-f` binding is removed, so Search follows the setting. If Search is disabled, Ctrl+F reaches the browser's find.
5. **Clipboard.** Copying uses `navigator.clipboard.writeText` and falls back to a hidden `<textarea>` plus `document.execCommand('copy')`. The Clipboard API does not exist on plain-http pages (not a secure context), which is common for internal APIs. No `clipboardWrite` permission is needed, because every copy follows a click or key press.
6. **What actions act on.**
   - Copy formatted, copy minified and download act on what the Code tab shows: the filter result while a filter is active, the whole document otherwise. They do this even when the Raw tab is open.
   - The download is named after the URL's last path segment, with `.json` added if needed. The fallback name is `data.json`.
7. **Filter behavior.**
   - The filter applies on Enter, not while typing, because evaluating a 4 MB document on every keystroke would freeze the tab.
   - Esc (in the field, or in the editor when the search panel is closed) clears it.
   - The result is always a JSON array of the matches, formatted with the current options and never folded on open.
   - Syntax errors show under the field, and the full document stays visible.
   - The filter is disabled for invalid JSON.
8. **Sort keys in the toolbar is per tab**, like the light/dark toggle. It does not change the setting.
9. **Scope trims.**
   - The format label is always "JSON" for now. JSONP and NDJSON arrive with their parsers in Phase 6.
   - The `features.jsonPath` toggle and the "Funciones" options section move to Phase 5, together with the other `features.*` switches.
   - The line count is the count of what is shown: the formatted or filtered text on Code, the raw text on Raw.

## Global Constraints

- pnpm only (`pnpm add`, `pnpm exec`; never npm or npx for project commands), Node 24. Manifest V3. Permissions stay exactly `storage` and `scripting`.
- `srcDir: 'src'`; alias `@/` → `src/`. The `detector` content script must not change (≤ 8192 bytes; today 4233).
- Keep `wxt.config.ts`'s rolldown `minify.codegen.asciiOnly`. The minifier escapes non-ASCII in the viewer bundle. Never disable it.
- New runtime dependency: exactly `jsonpath-plus` `11.1.0`, added with `pnpm add --save-exact jsonpath-plus@11.1.0`. No other new dependencies. Import types from `@codemirror/*` packages only, not `@lezer/*` (they are not direct dependencies).
- `src/themes/{color,types,scopes,fromVSCode,validate}.ts` and `src/shared/guards.ts` keep relative imports only (they run under `tsx`).
- Storage keys unchanged. `sync:settings` stays at version 1. New fields `viewer.foldFromLevel` and `shortcuts` are added without a version bump; `validateSettings` fills them with defaults.
- Identifiers, comments and UI text in English. Conventional commits.
- Unit tests sit next to code (`src/**/*.test.ts`); e2e tests live in `e2e/`. Component tests use happy-dom and Vue's `createApp` (no `@vue/test-utils`).
- The CodeView reconfigure watch is shallow. Any object passed to `JsonViewer`/`CodeView` must be replaced, not mutated.
- Write files with the Write/Edit tools, not shell heredocs (heredocs have mangled backslashes and duplicated blocks before), and check `git diff` before each commit.
- Before each commit run `pnpm test` and `pnpm compile`. Tasks with e2e steps also run `pnpm build` and the named spec with `pnpm exec playwright test <file>`. The last task runs the full `pnpm test:e2e`.

## Review Focus

1. **JSON on a plain-http site that isn't localhost** (internal APIs). `navigator.clipboard` is undefined there, but every copy action must still work. Test: Task 8 e2e `copies the path on a page without the async Clipboard API` (host `jv.test` mapped to 127.0.0.1, an insecure origin); Task 5 unit tests for the fallback.
2. **Big documents (~4 MB, 50k items).** Fold all, fold on open, the cursor path deep in a 50k-element array and the filter must work and not freeze or throw. Tests: Task 1 unit `indexes the last item of a 10,000-item array`; Task 9 e2e `folds and unfolds a 4 MB document`; Task 10 e2e `filters a 4 MB document`.
3. **Keys that aren't identifiers** (dashes, quotes, spaces, dots, non-ASCII, empty, `$ref`). The path uses bracket notation, and a copied path pasted into the filter finds the same value. Tests: Task 1 unit `quotes keys that are not identifiers`; Task 6 unit `finds the value at a copied cursor path`.
4. **Typing in the filter box while shortcuts are active.** Plain letters, Shift+letters and AltGr characters (Ctrl+Alt+key) must type, not trigger actions. Tests: Task 7 unit `tells AltGr (Ctrl+Alt) apart from Alt` and `rejects shortcuts without Ctrl, Alt, Meta or a function key`; Task 11 component test `typing in the filter does not trigger shortcuts`.
5. **Invalid JSON documents.** Actions that need a parsed value (copy minified, filter) are disabled. Copy formatted copies the raw text. Fold on open is skipped, so the error stays in view. Tests: Task 3 CodeView `does not fold an invalid document`; Task 9 component `disables copy minified for invalid JSON but copies the raw text as formatted`; Task 10 component `disables the filter for invalid JSON`.

---

### Task 1: Cursor path from the syntax tree

**Files:**
- Create: `src/editor/cursorPath.ts`, `src/editor/cursorPath.test.ts`

**Interfaces:**
- Consumes: `syntaxTree` (`@codemirror/language`), `EditorState`, `Extension` (`@codemirror/state`), `ViewPlugin`, `ViewUpdate` (`@codemirror/view`).
- Produces:
  - `type PathKey = string | number`
  - `formatPath(keys: readonly PathKey[]): string`: `$`, then `.name` for identifiers (`/^[A-Za-z_][A-Za-z0-9_]*$/`), `["any key"]` (JSON-quoted) otherwise, `[3]` for array indexes.
  - `jsonPathAt(state: EditorState, pos: number): string`
  - `cursorPath(onChange: (path: string) => void): Extension`: calls `onChange` once on creation, then only when the path changes.

The lang-json tree (checked against 6.0.2) has the nodes `JsonText`, `Object`, `Property`, `PropertyName`, `Array`, `String`, `Number`, `True`, `False`, `Null`, plus punctuation `{ } [ ] , :`.

- [ ] **Step 1: Write the failing tests**

`src/editor/cursorPath.test.ts`:

```ts
// @vitest-environment happy-dom
import { json } from '@codemirror/lang-json';
import { ensureSyntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { cursorPath, formatPath, jsonPathAt } from './cursorPath';

const DOC = JSON.stringify({ name: 'x', 'a-b': { list: [1, { deep: true }, [null]] }, 'k"q': [], e: {} }, null, 2);

function stateOf(doc: string): EditorState {
  const state = EditorState.create({ doc, extensions: [json()] });
  ensureSyntaxTree(state, doc.length, 5000);
  return state;
}

/** Path with the cursor `offset` characters into the first occurrence of `needle`. */
function pathAt(needle: string, offset = 0, doc = DOC): string {
  const index = doc.indexOf(needle);
  if (index === -1) throw new Error(`not found: ${needle}`);
  return jsonPathAt(stateOf(doc), index + offset);
}

describe('formatPath', () => {
  it('starts at $ and uses dots for identifiers and brackets for indexes', () => {
    expect(formatPath([])).toBe('$');
    expect(formatPath(['items', 3, 'email'])).toBe('$.items[3].email');
    expect(formatPath(['_ok1'])).toBe('$._ok1');
  });

  it('quotes keys that are not identifiers', () => {
    expect(formatPath(['a-b', '', 'k"q', 'ñ', '1a', '$ref', 'a.b', 'a b'])).toBe(
      '$["a-b"][""]["k\\"q"]["ñ"]["1a"]["$ref"]["a.b"]["a b"]',
    );
  });
});

describe('jsonPathAt', () => {
  it('names the property whose key or value holds the cursor', () => {
    expect(pathAt('"name"', 0)).toBe('$.name');
    expect(pathAt('"name"', 3)).toBe('$.name');
    expect(pathAt('"x"', 3)).toBe('$.name');
    expect(pathAt('"list"', 1)).toBe('$["a-b"].list');
    expect(pathAt('"k\\"q"', 1)).toBe('$["k\\"q"]');
    expect(pathAt('"e"', 1)).toBe('$.e');
  });

  it('treats indentation and the end of a line as part of that line', () => {
    expect(pathAt('"name"', -2)).toBe('$.name');
    expect(pathAt('"x",', 4)).toBe('$.name');
    const closing = DOC.indexOf('}', DOC.indexOf('"deep"'));
    expect(jsonPathAt(stateOf(DOC), closing + 2)).toBe('$["a-b"].list[1]');
  });

  it('indexes array items', () => {
    expect(pathAt('1,', 0)).toBe('$["a-b"].list[0]');
    expect(pathAt('1,', 2)).toBe('$["a-b"].list[0]');
    expect(pathAt('"deep"', 2)).toBe('$["a-b"].list[1].deep');
    expect(pathAt('null', 2)).toBe('$["a-b"].list[2][0]');
  });

  it('returns $ at the top-level brackets', () => {
    expect(jsonPathAt(stateOf(DOC), 0)).toBe('$');
    expect(jsonPathAt(stateOf(DOC), DOC.length)).toBe('$');
  });

  it('indexes the last item of a 10,000-item array', () => {
    const doc = JSON.stringify(
      Array.from({ length: 10_000 }, (_, i) => i),
      null,
      2,
    );
    expect(pathAt('9999', 1, doc)).toBe('$[9999]');
  });

  it('does not throw on invalid documents', () => {
    const doc = '{\n  "a": [1,\n  "b": }';
    for (let pos = 0; pos <= doc.length; pos++) {
      expect(jsonPathAt(stateOf(doc), pos)).toMatch(/^\$/);
    }
  });
});

describe('cursorPath', () => {
  let view: EditorView | undefined;
  afterEach(() => {
    view?.destroy();
    view = undefined;
  });

  it('reports the path on creation and whenever it changes', () => {
    const paths: string[] = [];
    view = new EditorView({
      state: EditorState.create({ doc: DOC, extensions: [json(), cursorPath((path) => paths.push(path))] }),
      parent: document.body,
    });
    expect(paths).toEqual(['$']);

    const deep = DOC.indexOf('"deep"') + 2;
    view.dispatch({ selection: { anchor: deep } });
    expect(paths.at(-1)).toBe('$["a-b"].list[1].deep');

    view.dispatch({ selection: { anchor: deep + 1 } });
    expect(paths).toHaveLength(2);

    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '[\n  1\n]' }, selection: { anchor: 4 } });
    expect(paths.at(-1)).toBe('$[0]');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/editor/cursorPath.test.ts`
Expected: FAIL. The module `./cursorPath` does not exist.

- [ ] **Step 3: Implement**

`src/editor/cursorPath.ts`:

```ts
import { syntaxTree } from '@codemirror/language';
import type { EditorState, Extension } from '@codemirror/state';
import { ViewPlugin, type ViewUpdate } from '@codemirror/view';

// @lezer/common isn't a direct dependency, so derive its SyntaxNode type from CodeMirror's API.
type Node = ReturnType<ReturnType<typeof syntaxTree>['resolveInner']>;

export type PathKey = string | number;

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PUNCTUATION = new Set(['{', '}', '[', ']', ',', ':']);

/** `$` followed by `.name`, `["a-b"]` and `[3]` segments, e.g. `$.items[3]["e-mail"]`. */
export function formatPath(keys: readonly PathKey[]): string {
  return (
    '$' +
    keys
      .map((key) => {
        if (typeof key === 'number') return `[${key}]`;
        return IDENTIFIER.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
      })
      .join('')
  );
}

/** JSON path of the value at `pos`, e.g. `$.items[3].email`; `$` outside every property and item. */
export function jsonPathAt(state: EditorState, pos: number): string {
  const probe = probePosition(state, pos);
  const tree = syntaxTree(state);
  const before = keysAt(state, tree.resolveInner(probe, -1));
  const after = keysAt(state, tree.resolveInner(probe, 1));
  return formatPath(after.length > before.length ? after : before);
}

/**
 * Moves a cursor sitting in a line's indentation, or after its last value and trailing comma,
 * onto that value, so clicking anywhere on `  "a": 1,` gives `$.a`.
 */
function probePosition(state: EditorState, pos: number): number {
  const line = state.doc.lineAt(pos);
  const start = line.text.length - line.text.trimStart().length;
  const end = line.text.replace(/,?\s*$/, '').length;
  if (end <= start) return pos;
  return line.from + Math.min(Math.max(pos - line.from, start), end);
}

function keysAt(state: EditorState, node: Node): PathKey[] {
  const keys: PathKey[] = [];
  for (let current: Node | null = node; current?.parent; current = current.parent) {
    if (current.name === 'Property') {
      const key = propertyKey(state, current);
      if (key !== null) keys.push(key);
    } else if (current.parent.name === 'Array' && isValue(current)) {
      keys.push(arrayIndex(current));
    }
  }
  return keys.reverse();
}

function isValue(node: Node): boolean {
  return !PUNCTUATION.has(node.name) && !node.type.isError;
}

function arrayIndex(item: Node): number {
  let index = 0;
  for (let sibling = item.prevSibling; sibling; sibling = sibling.prevSibling) {
    if (isValue(sibling)) index++;
  }
  return index;
}

function propertyKey(state: EditorState, property: Node): string | null {
  const name = property.getChild('PropertyName');
  if (!name) return null;
  const text = state.sliceDoc(name.from, name.to);
  try {
    const key: unknown = JSON.parse(text);
    return typeof key === 'string' ? key : null;
  } catch {
    // A broken escape in an invalid document: show the name as written.
    return text.replace(/^"|"$/g, '');
  }
}

/** Calls `onChange` with the cursor's path when the editor is created and whenever the path changes. */
export function cursorPath(onChange: (path: string) => void): Extension {
  return ViewPlugin.define((view) => {
    let last = jsonPathAt(view.state, view.state.selection.main.head);
    onChange(last);
    return {
      update(update: ViewUpdate) {
        // Big documents keep parsing in the background, which also changes the tree.
        const treeChanged = syntaxTree(update.startState) !== syntaxTree(update.state);
        if (!update.selectionSet && !update.docChanged && !treeChanged) return;
        const path = jsonPathAt(update.state, update.state.selection.main.head);
        if (path === last) return;
        last = path;
        onChange(path);
      },
    };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/editor/cursorPath.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
pnpm test && pnpm compile
git add src/editor/cursorPath.ts src/editor/cursorPath.test.ts
git commit -m "feat(editor): compute the JSON path at the cursor"
```

---

### Task 2: Fold from a nesting level

**Files:**
- Create: `src/editor/foldLevel.ts`, `src/editor/foldLevel.test.ts`

**Interfaces:**
- Consumes: `codeFolding`, `ensureSyntaxTree`, `foldedRanges`, `foldEffect`, `foldInside`, `foldState`, `syntaxTree`, `unfoldEffect` (`@codemirror/language`); `StateEffect` (`@codemirror/state`).
- Produces:
  - `interface FoldRange { from: number; to: number }`
  - `foldRangesFromLevel(state: EditorState, level: number): FoldRange[]`: the inside of every multi-line `Object`/`Array` at nesting `level` or deeper. The top-level value is level 1; `level < 1` returns `[]`.
  - `foldFromLevel(view: EditorView, level: number): void`: replaces all current folds with those ranges (`0` just unfolds everything). It does nothing when there is nothing to change, and works even without `foldGutter()`/`codeFolding()` in the config.

Notes:
- `foldState` keeps nested folds, so unfolding an outer block shows the inner ones still folded.
- Effects in one transaction apply in order. Unfold effects go first, so a range can be unfolded and folded again in the same dispatch.
- CodeMirror's own `foldAll` does the same `StateEffect.appendConfig.of(codeFolding())` trick when the fold state field is missing.

- [ ] **Step 1: Write the failing tests**

`src/editor/foldLevel.test.ts`:

```ts
// @vitest-environment happy-dom
import { json } from '@codemirror/lang-json';
import { foldedRanges, foldGutter } from '@codemirror/language';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { foldFromLevel, foldRangesFromLevel } from './foldLevel';

// Levels: root 1; "a" 2; "b" 3; the object inside "b" 4; "g" 2. "e" is empty, "s" fits on one line.
const DOC = [
  '{',
  '  "a": {',
  '    "b": [',
  '      1,',
  '      {',
  '        "c": true',
  '      }',
  '    ]',
  '  },',
  '  "e": [],',
  '  "s": {"t": 1},',
  '  "g": {',
  '    "h": "x"',
  '  }',
  '}',
].join('\n');

/** The trimmed text of the line where each range starts. */
function lines(state: EditorState, ranges: { from: number }[]): string[] {
  return ranges.map((range) => state.doc.lineAt(range.from).text.trim());
}

function folded(state: EditorState): string[] {
  const starts: { from: number }[] = [];
  foldedRanges(state).between(0, state.doc.length, (from) => {
    starts.push({ from });
  });
  return lines(state, starts);
}

describe('foldRangesFromLevel', () => {
  const state = EditorState.create({ doc: DOC, extensions: [json()] });

  it('returns the multi-line containers at the level or deeper', () => {
    expect(lines(state, foldRangesFromLevel(state, 1))).toEqual(['{', '"a": {', '"b": [', '{', '"g": {']);
    expect(lines(state, foldRangesFromLevel(state, 2))).toEqual(['"a": {', '"b": [', '{', '"g": {']);
    expect(lines(state, foldRangesFromLevel(state, 3))).toEqual(['"b": [', '{']);
    expect(lines(state, foldRangesFromLevel(state, 4))).toEqual(['{']);
    expect(foldRangesFromLevel(state, 5)).toEqual([]);
  });

  it('folds nothing at level 0', () => {
    expect(foldRangesFromLevel(state, 0)).toEqual([]);
  });

  it('folds the inside of the brackets', () => {
    const [range] = foldRangesFromLevel(state, 4);
    expect(state.sliceDoc(range!.from - 1, range!.from)).toBe('{');
    expect(state.sliceDoc(range!.to, range!.to + 1)).toBe('}');
  });
});

describe('foldFromLevel', () => {
  let view: EditorView | undefined;
  const mount = (extensions: Extension[]) => {
    view = new EditorView({ state: EditorState.create({ doc: DOC, extensions }), parent: document.body });
    return view;
  };
  afterEach(() => {
    view?.destroy();
    view = undefined;
  });

  it('replaces the current folds', () => {
    const v = mount([json(), foldGutter()]);
    foldFromLevel(v, 2);
    expect(folded(v.state)).toEqual(['"a": {', '"b": [', '{', '"g": {']);
    foldFromLevel(v, 4);
    expect(folded(v.state)).toEqual(['{']);
    foldFromLevel(v, 0);
    expect(folded(v.state)).toEqual([]);
  });

  it('works without a fold gutter', () => {
    const v = mount([json()]);
    foldFromLevel(v, 3);
    expect(folded(v.state)).toEqual(['"b": [', '{']);
    expect(v.dom.querySelectorAll('.cm-foldPlaceholder').length).toBeGreaterThan(0);
  });

  it('does not dispatch when there is nothing to change', () => {
    const v = mount([json()]);
    const before = v.state;
    foldFromLevel(v, 0);
    expect(v.state).toBe(before);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/editor/foldLevel.test.ts`
Expected: FAIL. The module `./foldLevel` does not exist.

- [ ] **Step 3: Implement**

`src/editor/foldLevel.ts`:

```ts
import {
  codeFolding,
  ensureSyntaxTree,
  foldedRanges,
  foldEffect,
  foldInside,
  foldState,
  syntaxTree,
  unfoldEffect,
} from '@codemirror/language';
import { StateEffect, type EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

/** Stop waiting for a full parse after this long and fold what has been parsed. */
const PARSE_TIMEOUT_MS = 1000;

export interface FoldRange {
  from: number;
  to: number;
}

const isContainer = (name: string) => name === 'Object' || name === 'Array';

/**
 * The inside of every multi-line object or array nested `level` or more levels deep.
 * The top-level value is level 1, its children level 2, and so on; level 0 folds nothing.
 */
export function foldRangesFromLevel(state: EditorState, level: number): FoldRange[] {
  if (level < 1) return [];
  const tree = ensureSyntaxTree(state, state.doc.length, PARSE_TIMEOUT_MS) ?? syntaxTree(state);
  const ranges: FoldRange[] = [];
  let depth = 0;
  tree.iterate({
    enter(node) {
      if (!isContainer(node.name)) return;
      depth++;
      if (depth < level) return;
      const range = foldInside(node.node);
      if (range && state.doc.lineAt(range.from).number < state.doc.lineAt(range.to).number) ranges.push(range);
    },
    leave(node) {
      if (isContainer(node.name)) depth--;
    },
  });
  return ranges;
}

/** Replaces the current folds with the containers at `level` and deeper; 0 unfolds everything. */
export function foldFromLevel(view: EditorView, level: number): void {
  const { state } = view;
  const effects: StateEffect<unknown>[] = [];
  foldedRanges(state).between(0, state.doc.length, (from, to) => {
    effects.push(unfoldEffect.of({ from, to }));
  });
  for (const range of foldRangesFromLevel(state, level)) effects.push(foldEffect.of(range));
  if (effects.length === 0) return;
  // Without a fold gutter or fold summaries the folding state isn't installed yet.
  if (!state.field(foldState, false)) effects.push(StateEffect.appendConfig.of(codeFolding()));
  view.dispatch({ effects });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/editor/foldLevel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm test && pnpm compile
git add src/editor/foldLevel.ts src/editor/foldLevel.test.ts
git commit -m "feat(editor): fold every container from a nesting level"
```

---

### Task 3: "Fold on open" setting

**Files:**
- Modify: `src/viewer/options.ts`, `src/viewer/prepare.test.ts`, `src/settings/schema.ts`, `src/settings/schema.test.ts`, `src/components/CodeView.vue`, `src/components/CodeView.test.ts`, `src/options/sections/StructureSection.vue`
- Create: `e2e/navigation.spec.ts`

**Interfaces:**
- Consumes: `foldFromLevel(view, level)` (Task 2); `unfoldAll` (`@codemirror/language`); `oneOf` (`src/settings/fields.ts`); `SelectField` (`src/options/fields/SelectField.vue`, string `v-model`, `options: SelectOption[]`).
- Produces:
  - `ViewerOptions.foldFromLevel: number` (default `0`)
  - `FOLD_LEVELS = [2, 3, 4, 5, 6] as const`, `FOLD_ALL_LEVEL = 2`, `foldLevelLabel(level: number): string` (`2` → `"Show 1 level"`, `3` → `"Show 2 levels"`), all in `src/viewer/options.ts`
  - `CodeView` exposes `foldFromLevel(level: number): void` and `unfoldAll(): void`. Callers hold a `ref<InstanceType<typeof CodeView>>()`.
  - `e2e/navigation.spec.ts`, which later tasks extend.

- [ ] **Step 1: Write the failing tests**

In `src/viewer/prepare.test.ts`, add `foldFromLevel: 0,` after `showArraySize: false,` in the `defaultViewerOptions` expectation.

In `src/settings/schema.test.ts`, add inside `describe('validateSettings', …)`:

```ts
  it('accepts only the offered fold levels', () => {
    for (const level of [0, 2, 3, 4, 5, 6]) {
      expect(validateSettings({ viewer: { foldFromLevel: level } }).viewer.foldFromLevel).toBe(level);
    }
    for (const level of [1, 7, -1, 2.5, '2', null]) {
      expect(validateSettings({ viewer: { foldFromLevel: level } }).viewer.foldFromLevel).toBe(0);
    }
  });
```

In `src/components/CodeView.test.ts`:
- Change the imports to:

```ts
import { foldAll, foldedRanges } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, reactive, ref, type App } from 'vue';
import type { ErrorLocation } from '@/editor/errorLine';
import { defaultTheme } from '@/themes/builtin';
import { defaultViewerOptions, type ViewerOptions } from '@/viewer/options';
import CodeView from './CodeView.vue';
```

- Replace `mount` with:

```ts
function mount(doc: string, error: ErrorLocation | null = null, options: Partial<ViewerOptions> = {}) {
  host = document.createElement('div');
  document.body.append(host);
  const state = reactive({ doc, options: { ...defaultViewerOptions, ...options }, error });
  const component = ref<InstanceType<typeof CodeView>>();
  app = createApp({
    render: () =>
      h(CodeView, { ref: component, doc: state.doc, options: state.options, theme: defaultTheme, error: state.error }),
  });
  app.mount(host);
  const editor = host.querySelector<HTMLElement>('.cm-editor')!;
  return { state, editor, view: EditorView.findFromDOM(editor)!, component };
}

const NESTED = '{\n  "a": {\n    "b": [\n      1\n    ]\n  }\n}';
const foldCount = (view: EditorView) => foldedRanges(view.state).size;
```

- Add these tests inside `describe('CodeView', …)`:

```ts
  it('folds from the configured level on open', () => {
    const { view } = mount(NESTED, null, { foldFromLevel: 2 });
    expect(foldCount(view)).toBe(2);
  });

  it('folds again when the document is replaced', async () => {
    const { state, view } = mount(NESTED, null, { foldFromLevel: 3 });
    state.doc = '{\n  "x": {\n    "y": [\n      2\n    ]\n  }\n}';
    await nextTick();
    expect(foldCount(view)).toBe(1);
  });

  it('applies a new level live and unfolds at 0', async () => {
    const { state, view } = mount(NESTED);
    expect(foldCount(view)).toBe(0);
    state.options = { ...state.options, foldFromLevel: 2 };
    await nextTick();
    expect(foldCount(view)).toBe(2);
    state.options = { ...state.options, foldFromLevel: 0 };
    await nextTick();
    expect(foldCount(view)).toBe(0);
  });

  it('does not fold an invalid document', () => {
    const { view } = mount('{\n  "a": {\n    "b": 1,\n  }\n}', { line: 4, column: 3 }, { foldFromLevel: 1 });
    expect(foldCount(view)).toBe(0);
  });

  it('exposes folding by level and unfolding', () => {
    const { view, component } = mount(NESTED);
    component.value!.foldFromLevel(3);
    expect(foldCount(view)).toBe(1);
    component.value!.unfoldAll();
    expect(foldCount(view)).toBe(0);
  });
```

Keep the existing `foldAll` test as it is (it still uses the `foldAll` import).

Create `e2e/navigation.spec.ts`:

```ts
import { expect, test } from './fixtures';
import { setStorage } from './storage';

const viewer = 'json-viewer-app';

test.beforeEach(async ({ extensionId }) => {
  expect(extensionId).toMatch(/^[a-p]{32}$/);
});

test('folds from the configured level on open', async ({ context, server }) => {
  await setStorage(context, 'sync', { settings: { viewer: { foldFromLevel: 2 } } });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const content = page.locator(`${viewer} .cm-content`);
  await expect(content).toContainText('"nested": {');
  await expect(content).not.toContainText('"list"');
  await expect(page.locator(`${viewer} .cm-foldPlaceholder`)).toHaveCount(1);
});

test('the options preview folds on open when the setting changes', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(options.locator('.opt-preview .cm-content')).toContainText('"maintainers"');
  await options.getByLabel('Fold on open').selectOption({ label: 'Show 1 level' });
  await expect(options.locator('.opt-preview .cm-content')).not.toContainText('"roles"');
});
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `pnpm exec vitest run src/viewer/prepare.test.ts src/settings/schema.test.ts src/components/CodeView.test.ts`
Expected: FAIL. `foldFromLevel` is missing from the defaults, the validator and CodeView.

- [ ] **Step 3: Implement**

`src/viewer/options.ts`: add the field and the level helpers.

```ts
/** Viewer behaviour; mirrors the original extension's "Add-ons" and "Structure" options. */
export interface ViewerOptions {
  showHeader: boolean;
  sortKeys: boolean;
  clickableUrls: boolean;
  wrapLinkWithAnchorTag: boolean;
  openLinksInNewWindow: boolean;
  autoHighlight: boolean;
  lineNumbers: boolean;
  lineWrapping: boolean;
  foldGutter: boolean;
  tabSize: number;
  indentCStyle: boolean;
  showArraySize: boolean;
  /** Fold containers this deep or deeper on open (top-level value = 1); 0 = off. Replaces "alwaysFold". */
  foldFromLevel: number;
}

export const defaultViewerOptions: ViewerOptions = {
  showHeader: true,
  sortKeys: false,
  clickableUrls: true,
  wrapLinkWithAnchorTag: false,
  openLinksInNewWindow: true,
  autoHighlight: true,
  lineNumbers: true,
  lineWrapping: true,
  foldGutter: true,
  tabSize: 2,
  indentCStyle: false,
  showArraySize: false,
  foldFromLevel: 0,
};

/** Fold levels offered in the UI; level 1 would fold the whole document into one line. */
export const FOLD_LEVELS = [2, 3, 4, 5, 6] as const;

/** "Fold all" keeps the top-level value open and folds everything inside it. */
export const FOLD_ALL_LEVEL = 2;

/** How a fold level reads in the UI: level 2 shows one level of the document. */
export function foldLevelLabel(level: number): string {
  const shown = level - 1;
  return `Show ${shown} level${shown === 1 ? '' : 's'}`;
}
```

`src/settings/schema.ts`: import `FOLD_LEVELS` next to `defaultViewerOptions`, and add the validator after `showArraySize: bool,`:

```ts
import { defaultViewerOptions, FOLD_LEVELS, type ViewerOptions } from '@/viewer/options';
```

```ts
  foldFromLevel: oneOf<number>([0, ...FOLD_LEVELS]),
```

`src/components/CodeView.vue`: fold on open and expose the fold commands. Replace the whole file:

```vue
<script setup lang="ts">
import { unfoldAll } from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { errorPosition, type ErrorLocation } from '@/editor/errorLine';
import { foldFromLevel } from '@/editor/foldLevel';
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

function applyFoldOnOpen(): void {
  // An invalid document opens on its error; folding could hide it.
  if (!view || props.error !== null) return;
  foldFromLevel(view, props.options.foldFromLevel);
}

onMounted(() => {
  view = new EditorView({
    state: EditorState.create({ doc: props.doc, extensions: config.of(currentExtensions()) }),
    parent: host.value!,
  });
  applyFoldOnOpen();
  revealError();
  // Without focus Ctrl+F opens the browser find, which misses virtualized content.
  view.focus();
});

watch(
  () => props.doc,
  (doc) => {
    if (!view) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: doc } });
    applyFoldOnOpen();
  },
);

watch(
  () => props.options.foldFromLevel,
  () => applyFoldOnOpen(),
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

defineExpose({
  foldFromLevel(level: number): void {
    if (view) foldFromLevel(view, level);
  },
  unfoldAll(): void {
    if (view) unfoldAll(view);
  },
});
</script>

<template>
  <div ref="host" class="jv-code" />
</template>
```

`src/options/sections/StructureSection.vue`: add the select after "Show fold arrows". Replace the whole file:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import NumberField from '../fields/NumberField.vue';
import SelectField from '../fields/SelectField.vue';
import ToggleField from '../fields/ToggleField.vue';
import type { SelectOption } from '../types';
import { TAB_SIZE_MAX, TAB_SIZE_MIN } from '@/settings/schema';
import { FOLD_LEVELS, foldLevelLabel, type ViewerOptions } from '@/viewer/options';

const props = defineProps<{ viewer: ViewerOptions }>();

const foldOptions: SelectOption[] = [
  { value: '0', label: 'Off' },
  ...FOLD_LEVELS.map((level) => ({ value: String(level), label: foldLevelLabel(level) })),
];
const foldFromLevel = computed({
  get: () => String(props.viewer.foldFromLevel),
  set: (value: string) => {
    props.viewer.foldFromLevel = Number(value);
  },
});
</script>

<template>
  <section id="structure" class="opt-section">
    <h2>Structure</h2>
    <NumberField v-model="viewer.tabSize" label="Indent size (spaces)" :min="TAB_SIZE_MIN" :max="TAB_SIZE_MAX" />
    <ToggleField v-model="viewer.lineNumbers" label="Show line numbers" />
    <ToggleField v-model="viewer.lineWrapping" label="Wrap long lines" />
    <ToggleField v-model="viewer.foldGutter" label="Show fold arrows" />
    <SelectField
      v-model="foldFromLevel"
      label="Fold on open"
      :options="foldOptions"
      hint="&quot;Show 1 level&quot; is the original extension's &quot;alwaysFold&quot;."
    />
    <ToggleField v-model="viewer.showArraySize" label="Show item counts on folded blocks" />
    <ToggleField v-model="viewer.indentCStyle" label="C-style braces" hint="Opening braces on their own line." />
  </section>
</template>
```

The `settings.viewer` object is reactive, so assigning to `props.viewer.foldFromLevel` updates the settings. This is the same thing `v-model="viewer.tabSize"` already does. If `vue-tsc` rejects the assignment because props are readonly, change the setter body to `Object.assign(props.viewer, { foldFromLevel: Number(value) })`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test && pnpm compile`
Expected: PASS.

Run: `pnpm build && pnpm exec playwright test e2e/navigation.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/viewer/options.ts src/viewer/prepare.test.ts src/settings/schema.ts src/settings/schema.test.ts src/components/CodeView.vue src/components/CodeView.test.ts src/options/sections/StructureSection.vue e2e/navigation.spec.ts
git commit -m "feat(viewer): fold from a configurable level on open"
```

---

### Task 4: Cancel pending URL clicks on destroy and on keyboard selection

**Files:**
- Modify: `src/editor/urls.ts`, `src/editor/urls.test.ts`, `docs/notes/pendientes-fase-0-1.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: `clickableUrls(opts)` keeps its signature. The pending navigation timer now lives in the ViewPlugin instance. It is cleared in `destroy()` (view destroyed, or the extension reconfigured away) and when an update leaves a non-empty selection (keyboard selection such as Shift+arrows).

- [ ] **Step 1: Write the failing tests**

In `src/editor/urls.test.ts`:
- Add `// @vitest-environment happy-dom` as the first line.
- Replace the first import with these imports:

```ts
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { clickableUrls, linkMarkSpec, linkTarget, URL_PATTERN } from './urls';
```

- Append this block:

```ts
describe('clickableUrls click handling', () => {
  let view: EditorView | undefined;
  let open: MockInstance<typeof window.open>;

  beforeEach(() => {
    vi.useFakeTimers();
    open = vi.spyOn(window, 'open').mockReturnValue(null);
  });

  afterEach(() => {
    view?.destroy();
    view = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  function mountLink(): HTMLElement {
    view = new EditorView({
      state: EditorState.create({
        doc: '"https://example.com/a"',
        extensions: clickableUrls({ wrapLinkWithAnchorTag: false, openLinksInNewWindow: true }),
      }),
      parent: document.body,
    });
    return view.dom.querySelector<HTMLElement>('.cm-url')!;
  }

  const click = (target: HTMLElement) =>
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, detail: 1 }));

  it('opens the link after the double-click grace period', () => {
    click(mountLink());
    vi.advanceTimersByTime(399);
    expect(open).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(open).toHaveBeenCalledWith('https://example.com/a', '_blank', 'noopener');
  });

  it('does not open the link once the view is destroyed', () => {
    click(mountLink());
    view!.destroy();
    view = undefined;
    vi.advanceTimersByTime(1000);
    expect(open).not.toHaveBeenCalled();
  });

  it('does not open the link when a selection follows the click', () => {
    click(mountLink());
    view!.dispatch({ selection: { anchor: 1, head: 6 } });
    vi.advanceTimersByTime(1000);
    expect(open).not.toHaveBeenCalled();
  });
});
```

In `docs/notes/pendientes-fase-0-1.md`, delete the whole "## Fase 4 (navegación)" section (its heading and its bullet).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/editor/urls.test.ts`
Expected: the first new test PASSES, which proves synthetic clicks reach the handler. The other two FAIL because `window.open` is still called.

- [ ] **Step 3: Implement**

In `src/editor/urls.ts`, replace `clickableUrls` (keep everything above it unchanged):

```ts
export function clickableUrls(opts: LinkOptions): Extension {
  const decorator = new MatchDecorator({
    regexp: URL_PATTERN,
    decoration: (match) => Decoration.mark(linkMarkSpec(match[0], opts)),
  });

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      pending: ReturnType<typeof setTimeout> | undefined;

      constructor(view: EditorView) {
        this.decorations = decorator.createDeco(view);
      }

      update(update: ViewUpdate) {
        this.decorations = decorator.updateDeco(update, this.decorations);
        // A selection right after the click (Shift+arrows, a drag) means the user is selecting text.
        if (update.selectionSet && !update.state.selection.main.empty) this.cancel();
      }

      cancel(): void {
        clearTimeout(this.pending);
        this.pending = undefined;
      }

      destroy() {
        this.cancel();
      }
    },
    {
      decorations: (instance) => instance.decorations,
      // The editor is contenteditable, so anchors don't navigate on their own.
      // The first click of a double-click has detail 1 too, so navigation waits briefly:
      // a follow-up click (detail > 1) or a selection cancels it.
      eventHandlers: {
        click(event, view) {
          if (event.button !== 0) return false;
          if (event.detail > 1 || !view.state.selection.main.empty) {
            this.cancel();
            return false;
          }
          const link = (event.target as HTMLElement | null)?.closest?.<HTMLElement>('.cm-url');
          const url = link?.dataset.url;
          if (!url) return false;
          event.preventDefault();
          this.cancel();
          this.pending = setTimeout(() => {
            this.pending = undefined;
            if (linkTarget(opts) === '_blank') window.open(url, '_blank', 'noopener');
            else window.location.href = url;
          }, DOUBLE_CLICK_GRACE_MS);
          return true;
        },
      },
    },
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/editor/urls.test.ts`
Expected: PASS (all tests, old and new).

Run: `pnpm build && pnpm exec playwright test e2e/viewer.spec.ts -g "URL"`
Expected: PASS (`opens clicked URLs in a new tab`, `does not open tabs when double-clicking a URL`).

- [ ] **Step 5: Commit**

```bash
pnpm test && pnpm compile
git add src/editor/urls.ts src/editor/urls.test.ts docs/notes/pendientes-fase-0-1.md
git commit -m "fix(editor): cancel pending URL navigation on destroy and on selection"
```

---

### Task 5: Status figures, clipboard and download helpers

**Files:**
- Create: `src/viewer/stats.ts`, `src/viewer/stats.test.ts`, `src/viewer/clipboard.ts`, `src/viewer/clipboard.test.ts`, `src/viewer/download.ts`, `src/viewer/download.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `byteLength(text: string): number`: UTF-8 bytes.
  - `formatBytes(bytes: number): string`: `"95 B"`, `"12.4 KB"`, `"4.0 MB"` (1024-based, one decimal from KB up).
  - `countLines(text: string): number`: like CodeMirror; `\n`, `\r\n` and a lone `\r` end a line, and `""` is 1 line.
  - `formatCount(count: number, singular: string, plural?: string): string`: `"1 line"`, `"1,203 lines"`, `"3 matches"` (en-US grouping).
  - `copyText(text: string, container: HTMLElement): Promise<boolean>`: Clipboard API first, then a hidden textarea inside `container` plus `execCommand('copy')`. Restores focus and never throws.
  - `downloadName(url: string): string`, `downloadText(text: string, filename: string): void`

- [ ] **Step 1: Write the failing tests**

`src/viewer/stats.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { byteLength, countLines, formatBytes, formatCount } from './stats';

describe('byteLength', () => {
  it('counts UTF-8 bytes', () => {
    expect(byteLength('')).toBe(0);
    expect(byteLength('{"a":1}')).toBe(7);
    expect(byteLength('ñ')).toBe(2);
    expect(byteLength('こ')).toBe(3);
    expect(byteLength('😀')).toBe(4);
  });
});

describe('formatBytes', () => {
  it('uses B below 1 KB and one decimal above', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(12_697)).toBe('12.4 KB');
    expect(formatBytes(4_166_671)).toBe('4.0 MB');
  });
});

describe('countLines', () => {
  it('counts lines like CodeMirror does', () => {
    expect(countLines('')).toBe(1);
    expect(countLines('a')).toBe(1);
    expect(countLines('a\nb')).toBe(2);
    expect(countLines('a\r\nb')).toBe(2);
    expect(countLines('a\rb')).toBe(2);
    expect(countLines('a\n')).toBe(2);
  });
});

describe('formatCount', () => {
  it('pluralizes and groups digits', () => {
    expect(formatCount(1, 'line')).toBe('1 line');
    expect(formatCount(0, 'line')).toBe('0 lines');
    expect(formatCount(450_002, 'line')).toBe('450,002 lines');
    expect(formatCount(3, 'match', 'matches')).toBe('3 matches');
    expect(formatCount(1, 'match', 'matches')).toBe('1 match');
  });
});
```

`src/viewer/clipboard.test.ts`:

```ts
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

let container: HTMLElement;

function setClipboard(value: unknown): void {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

function setExecCommand(impl: (command: string) => boolean): ReturnType<typeof vi.fn> {
  const fn = vi.fn(impl);
  Object.defineProperty(document, 'execCommand', { value: fn, configurable: true });
  return fn;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('copyText', () => {
  it('uses the Clipboard API when it is available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    const exec = setExecCommand(() => true);
    expect(await copyText('$.a', container)).toBe(true);
    expect(writeText).toHaveBeenCalledWith('$.a');
    expect(exec).not.toHaveBeenCalled();
  });

  it('falls back to a selected textarea without the Clipboard API (plain http pages)', async () => {
    setClipboard(undefined);
    let copied: string | undefined;
    const exec = setExecCommand((command) => {
      copied = container.querySelector('textarea')?.value;
      return command === 'copy';
    });
    expect(await copyText('{"a":1}', container)).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(copied).toBe('{"a":1}');
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('falls back when the Clipboard API rejects', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('Document is not focused')) });
    const exec = setExecCommand(() => true);
    expect(await copyText('x', container)).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('reports failure when both ways fail', async () => {
    setClipboard(undefined);
    setExecCommand(() => {
      throw new Error('not allowed');
    });
    expect(await copyText('x', container)).toBe(false);
    setExecCommand(() => false);
    expect(await copyText('x', container)).toBe(false);
  });

  it('gives focus back to the element that had it', async () => {
    setClipboard(undefined);
    setExecCommand(() => true);
    const button = document.createElement('button');
    container.append(button);
    button.focus();
    await copyText('x', container);
    expect(document.activeElement).toBe(button);
  });
});
```

`src/viewer/download.test.ts`:

```ts
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadName, downloadText } from './download';

describe('downloadName', () => {
  it('uses the last path segment and adds .json', () => {
    expect(downloadName('https://api.test/v1/users')).toBe('users.json');
    expect(downloadName('https://api.test/data.json?page=2#x')).toBe('data.json');
    expect(downloadName('https://api.test/a%20b.JSON')).toBe('a b.JSON');
  });

  it('falls back to data.json', () => {
    for (const url of ['', 'not a url', 'https://api.test/', 'https://api.test/...', 'https://api.test/%E0%A4%A']) {
      expect(downloadName(url)).toBe('data.json');
    }
  });

  it('replaces characters that are not allowed in file names', () => {
    expect(downloadName('https://api.test/a%2Fb%3Ac')).toBe('a_b_c.json');
  });

  it('keeps names short', () => {
    expect(downloadName(`https://api.test/${'x'.repeat(300)}`)).toBe(`${'x'.repeat(100)}.json`);
  });
});

describe('downloadText', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('clicks a temporary link to a JSON blob and revokes it later', () => {
    vi.useFakeTimers();
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    let clicked: HTMLAnchorElement | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked = this;
    });

    downloadText('{"a":1}', 'users.json');

    const blob = create.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe('application/json');
    expect(clicked?.href).toBe('blob:test');
    expect(clicked?.download).toBe('users.json');
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/viewer/stats.test.ts src/viewer/clipboard.test.ts src/viewer/download.test.ts`
Expected: FAIL. None of the three modules exist yet.

- [ ] **Step 3: Implement**

`src/viewer/stats.ts`:

```ts
const KB = 1024;
const MB = KB * 1024;

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function formatBytes(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

/** Lines as CodeMirror counts them: \n, \r\n and a lone \r each end one. */
export function countLines(text: string): number {
  let lines = 1;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 10 || (code === 13 && text.charCodeAt(i + 1) !== 10)) lines++;
  }
  return lines;
}

export function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? singular : plural}`;
}
```

`src/viewer/clipboard.ts`:

```ts
/**
 * Copies `text`, falling back to a selected textarea plus execCommand where the Clipboard API is
 * missing (plain-http pages aren't secure contexts) or refuses. Both need the click or key press
 * that triggered the copy, so no clipboard permission is required.
 */
export async function copyText(text: string, container: HTMLElement): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Not focused, or blocked by a permissions policy: try the old way.
  }
  return copyWithSelection(text, container);
}

function copyWithSelection(text: string, container: HTMLElement): boolean {
  const root = container.getRootNode() as Document | ShadowRoot;
  const previous = root.activeElement instanceof HTMLElement ? root.activeElement : null;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
  container.append(area);
  area.focus();
  area.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  previous?.focus({ preventScroll: true });
  return copied;
}
```

`src/viewer/download.ts`:

```ts
const FALLBACK_NAME = 'data.json';
const MAX_NAME_LENGTH = 100;
// Revoking right away can cancel the download in some browsers.
const REVOKE_DELAY_MS = 10_000;
const UNSAFE_CHARS = /[\\/:*?"<>|\u0000-\u001f]+/g;

/** File name for saving `url`'s JSON: its last path segment, ending in .json. */
export function downloadName(url: string): string {
  let segment: string;
  try {
    const path = new URL(url).pathname;
    segment = decodeURIComponent(path.slice(path.lastIndexOf('/') + 1));
  } catch {
    return FALLBACK_NAME;
  }
  const name = segment
    .replace(UNSAFE_CHARS, '_')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, MAX_NAME_LENGTH);
  if (name === '') return FALLBACK_NAME;
  return /\.json$/i.test(name) ? name : `${name}.json`;
}

/** Saves `text` as a file through a temporary blob link. */
export function downloadText(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/viewer/stats.test.ts src/viewer/clipboard.test.ts src/viewer/download.test.ts`
Expected: PASS.

If happy-dom lacks `HTMLElement.focus({ preventScroll })` or `textarea.select()`, keep the code as written and say so in your report. These are standard DOM APIs, and the e2e tests in Tasks 8 and 9 exercise the real browser.

- [ ] **Step 5: Commit**

```bash
pnpm test && pnpm compile
git add src/viewer/stats.ts src/viewer/stats.test.ts src/viewer/clipboard.ts src/viewer/clipboard.test.ts src/viewer/download.ts src/viewer/download.test.ts
git commit -m "feat(viewer): add size, line, clipboard and download helpers"
```

---

### Task 6: JSONPath filtering core

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (via `pnpm add`), `src/viewer/prepare.ts`, `src/viewer/prepare.test.ts`
- Create: `src/viewer/jsonPath.ts`, `src/viewer/jsonPath.test.ts`

**Interfaces:**
- Consumes: `formatJson`, `FormatOptions` (`src/parse/format.ts`: `{ indent: number; sortKeys: boolean; cStyle: boolean }`); `parseJson` (`src/parse/parse.ts`); `formatPath` (Task 1, test only).
- Produces:
  - `PreparedDocument` becomes `{ ok: true; text: string; value: unknown } | { ok: false; text: string; error: ParseError }`. `value` is the parsed document, with big numbers kept as `JSON.rawJSON`.
  - `type FilterResult = { ok: true; text: string; value: unknown[]; count: number } | { ok: false; message: string }`
  - `filterDocument(value: unknown, path: string, format: FormatOptions): FilterResult`: runs `JSONPath({ path, json, eval: 'safe', wrap: true })` and formats the match array. It never throws.

Behavior of jsonpath-plus 11.1.0, verified 2026-10-12:
- It is lenient: `$.[` returns results rather than an error.
- Only some malformed paths throw, e.g. `$.a[?(@.id >`, which throws `Unexpected "?" at character 0`.
- An empty path returns `[]`. The viewer treats an empty field as "no filter" (Task 10).

- [ ] **Step 1: Add the dependency**

Run: `pnpm add --save-exact jsonpath-plus@11.1.0`
Expected: `package.json` gets `"jsonpath-plus": "11.1.0"` under `dependencies`.

- [ ] **Step 2: Write the failing tests**

In `src/viewer/prepare.test.ts`, add `value` to the expectations of valid documents:
- In `formats valid JSON with the configured tab size`, the first expectation becomes `{ ok: true, text: '{\n  "a": [\n    1\n  ]\n}', value: { a: [1] } }`, and the second `{ ok: true, text: '{\n    "a": 1\n}', value: { a: 1 } }`.
- In `strips the BOM from valid and invalid input`, the valid expectation becomes `{ ok: true, text: '{\n  "a": 1\n}', value: { a: 1 } }`.

`src/viewer/jsonPath.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatPath } from '@/editor/cursorPath';
import { parseJson } from '@/parse/parse';
import { filterDocument } from './jsonPath';

const FORMAT = { indent: 2, sortKeys: false, cStyle: false };
const DOC = { a: { list: [{ id: 1, n: 'x' }, { id: 2, n: 'y' }, { id: 3 }] } };

describe('filterDocument', () => {
  it('returns the matches as a formatted array', () => {
    expect(filterDocument(DOC, '$.a.list[*].id', FORMAT)).toEqual({
      ok: true,
      text: '[\n  1,\n  2,\n  3\n]',
      value: [1, 2, 3],
      count: 3,
    });
  });

  it('evaluates filter expressions without eval', () => {
    const result = filterDocument(DOC, '$.a.list[?(@.id > 1)].n', FORMAT);
    expect(result).toMatchObject({ ok: true, value: ['y'], count: 1 });
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterDocument(DOC, '$.nope', FORMAT)).toEqual({ ok: true, text: '[]', value: [], count: 0 });
  });

  it('reports syntax errors', () => {
    const result = filterDocument(DOC, '$.a.list[?(@.id >', FORMAT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).not.toBe('');
  });

  it('cannot reach globals or constructors from a filter', () => {
    for (const path of ['$.a.list[?(alert(1))]', '$.a.list[?(@.constructor.constructor("return 1")())]']) {
      expect(filterDocument(DOC, path, FORMAT).ok).toBe(false);
    }
  });

  it('keeps big numbers exact', () => {
    const parsed = parseJson('{"big":12345678901234567890}');
    if (!parsed.ok) throw new Error('fixture must parse');
    expect(filterDocument(parsed.value, '$.big', FORMAT)).toMatchObject({ ok: true, text: '[\n  12345678901234567890\n]' });
  });

  it('formats with the viewer options', () => {
    const result = filterDocument({ b: 1, a: 2 }, '$', { indent: 4, sortKeys: true, cStyle: false });
    expect(result).toMatchObject({ ok: true, text: '[\n    {\n        "a": 2,\n        "b": 1\n    }\n]' });
  });

  it('finds the value at a copied cursor path', () => {
    const keys = ['a-b', 'k"q', 'a b', 'ñ', '$ref', '', 'a.b', '0', 'x(y)'];
    const doc = Object.fromEntries(keys.map((key, i) => [key, { v: [i, { w: i }] }]));
    keys.forEach((key, i) => {
      expect(filterDocument(doc, formatPath([key, 'v', 1, 'w']), FORMAT)).toMatchObject({ ok: true, value: [i] });
    });
  });

  it('works on documents that are not objects', () => {
    expect(filterDocument(5, '$', FORMAT)).toMatchObject({ ok: true, value: [5] });
    expect(filterDocument([null], '$[0]', FORMAT)).toMatchObject({ ok: true, value: [null] });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/viewer/prepare.test.ts src/viewer/jsonPath.test.ts`
Expected: FAIL. `value` is missing from `prepareDocument`, and `./jsonPath` does not exist.

- [ ] **Step 4: Implement**

`src/viewer/prepare.ts`: change the type and the success return.

```ts
export type PreparedDocument =
  | { ok: true; text: string; value: unknown }
  | { ok: false; text: string; error: ParseError };
```

```ts
    return { ok: true, text, value: parsed.value };
```

`src/viewer/jsonPath.ts`:

```ts
import { JSONPath } from 'jsonpath-plus';
import { formatJson, type FormatOptions } from '@/parse/format';

export type FilterResult =
  | { ok: true; text: string; value: unknown[]; count: number }
  | { ok: false; message: string };

/** Runs a JSONPath query and formats the array of matches like the document. Never throws. */
export function filterDocument(value: unknown, path: string, format: FormatOptions): FilterResult {
  let matches: unknown;
  try {
    // 'safe' interprets filter expressions itself: no eval or Function, so it is CSP-safe.
    matches = JSONPath({ path, json: value as object, eval: 'safe', wrap: true });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
  const list = Array.isArray(matches) ? (matches as unknown[]) : [];
  try {
    return { ok: true, text: formatJson(list, format), value: list, count: list.length };
  } catch (e) {
    return { ok: false, message: e instanceof RangeError ? 'The result is nested too deeply to format' : String(e) };
  }
}
```

If the type check rejects `value as object` because `json` is typed as a union, use `value as Parameters<typeof JSONPath>[0]['json']` instead. Do not use `any`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/viewer/prepare.test.ts src/viewer/jsonPath.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
pnpm test && pnpm compile
git add package.json pnpm-lock.yaml src/viewer/prepare.ts src/viewer/prepare.test.ts src/viewer/jsonPath.ts src/viewer/jsonPath.test.ts
git commit -m "feat(viewer): filter documents with JSONPath"
```

---

### Task 7: Shortcut settings and key matching

**Files:**
- Create: `src/settings/shortcuts.ts`, `src/settings/shortcuts.test.ts`
- Modify: `src/settings/schema.ts`, `src/settings/schema.test.ts`

**Interfaces:**
- Consumes: `validateFields`, `FieldValidator`, `ObjectValidators` (`src/settings/fields.ts`).
- Produces:
  - `SHORTCUT_ACTIONS = ['search', 'filter', 'toggleRaw', 'foldAll', 'unfoldAll', 'copyPath'] as const`, `type ShortcutAction`
  - `type Shortcuts = Record<ShortcutAction, string>`
  - `defaultShortcuts: Shortcuts`: `{ search: 'Ctrl+F', filter: 'Ctrl+Shift+F', toggleRaw: 'Alt+R', foldAll: 'Alt+[', unfoldAll: 'Alt+]', copyPath: 'Ctrl+Shift+C' }` (spec §6.4)
  - `SHORTCUT_LABELS: Record<ShortcutAction, string>`: `Search`, `JSONPath filter`, `Toggle Raw`, `Fold all`, `Unfold all`, `Copy cursor path`
  - `comboFromEvent(event: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>): string | null`
  - `isValidShortcut(value: string): boolean`
  - `validateShortcuts(input: unknown): Shortcuts`
  - `actionFor(shortcuts: Shortcuts, combo: string): ShortcutAction | null`
  - `conflictWith(shortcuts: Shortcuts, action: ShortcutAction): ShortcutAction | null`
  - `Settings.shortcuts: Shortcuts` (default `defaultShortcuts`)

- [ ] **Step 1: Write the failing tests**

`src/settings/shortcuts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  actionFor,
  comboFromEvent,
  conflictWith,
  defaultShortcuts,
  isValidShortcut,
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
```

In `src/settings/schema.test.ts`:
- Add the import `import { defaultShortcuts } from './shortcuts';`.
- Add `shortcuts: defaultShortcuts,` to the three object literals that list every settings field: in `defaults to auto mode with Light+ and Dark+`, in `keeps valid values` (use `shortcuts: { ...defaultShortcuts, toggleRaw: 'Ctrl+Alt+R' }` there), and in the expected result of `replaces each invalid field with its default and keeps the rest`.
- Add the test:

```ts
  it('validates shortcuts per action', () => {
    const result = validateSettings({ shortcuts: { search: '', filter: 'nope' } });
    expect(result.shortcuts).toEqual({ ...defaultShortcuts, search: '' });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/settings/shortcuts.test.ts src/settings/schema.test.ts`
Expected: FAIL. `./shortcuts` does not exist, and `shortcuts` is missing from `Settings`.

- [ ] **Step 3: Implement**

`src/settings/shortcuts.ts`:

```ts
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

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  search: 'Search',
  filter: 'JSONPath filter',
  toggleRaw: 'Toggle Raw',
  foldAll: 'Fold all',
  unfoldAll: 'Unfold all',
  copyPath: 'Copy cursor path',
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

/** "Ctrl+Alt+Shift+Meta+Key" for a key press; null for modifier keys on their own and unknown keys. */
export function comboFromEvent(event: KeyPress): string | null {
  const key = keyFromCode(event.code);
  if (key === null) return null;
  const parts = [
    event.ctrlKey ? 'Ctrl' : '',
    event.altKey ? 'Alt' : '',
    event.shiftKey ? 'Shift' : '',
    event.metaKey ? 'Meta' : '',
    key,
  ];
  return parts.filter((part) => part !== '').join('+');
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
```

`src/settings/schema.ts`:
- Import `import { defaultShortcuts, validateShortcuts, type Shortcuts } from './shortcuts';`.
- Add `shortcuts: Shortcuts;` to `Settings`, `shortcuts: defaultShortcuts,` to `defaultSettings`, and `shortcuts: (value) => validateShortcuts(value),` to `settingsValidators`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test && pnpm compile`
Expected: PASS. If other existing tests compare whole `Settings` objects literally and now fail only because `shortcuts` is missing, add `shortcuts: defaultShortcuts` there too and mention it in your report.

- [ ] **Step 5: Commit**

```bash
git add src/settings/shortcuts.ts src/settings/shortcuts.test.ts src/settings/schema.ts src/settings/schema.test.ts
git commit -m "feat(settings): add configurable keyboard shortcuts"
```

---

### Task 8: Status bar with the cursor path

**Files:**
- Create: `src/components/ViewerStatusBar.vue`
- Modify: `src/components/CodeView.vue`, `src/components/CodeView.test.ts`, `src/components/JsonViewer.vue`, `src/components/JsonViewer.test.ts`, `src/components/viewer.css`, `e2e/fixtures.ts`, `e2e/server.ts`, `e2e/navigation.spec.ts`

**Interfaces:**
- Consumes: `cursorPath(onChange)` (Task 1); `byteLength`, `countLines`, `formatBytes`, `formatCount`, `copyText` (Task 5).
- Produces:
  - `CodeView` emits `path: [path: string]`.
  - `ViewerStatusBar` props `{ path: string | null; size: string; lines: string; format: string; note?: string; message?: string }`, emits `copyPath: []`. Classes: `.jv-status`, `.jv-path` (a button, `aria-label="Copy path <path>"`), `.jv-status-message` (`role="status"`), `.jv-status-info`.
  - `JsonViewer` gains the prop `format?: string` (default `'JSON'`) and these internals, which later tasks extend:
    - `root` (template ref on `.jv-root`) and `cursorPath` (ref, starts at `'$'`)
    - `flash(text: string): void`: status-bar message for 2 s
    - `copy(text: string | null, what: string): Promise<void>`: flashes `Copied <what>` or `Copy failed`
    - `copyPath(): void`
  - `FixtureServer.insecureUrl(path)`: the same server on `http://jv.test:<port>`, which is not a secure context. The browser maps `jv.test` to 127.0.0.1.

- [ ] **Step 1: Write the failing tests**

`src/components/CodeView.test.ts`: add inside `describe('CodeView', …)`:

```ts
  it('emits the cursor path', async () => {
    host = document.createElement('div');
    document.body.append(host);
    const paths: string[] = [];
    app = createApp({
      render: () =>
        h(CodeView, {
          doc: '{\n  "a": [\n    1\n  ]\n}',
          options: defaultViewerOptions,
          theme: defaultTheme,
          error: null,
          onPath: (path: string) => paths.push(path),
        }),
    });
    app.mount(host);
    const view = EditorView.findFromDOM(host.querySelector<HTMLElement>('.cm-editor')!)!;
    expect(paths).toEqual(['$']);
    view.dispatch({ selection: { anchor: view.state.doc.toString().indexOf('1') } });
    expect(paths.at(-1)).toBe('$.a[0]');
  });
```

`src/components/JsonViewer.test.ts`:
- Change the imports to:

```ts
// @vitest-environment happy-dom
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { defaultLightTheme, defaultTheme } from '@/themes/builtin';
import type { Theme } from '@/themes/types';
import { defaultFontSettings, type FontSettings } from '@/settings/font';
import { defaultViewerOptions } from '@/viewer/options';
import JsonViewer from './JsonViewer.vue';
```

- Replace `mount` and `afterEach` with:

```ts
let app: App | undefined;

type Props = {
  raw?: string;
  font?: FontSettings;
  theme?: Theme;
  customCss?: string;
  source?: { url: string; loadedAt: Date };
  onToggleTheme?: () => void;
  onOpenSettings?: () => void;
};

function mount(props: Props = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  app = createApp({
    render: () => h(JsonViewer, { raw: '{"a":1}', options: defaultViewerOptions, theme: defaultTheme, ...props }),
  });
  app.mount(host);
  return host;
}

function editorOf(host: HTMLElement): EditorView {
  return EditorView.findFromDOM(host.querySelector<HTMLElement>('.cm-editor')!)!;
}

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
}

afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
```

- Add inside `describe('JsonViewer', …)`:

```ts
  it('shows the size, line count and format', () => {
    const info = mount().querySelector('.jv-status-info')!;
    expect(info.textContent).toContain('7 B');
    expect(info.textContent).toContain('3 lines');
    expect(info.textContent).toContain('JSON');
  });

  it('shows the cursor path and copies it on click', async () => {
    const writeText = mockClipboard();
    const host = mount();
    const path = host.querySelector<HTMLButtonElement>('.jv-path')!;
    expect(path.textContent).toBe('$');
    const view = editorOf(host);
    view.dispatch({ selection: { anchor: view.state.doc.toString().indexOf('"a"') + 1 } });
    await nextTick();
    expect(path.textContent).toBe('$.a');
    path.click();
    await vi.waitFor(() => expect(host.querySelector('.jv-status-message')?.textContent).toBe('Copied path'));
    expect(writeText).toHaveBeenCalledWith('$.a');
  });

  it('hides the path and counts raw lines on the Raw tab', async () => {
    const host = mount();
    host.querySelector<HTMLButtonElement>('[role="tab"]:nth-child(2)')!.click();
    await nextTick();
    expect(host.querySelector('.jv-path')).toBeNull();
    expect(host.querySelector('.jv-status-info')?.textContent).toContain('1 line');
  });
```

`e2e/server.ts`: add `insecureUrl` to the interface and the returned object:

```ts
export interface FixtureServer {
  url(path: string): string;
  /** Same server under a name the browser maps to 127.0.0.1; not a secure context. */
  insecureUrl(path: string): string;
  close(): Promise<void>;
}
```

```ts
  return {
    url: (path) => `http://127.0.0.1:${port}${path}`,
    insecureUrl: (path) => `http://jv.test:${port}${path}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
```

`e2e/fixtures.ts`: add the resolver rule to the launch args:

```ts
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        // http://jv.test is a real non-secure origin, like a plain-http internal API.
        '--host-resolver-rules=MAP jv.test 127.0.0.1',
      ],
```

`e2e/navigation.spec.ts`:
- Add `import type { Page } from '@playwright/test';` as the first import.
- Change the `beforeEach` to:

```ts
test.beforeEach(async ({ context, extensionId }) => {
  expect(extensionId).toMatch(/^[a-p]{32}$/);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

/** Reads the clipboard from a page on a secure origin. */
function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}
```

- Append:

```ts
test('shows the cursor path, size, lines and format', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .jv-status-info`)).toHaveText(/95 B.*12 lines.*JSON/);
  await page.locator(`${viewer} .cm-line`, { hasText: '"list"' }).click();
  await expect(page.locator(`${viewer} .jv-path`)).toHaveText('$.nested.list');
});

test('copies the cursor path on click', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await page.locator(`${viewer} .cm-line`, { hasText: '"list"' }).click();
  await page.locator(`${viewer} .jv-path`).click();
  await expect(page.locator(`${viewer} .jv-status-message`)).toHaveText('Copied path');
  expect(await readClipboard(page)).toBe('$.nested.list');
});

test('copies the path on a page without the async Clipboard API', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.insecureUrl('/data.json'));
  expect(await page.evaluate(() => window.isSecureContext)).toBe(false);
  await page.locator(`${viewer} .cm-line`, { hasText: '"list"' }).click();
  await page.locator(`${viewer} .jv-path`).click();
  await expect(page.locator(`${viewer} .jv-status-message`)).toHaveText('Copied path');
  const reader = await context.newPage();
  await reader.goto(server.url('/page.html'));
  expect(await readClipboard(reader)).toBe('$.nested.list');
});
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `pnpm exec vitest run src/components/CodeView.test.ts src/components/JsonViewer.test.ts`
Expected: FAIL. No `path` event and no status bar yet.

- [ ] **Step 3: Implement**

`src/components/ViewerStatusBar.vue`:

```vue
<script setup lang="ts">
withDefaults(
  defineProps<{ path: string | null; size: string; lines: string; format: string; note?: string; message?: string }>(),
  { note: undefined, message: '' },
);
const emit = defineEmits<{ copyPath: [] }>();
</script>

<template>
  <footer class="jv-status">
    <button
      v-if="path !== null"
      type="button"
      class="jv-path"
      :aria-label="`Copy path ${path}`"
      title="Copy path"
      @click="emit('copyPath')"
    >
      {{ path }}
    </button>
    <span class="jv-status-message" role="status">{{ message }}</span>
    <span class="jv-status-info">
      <span v-if="note">{{ note }}</span>
      <span>{{ size }}</span>
      <span>{{ lines }}</span>
      <span>{{ format }}</span>
    </span>
  </footer>
</template>
```

`src/components/CodeView.vue`:
- Import `import { cursorPath } from '@/editor/cursorPath';`.
- Declare the emit after `props`: `const emit = defineEmits<{ path: [path: string] }>();`.
- In `onMounted`, keep the path listener outside the compartment so reconfiguring never recreates it:

```ts
  view = new EditorView({
    state: EditorState.create({
      doc: props.doc,
      extensions: [config.of(currentExtensions()), cursorPath((path) => emit('path', path))],
    }),
    parent: host.value!,
  });
```

`src/components/JsonViewer.vue`: replace the whole file:

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import CodeView from './CodeView.vue';
import ViewerStatusBar from './ViewerStatusBar.vue';
import ViewerToolbar from './ViewerToolbar.vue';
import { fontCssVars } from '@/fonts/css';
import type { FontSettings } from '@/settings/font';
import { toCssVars } from '@/themes/css';
import { resolveColors } from '@/themes/resolve';
import type { Theme } from '@/themes/types';
import { copyText } from '@/viewer/clipboard';
import type { ViewerOptions } from '@/viewer/options';
import { prepareDocument } from '@/viewer/prepare';
import { byteLength, countLines, formatBytes, formatCount } from '@/viewer/stats';

const props = withDefaults(
  defineProps<{
    raw: string;
    options: ViewerOptions;
    theme: Theme;
    /** Resolved light/dark mode in effect; drives the toolbar toggle. Defaults to the theme's type. */
    kind?: 'light' | 'dark';
    customCss?: string;
    source?: { url: string; loadedAt: Date };
    toggleLabel?: string;
    font?: FontSettings;
    /** Shown in the status bar. */
    format?: string;
  }>(),
  { customCss: '', kind: undefined, source: undefined, toggleLabel: undefined, font: undefined, format: 'JSON' },
);
const emit = defineEmits<{ toggleTheme: []; openSettings: [] }>();

const FLASH_MS = 2000;

// Primitive computeds only notify when their value changes, so replacing the options
// object with unrelated changes (e.g. lineNumbers) doesn't re-run the formatter.
const tabSize = computed(() => props.options.tabSize);
const sortKeys = computed(() => props.options.sortKeys);
const indentCStyle = computed(() => props.options.indentCStyle);
const prepared = computed(() =>
  prepareDocument(props.raw, { tabSize: tabSize.value, sortKeys: sortKeys.value, indentCStyle: indentCStyle.value }),
);
const cssVars = computed(() => ({
  ...toCssVars(resolveColors(props.theme)),
  ...(props.font ? fontCssVars(props.font) : {}),
}));
// autoHighlight=false starts on Raw; the Code tab still formats on demand.
const mode = ref<'code' | 'raw'>(props.options.autoHighlight ? 'code' : 'raw');

const root = ref<HTMLElement>();
const cursorPath = ref('$');
const size = computed(() => formatBytes(byteLength(props.raw)));
const lines = computed(() => formatCount(countLines(mode.value === 'code' ? prepared.value.text : props.raw), 'line'));

const message = ref('');
let flashTimer: ReturnType<typeof setTimeout> | undefined;
function flash(text: string): void {
  message.value = text;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    message.value = '';
  }, FLASH_MS);
}
onBeforeUnmount(() => clearTimeout(flashTimer));

async function copy(text: string | null, what: string): Promise<void> {
  if (text === null || !root.value) return;
  flash((await copyText(text, root.value)) ? `Copied ${what}` : 'Copy failed');
}

function copyPath(): void {
  void copy(cursorPath.value, 'path');
}
</script>

<template>
  <div ref="root" class="jv-root" :class="`jv-${theme.type}`" :style="cssVars">
    <component :is="'style'" v-if="customCss">{{ customCss }}</component>
    <ViewerToolbar
      v-model:mode="mode"
      :source="options.showHeader ? source : undefined"
      :kind="kind ?? theme.type"
      :toggle-label="toggleLabel"
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
      @path="cursorPath = $event"
    />
    <pre v-else class="jv-body jv-raw">{{ raw }}</pre>
    <ViewerStatusBar
      :path="mode === 'code' ? cursorPath : null"
      :size="size"
      :lines="lines"
      :format="format"
      :message="message"
      @copy-path="copyPath"
    />
  </div>
</template>
```

`src/components/viewer.css`: append:

```css
.jv-status {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 22px;
  padding: 2px 8px;
  background: var(--jv-toolbar-background);
  border-top: 1px solid var(--jv-border);
  font-size: 12px;
}

.jv-path {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 4px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-family: var(--jv-font-family);
  font-size: inherit;
  cursor: copy;
}

.jv-path:hover,
.jv-path:focus-visible {
  border-color: var(--jv-border);
}

.jv-status-message {
  white-space: nowrap;
  opacity: 0.8;
}

.jv-status-info {
  margin-left: auto;
  display: flex;
  gap: 12px;
  white-space: nowrap;
  opacity: 0.8;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test && pnpm compile`
Expected: PASS.

Run: `pnpm build && pnpm exec playwright test e2e/navigation.spec.ts e2e/viewer.spec.ts`
Expected: PASS.

If only `copies the path on a page without the async Clipboard API` fails, and the failure is at `readClipboard(reader)` while `Copied path` did appear, headless Chromium is not exposing `execCommand` writes to the async clipboard. Replace the reader lines with a check that the page really used the fallback, by asserting that `navigator.clipboard` is `undefined` there: `expect(await page.evaluate(() => typeof navigator.clipboard)).toBe('undefined')`. Report it as DONE_WITH_CONCERNS and quote the failure.

- [ ] **Step 5: Commit**

```bash
git add src/components/ViewerStatusBar.vue src/components/CodeView.vue src/components/CodeView.test.ts src/components/JsonViewer.vue src/components/JsonViewer.test.ts src/components/viewer.css e2e/fixtures.ts e2e/server.ts e2e/navigation.spec.ts
git commit -m "feat(viewer): status bar with cursor path, size, lines and format"
```

---

### Task 9: Toolbar actions — fold, copy, download, sort keys

**Files:**
- Modify: `src/components/ViewerToolbar.vue`, `src/components/JsonViewer.vue`, `src/components/JsonViewer.test.ts`, `src/components/viewer.css`, `e2e/navigation.spec.ts`

**Interfaces:**
- Consumes: `CodeView` exposed `foldFromLevel(level)` and `unfoldAll()` (Task 3); `FOLD_LEVELS`, `FOLD_ALL_LEVEL`, `foldLevelLabel` (Task 3); `downloadName`, `downloadText` (Task 5); `PreparedDocument.value` (Task 6); `copy`, `flash`, `root` (Task 8).
- Produces:
  - `ViewerToolbar` props: `source?`, `kind`, `toggleLabel?`, `sorted: boolean`, `canFold: boolean`, `canMinify: boolean`.
  - `ViewerToolbar` events: `toggleTheme`, `openSettings`, `foldAll`, `unfoldAll`, `foldLevel: [level: number]`, `copy: [variant: 'formatted' | 'minified']`, `download`, `toggleSort`.
  - `ViewerToolbar` gets a named slot `filter`, rendered after the Code/Raw tabs (Task 10 fills it).
  - Button accessible names: `Fold all`, `Unfold all`, select `Fold to level`, `Copy formatted JSON`, `Copy minified JSON`, `Download JSON`, `Sort keys` (`aria-pressed`).
  - `JsonViewer` internals for later tasks: `codeView` (ref), `sortOverride`, `shown` (computed `{ text: string; value: unknown; valid: boolean; error: ParseError | null }`), `foldTo(level)`, `unfoldEverything()`.

- [ ] **Step 1: Write the failing tests**

`src/components/JsonViewer.test.ts`:
- Add the import `import { foldedRanges } from '@codemirror/language';`.
- Add inside `describe('JsonViewer', …)`:

```ts
  const button = (host: HTMLElement, label: string) => host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;

  it('sorts keys for this tab without touching the setting', async () => {
    const host = mount({ raw: '{"b":1,"a":2}' });
    const sort = button(host, 'Sort keys');
    expect(sort.getAttribute('aria-pressed')).toBe('false');
    sort.click();
    await nextTick();
    expect(editorOf(host).state.doc.line(2).text).toBe('  "a": 2,');
    expect(sort.getAttribute('aria-pressed')).toBe('true');
    expect(defaultViewerOptions.sortKeys).toBe(false);
  });

  it('copies the formatted and the minified document', async () => {
    const writeText = mockClipboard();
    const host = mount({ raw: '{ "a" : [1, 2] }' });
    button(host, 'Copy formatted JSON').click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('{\n  "a": [\n    1,\n    2\n  ]\n}'));
    button(host, 'Copy minified JSON').click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('{"a":[1,2]}'));
    await vi.waitFor(() => expect(host.querySelector('.jv-status-message')?.textContent).toBe('Copied minified JSON'));
  });

  it('disables copy minified for invalid JSON but copies the raw text as formatted', async () => {
    const writeText = mockClipboard();
    const host = mount({ raw: '{"a":' });
    expect(button(host, 'Copy minified JSON').disabled).toBe(true);
    button(host, 'Copy formatted JSON').click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('{"a":'));
  });

  it('downloads the document named after the URL', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    let link: HTMLAnchorElement | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      link = this;
    });
    const host = mount({ source: { url: 'https://api.test/v1/users?page=2', loadedAt: new Date() } });
    button(host, 'Download JSON').click();
    expect(link?.download).toBe('users.json');
  });

  it('folds all, unfolds all and folds to a level', async () => {
    const host = mount({ raw: '{"a":{"b":{"c":[1]}}}' });
    const folds = () => foldedRanges(editorOf(host).state).size;
    button(host, 'Fold all').click();
    expect(folds()).toBe(3);
    button(host, 'Unfold all').click();
    expect(folds()).toBe(0);
    const select = host.querySelector<HTMLSelectElement>('[aria-label="Fold to level"]')!;
    select.value = '4';
    select.dispatchEvent(new Event('change'));
    expect(folds()).toBe(1);
    expect(select.value).toBe('');
  });

  it('disables folding on the Raw tab', async () => {
    const host = mount();
    host.querySelector<HTMLButtonElement>('[role="tab"]:nth-child(2)')!.click();
    await nextTick();
    expect(button(host, 'Fold all').disabled).toBe(true);
    expect(host.querySelector<HTMLSelectElement>('[aria-label="Fold to level"]')!.disabled).toBe(true);
  });
```

`e2e/navigation.spec.ts`:
- Add the import `import { readFile } from 'node:fs/promises';`.
- Append:

```ts
const FORMATTED_DATA = [
  '{',
  '  "name": "x",',
  '  "url": "https://example.com/a",',
  '  "nested": {',
  '    "list": [',
  '      1,',
  '      2,',
  '      3',
  '    ]',
  '  },',
  '  "big": 12345678901234567890',
  '}',
].join('\n');
const MINIFIED_DATA = '{"name":"x","url":"https://example.com/a","nested":{"list":[1,2,3]},"big":12345678901234567890}';

test('folds all and unfolds all', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const content = page.locator(`${viewer} .cm-content`);
  await expect(content).toContainText('"list"');
  await page.getByRole('button', { name: 'Fold all', exact: true }).click();
  await expect(content).not.toContainText('"list"');
  await page.getByRole('button', { name: 'Unfold all', exact: true }).click();
  await expect(content).toContainText('"list"');
});

test('folds and unfolds a 4 MB document', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/big.json'));
  await expect(page.locator(`${viewer} .jv-status-info`)).toContainText('450,002 lines', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Fold all', exact: true }).click();
  await expect(page.locator(`${viewer} .cm-content`)).not.toContainText('"name"', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Unfold all', exact: true }).click();
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"item 0"');
});

test('copies the formatted and the minified document', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await page.getByRole('button', { name: 'Copy formatted JSON' }).click();
  await expect(page.locator(`${viewer} .jv-status-message`)).toHaveText('Copied formatted JSON');
  expect(await readClipboard(page)).toBe(FORMATTED_DATA);
  await page.getByRole('button', { name: 'Copy minified JSON' }).click();
  await expect(page.locator(`${viewer} .jv-status-message`)).toHaveText('Copied minified JSON');
  expect(await readClipboard(page)).toBe(MINIFIED_DATA);
});

test('downloads the formatted document', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download JSON' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('data.json');
  expect(await readFile((await download.path())!, 'utf8')).toBe(FORMATTED_DATA);
});

test('sorts keys for this tab only', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const secondLine = page.locator(`${viewer} .cm-line`).nth(1);
  await expect.poll(() => secondLine.evaluate((el) => el.textContent)).toMatch(/^ {2}"name"/);
  await page.getByRole('button', { name: 'Sort keys' }).click();
  await expect.poll(() => secondLine.evaluate((el) => el.textContent)).toMatch(/^ {2}"big"/);
  const other = await context.newPage();
  await other.goto(server.url('/data.json'));
  await expect
    .poll(() => other.locator(`${viewer} .cm-line`).nth(1).evaluate((el) => el.textContent))
    .toMatch(/^ {2}"name"/);
});
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `pnpm exec vitest run src/components/JsonViewer.test.ts`
Expected: FAIL. The toolbar buttons don't exist yet.

- [ ] **Step 3: Implement**

`src/components/ViewerToolbar.vue`: replace the whole file:

```vue
<script setup lang="ts">
import { FOLD_LEVELS, foldLevelLabel } from '@/viewer/options';

withDefaults(
  defineProps<{
    source?: { url: string; loadedAt: Date };
    kind: 'dark' | 'light';
    toggleLabel?: string;
    sorted: boolean;
    canFold: boolean;
    canMinify: boolean;
  }>(),
  { source: undefined, toggleLabel: 'Toggle light/dark theme' },
);
const emit = defineEmits<{
  toggleTheme: [];
  openSettings: [];
  foldAll: [];
  unfoldAll: [];
  foldLevel: [level: number];
  copy: [variant: 'formatted' | 'minified'];
  download: [];
  toggleSort: [];
}>();
const mode = defineModel<'code' | 'raw'>('mode', { required: true });

function onFoldLevel(event: Event): void {
  const select = event.target as HTMLSelectElement;
  const level = Number(select.value);
  // Back to the placeholder, so picking the same level again folds again.
  select.value = '';
  if (level > 0) emit('foldLevel', level);
}
</script>

<template>
  <header class="jv-toolbar">
    <div class="jv-modes" role="tablist">
      <button type="button" role="tab" :aria-selected="mode === 'code'" @click="mode = 'code'">Code</button>
      <button type="button" role="tab" :aria-selected="mode === 'raw'" @click="mode = 'raw'">Raw</button>
    </div>
    <slot name="filter" />
    <div v-if="source" class="jv-source" :title="source.url">
      <span class="jv-url">{{ source.url }}</span>
      <time :datetime="source.loadedAt.toISOString()">{{ source.loadedAt.toLocaleString() }}</time>
    </div>
    <div class="jv-actions">
      <div class="jv-group" role="group" aria-label="Folding">
        <button type="button" class="jv-icon-button" aria-label="Fold all" title="Fold all" :disabled="!canFold" @click="emit('foldAll')">
          ⊟
        </button>
        <button
          type="button"
          class="jv-icon-button"
          aria-label="Unfold all"
          title="Unfold all"
          :disabled="!canFold"
          @click="emit('unfoldAll')"
        >
          ⊞
        </button>
        <select class="jv-fold-level" aria-label="Fold to level" title="Fold to level" :disabled="!canFold" @change="onFoldLevel">
          <option value="">Levels</option>
          <option v-for="level in FOLD_LEVELS" :key="level" :value="String(level)">{{ foldLevelLabel(level) }}</option>
        </select>
      </div>
      <div class="jv-group" role="group" aria-label="Export">
        <button
          type="button"
          class="jv-icon-button"
          aria-label="Copy formatted JSON"
          title="Copy formatted JSON"
          @click="emit('copy', 'formatted')"
        >
          ⧉
        </button>
        <button
          type="button"
          class="jv-icon-button jv-wide"
          aria-label="Copy minified JSON"
          title="Copy minified JSON"
          :disabled="!canMinify"
          @click="emit('copy', 'minified')"
        >
          ⧉<small>min</small>
        </button>
        <button type="button" class="jv-icon-button" aria-label="Download JSON" title="Download JSON" @click="emit('download')">
          ⬇
        </button>
      </div>
      <button
        type="button"
        class="jv-icon-button"
        aria-label="Sort keys"
        title="Sort keys (this tab only)"
        :aria-pressed="sorted"
        @click="emit('toggleSort')"
      >
        ⇅
      </button>
      <button
        type="button"
        class="jv-icon-button"
        :aria-label="toggleLabel"
        :title="kind === 'dark' ? 'Switch to a light theme' : 'Switch to a dark theme'"
        @click="emit('toggleTheme')"
      >
        {{ kind === 'dark' ? '☀' : '☾' }}
      </button>
      <button type="button" class="jv-icon-button" aria-label="Open settings" title="Settings" @click="emit('openSettings')">
        ⚙
      </button>
    </div>
  </header>
</template>
```

`src/components/JsonViewer.vue`: make these changes to the Task 8 version.

1. Imports. Add `import type { ParseError } from '@/parse/parse';` and `import { downloadName, downloadText } from '@/viewer/download';`. Change the options import to `import { FOLD_ALL_LEVEL, type ViewerOptions } from '@/viewer/options';`.

2. Replace the `sortKeys` computed with a per-tab override:

```ts
// The toolbar's Sort keys button overrides the setting for this tab only.
const sortOverride = ref<boolean | null>(null);
const sortKeys = computed(() => sortOverride.value ?? props.options.sortKeys);
```

3. After `prepared`, add what the Code tab shows. Task 10 adds the filter result here:

```ts
/** What the Code tab shows and what copy/download act on. */
const shown = computed<{ text: string; value: unknown; valid: boolean; error: ParseError | null }>(() => {
  const doc = prepared.value;
  return doc.ok
    ? { text: doc.text, value: doc.value, valid: true, error: null }
    : { text: doc.text, value: undefined, valid: false, error: doc.error };
});
```

4. Change `lines` to count `shown.value.text` on the Code tab:

```ts
const lines = computed(() => formatCount(countLines(mode.value === 'code' ? shown.value.text : props.raw), 'line'));
```

5. After `copyPath`, add:

```ts
const codeView = ref<InstanceType<typeof CodeView>>();

function foldTo(level: number): void {
  codeView.value?.foldFromLevel(level);
}

function unfoldEverything(): void {
  codeView.value?.unfoldAll();
}

function minified(): string | null {
  if (!shown.value.valid) return null;
  try {
    return JSON.stringify(shown.value.value);
  } catch {
    return null;
  }
}

function onCopy(variant: 'formatted' | 'minified'): void {
  void (variant === 'formatted' ? copy(shown.value.text, 'formatted JSON') : copy(minified(), 'minified JSON'));
}

function onDownload(): void {
  downloadText(shown.value.text, downloadName(props.source?.url ?? ''));
}

function toggleSort(): void {
  sortOverride.value = !sortKeys.value;
}
```

6. Template. Pass the new toolbar props and events, and use `shown` for CodeView:

```vue
    <ViewerToolbar
      v-model:mode="mode"
      :source="options.showHeader ? source : undefined"
      :kind="kind ?? theme.type"
      :toggle-label="toggleLabel"
      :sorted="sortKeys"
      :can-fold="mode === 'code'"
      :can-minify="shown.valid"
      @toggle-theme="emit('toggleTheme')"
      @open-settings="emit('openSettings')"
      @fold-all="foldTo(FOLD_ALL_LEVEL)"
      @unfold-all="unfoldEverything"
      @fold-level="foldTo"
      @copy="onCopy"
      @download="onDownload"
      @toggle-sort="toggleSort"
    />
```

```vue
    <CodeView
      v-if="mode === 'code'"
      ref="codeView"
      class="jv-body"
      :doc="shown.text"
      :options="options"
      :theme="theme"
      :error="shown.error"
      @path="cursorPath = $event"
    />
```

`src/components/viewer.css`:
- Add `flex-wrap: wrap;` and `row-gap: 4px;` to the existing `.jv-toolbar` rule, so narrow panes (the options preview) wrap instead of overflowing.
- Append:

```css
.jv-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.jv-icon-button:disabled {
  opacity: 0.4;
  cursor: default;
}

.jv-icon-button[aria-pressed='true'] {
  background: var(--jv-selection);
}

.jv-wide {
  width: auto;
  padding: 0 4px;
}

.jv-wide small {
  font-size: 10px;
}

.jv-fold-level {
  height: 24px;
  border: 1px solid var(--jv-border);
  border-radius: 4px;
  background: var(--jv-background);
  color: inherit;
  font: inherit;
  font-size: 12px;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test && pnpm compile`
Expected: PASS.

Run: `pnpm build && pnpm exec playwright test e2e/navigation.spec.ts e2e/viewer.spec.ts e2e/settings.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ViewerToolbar.vue src/components/JsonViewer.vue src/components/JsonViewer.test.ts src/components/viewer.css e2e/navigation.spec.ts
git commit -m "feat(viewer): fold, copy, download and sort keys from the toolbar"
```

---

### Task 10: JSONPath filter in the toolbar

**Files:**
- Create: `src/components/JsonPathFilter.vue`
- Modify: `src/components/JsonViewer.vue`, `src/components/JsonViewer.test.ts`, `src/components/viewer.css`, `e2e/navigation.spec.ts`

**Interfaces:**
- Consumes: `filterDocument(value, path, format)` and `FilterResult` (Task 6); the `filter` slot of `ViewerToolbar` and `shown` (Task 9).
- Produces:
  - `JsonPathFilter` with `v-model` (string), props `{ active: boolean; error: string | null; disabled: boolean }` and events `apply: [path: string]`, `clear: []`. It exposes `focus(): void`, which focuses and selects the field. Input `aria-label="JSONPath filter"`; clear button `aria-label="Clear filter"`; error `.jv-filter-error` with `role="alert"`.
  - `JsonViewer` internals for Task 11: `filter` (component ref), `filterText`, `appliedPath`, `applyFilter(path)`, `clearFilter()`, `onEscape(event)` (bubble-phase keydown on `.jv-root`).

- [ ] **Step 1: Write the failing tests**

`src/components/JsonViewer.test.ts`: add inside `describe('JsonViewer', …)`:

```ts
  const filterInput = (host: HTMLElement) => host.querySelector<HTMLInputElement>('[aria-label="JSONPath filter"]')!;

  async function runFilter(host: HTMLElement, path: string): Promise<void> {
    const input = filterInput(host);
    input.value = path;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await nextTick();
  }

  it('shows the matches of a JSONPath filter and counts them', async () => {
    const host = mount({ raw: '{"items":[{"id":1},{"id":2}]}' });
    await runFilter(host, '$.items[*].id');
    expect(editorOf(host).state.doc.toString()).toBe('[\n  1,\n  2\n]');
    expect(host.querySelector('.jv-status-info')?.textContent).toContain('2 matches');
  });

  it('goes back to the whole document on Esc', async () => {
    const host = mount({ raw: '{"items":[1]}' });
    await runFilter(host, '$.items');
    filterInput(host).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();
    expect(editorOf(host).state.doc.toString()).toBe('{\n  "items": [\n    1\n  ]\n}');
    expect(filterInput(host).value).toBe('');
  });

  it('goes back to the whole document on Esc in the editor', async () => {
    const host = mount({ raw: '{"items":[1]}' });
    await runFilter(host, '$.items');
    editorOf(host).contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    await nextTick();
    expect(editorOf(host).state.doc.toString()).toBe('{\n  "items": [\n    1\n  ]\n}');
  });

  it('shows syntax errors under the field and keeps the document', async () => {
    const host = mount({ raw: '{"a":[1]}' });
    await runFilter(host, '$.a[?(@ >');
    expect(host.querySelector('.jv-filter-error')?.textContent).not.toBe('');
    expect(editorOf(host).state.doc.toString()).toBe('{\n  "a": [\n    1\n  ]\n}');
  });

  it('copies the filtered result', async () => {
    const writeText = mockClipboard();
    const host = mount({ raw: '{"a":[1,2]}' });
    await runFilter(host, '$.a[0]');
    host.querySelector<HTMLButtonElement>('[aria-label="Copy minified JSON"]')!.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('[1]'));
  });

  it('switches to the Code tab when a filter is applied', async () => {
    const host = mount();
    host.querySelector<HTMLButtonElement>('[role="tab"]:nth-child(2)')!.click();
    await nextTick();
    await runFilter(host, '$.a');
    expect(host.querySelector('.cm-editor')).not.toBeNull();
  });

  it('disables the filter for invalid JSON', () => {
    expect(filterInput(mount({ raw: '{' })).disabled).toBe(true);
  });
```

`e2e/navigation.spec.ts`: append:

```ts
test('filters with JSONPath and goes back with Esc', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const content = page.locator(`${viewer} .cm-content`);
  const filter = page.getByRole('textbox', { name: 'JSONPath filter' });
  await filter.fill('$.nested.list[?(@ > 1)]');
  await filter.press('Enter');
  await expect(content).toHaveText(/^\[\s*2,\s*3\s*\]$/);
  await expect(page.locator(`${viewer} .jv-status-info`)).toContainText('2 matches');
  await filter.press('Escape');
  await expect(content).toContainText('"name": "x"');
});

test('shows JSONPath syntax errors under the field', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const filter = page.getByRole('textbox', { name: 'JSONPath filter' });
  await filter.fill('$.nested[?(@.x >');
  await filter.press('Enter');
  await expect(page.locator(`${viewer} .jv-filter-error`)).toBeVisible();
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name": "x"');
});

test('filters a 4 MB document', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/big.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"item 0"', { timeout: 15_000 });
  const filter = page.getByRole('textbox', { name: 'JSONPath filter' });
  await filter.fill('$[?(@.id == 49999)].name');
  await filter.press('Enter');
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"item 49999"', { timeout: 15_000 });
  await expect(page.locator(`${viewer} .jv-status-info`)).toContainText('1 match');
});
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `pnpm exec vitest run src/components/JsonViewer.test.ts`
Expected: FAIL. There is no filter field yet.

- [ ] **Step 3: Implement**

`src/components/JsonPathFilter.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ active: boolean; error: string | null; disabled: boolean }>();
const emit = defineEmits<{ apply: [path: string]; clear: [] }>();
const text = defineModel<string>({ required: true });
const input = ref<HTMLInputElement>();

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault();
    // Read the field itself: the model only catches up after the parent re-renders.
    emit('apply', (event.target as HTMLInputElement).value);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    emit('clear');
  }
}

function clearAndFocus(): void {
  emit('clear');
  input.value?.focus();
}

defineExpose({
  focus(): void {
    input.value?.focus();
    input.value?.select();
  },
});
</script>

<template>
  <div class="jv-filter" :class="{ 'jv-filter-active': active }">
    <input
      ref="input"
      v-model="text"
      class="jv-filter-input"
      type="text"
      spellcheck="false"
      autocomplete="off"
      aria-label="JSONPath filter"
      placeholder="$.items[*].id"
      :title="disabled ? 'Fix the JSON error to filter' : 'JSONPath filter: Enter applies, Esc clears'"
      :disabled="disabled"
      :aria-invalid="error !== null"
      @keydown="onKeydown"
    />
    <button v-if="active" type="button" class="jv-icon-button" aria-label="Clear filter" title="Clear filter (Esc)" @click="clearAndFocus">
      ×
    </button>
    <p v-if="error" class="jv-filter-error" role="alert">{{ error }}</p>
  </div>
</template>
```

`src/components/JsonViewer.vue`: make these changes to the Task 9 version.

1. Imports. Add `import JsonPathFilter from './JsonPathFilter.vue';` and `import { filterDocument } from '@/viewer/jsonPath';`.

2. Before `shown`, add the filter state and result:

```ts
const filterText = ref('');
/** The filter in effect; applied on Enter so big documents aren't re-queried on every keystroke. */
const appliedPath = ref<string | null>(null);
const formatOptions = computed(() => ({ indent: tabSize.value, sortKeys: sortKeys.value, cStyle: indentCStyle.value }));
const filtered = computed(() => {
  const doc = prepared.value;
  if (appliedPath.value === null || !doc.ok) return null;
  return filterDocument(doc.value, appliedPath.value, formatOptions.value);
});
const filterError = computed(() => (filtered.value && !filtered.value.ok ? filtered.value.message : null));
```

3. Replace `shown` so it prefers a successful filter result:

```ts
/** What the Code tab shows and what copy/download act on: the filter result, or the whole document. */
const shown = computed<{ text: string; value: unknown; valid: boolean; error: ParseError | null }>(() => {
  const result = filtered.value;
  if (result?.ok) return { text: result.text, value: result.value, valid: true, error: null };
  const doc = prepared.value;
  return doc.ok
    ? { text: doc.text, value: doc.value, valid: true, error: null }
    : { text: doc.text, value: undefined, valid: false, error: doc.error };
});
// Filter results open unfolded, whatever "Fold on open" says.
const codeOptions = computed(() => (filtered.value?.ok ? { ...props.options, foldFromLevel: 0 } : props.options));
const matches = computed(() => (filtered.value?.ok ? formatCount(filtered.value.count, 'match', 'matches') : undefined));
```

4. After `toggleSort`, add:

```ts
const filter = ref<InstanceType<typeof JsonPathFilter>>();

function applyFilter(path: string): void {
  const trimmed = path.trim();
  appliedPath.value = trimmed === '' ? null : trimmed;
  if (appliedPath.value !== null) mode.value = 'code';
}

function clearFilter(): void {
  filterText.value = '';
  appliedPath.value = null;
}

/** Esc anywhere in the viewer clears the filter, unless something (the search panel) already used it. */
function onEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.defaultPrevented || appliedPath.value === null) return;
  event.preventDefault();
  clearFilter();
}
```

5. Template:
- The root becomes `<div ref="root" class="jv-root" :class="`jv-${theme.type}`" :style="cssVars" @keydown="onEscape">`.
- Give `ViewerToolbar` the filter slot: keep all of its Task 9 attributes, replace its closing `/>` with `>`, and add this content and closing tag:

```vue
      <template #filter>
        <JsonPathFilter
          ref="filter"
          v-model="filterText"
          :active="appliedPath !== null"
          :error="filterError"
          :disabled="!prepared.ok"
          @apply="applyFilter"
          @clear="clearFilter"
        />
      </template>
    </ViewerToolbar>
```

- On `CodeView`, change `:options="options"` to `:options="codeOptions"`.
- On `ViewerStatusBar`, add `:note="matches"`.

`src/components/viewer.css`: append:

```css
.jv-filter {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 0 1 260px;
  min-width: 140px;
}

.jv-filter-input {
  width: 100%;
  height: 24px;
  padding: 0 6px;
  border: 1px solid var(--jv-border);
  border-radius: 4px;
  background: var(--jv-background);
  color: inherit;
  font-family: var(--jv-font-family);
  font-size: 12px;
}

.jv-filter-active .jv-filter-input {
  border-color: var(--jv-link);
}

.jv-filter-input[aria-invalid='true'] {
  border-color: #f14c4c;
}

.jv-filter-error {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 10;
  margin: 2px 0 0;
  padding: 4px 8px;
  max-width: 420px;
  border: 1px solid #f14c4c;
  border-radius: 4px;
  background: var(--jv-toolbar-background);
  font-size: 12px;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test && pnpm compile`
Expected: PASS.

Run: `pnpm build && pnpm exec playwright test e2e/navigation.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/JsonPathFilter.vue src/components/JsonViewer.vue src/components/JsonViewer.test.ts src/components/viewer.css e2e/navigation.spec.ts
git commit -m "feat(viewer): JSONPath filter in the toolbar"
```

---

### Task 11: Keyboard shortcuts in the viewer

**Files:**
- Modify: `src/editor/setup.ts`, `src/components/CodeView.vue`, `src/components/JsonViewer.vue`, `src/components/JsonViewer.test.ts`, `src/components/viewer.css`, `src/entrypoints/viewer.content/index.ts`, `src/options/PreviewPane.vue`, `e2e/navigation.spec.ts`

**Interfaces:**
- Consumes: `comboFromEvent`, `actionFor`, `defaultShortcuts`, `ShortcutAction`, `Shortcuts` (Task 7); `openSearchPanel` (`@codemirror/search`); from Tasks 8–10: `codeView`, `filter`, `foldTo`, `unfoldEverything`, `copyPath`, `mode`.
- Produces:
  - `JsonViewer` prop `shortcuts?: Shortcuts` (default `defaultShortcuts`).
  - `CodeView` also exposes `openSearch(): void` and `focus(): void`.
  - `buildExtensions` no longer binds `Mod-f`.

Behavior:
- One capture-phase `keydown` listener on `.jv-root` matches `comboFromEvent(event)` against the shortcuts. When an action runs, it calls `preventDefault()` and `stopPropagation()`, so CodeMirror never sees the key.
- Search, the fold actions and Copy cursor path only run on the Code tab. On Raw the key passes through, so Ctrl+F reaches the browser's find.
- The JSONPath filter shortcut focuses and selects the field. Toggle Raw switches tabs and focuses the new content: CodeView focuses itself on mount, and the Raw `<pre>` gets `tabindex="0"` and is focused, so the next shortcut still reaches the viewer.

- [ ] **Step 1: Write the failing tests**

`src/components/JsonViewer.test.ts`:
- Add the import `import { defaultShortcuts, type Shortcuts } from '@/settings/shortcuts';` and add `shortcuts?: Shortcuts;` to the `Props` type.
- Add inside `describe('JsonViewer', …)`:

```ts
  function key(target: EventTarget, code: string, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true, composed: true, ...init });
    target.dispatchEvent(event);
    return event;
  }

  it('toggles Raw with the shortcut and focuses the new content', async () => {
    const host = mount();
    key(editorOf(host).contentDOM, 'KeyR', { key: 'r', altKey: true });
    await vi.waitFor(() => expect(document.activeElement).toBe(host.querySelector('.jv-raw')));
    key(host.querySelector('.jv-raw')!, 'KeyR', { key: 'r', altKey: true });
    await nextTick();
    expect(host.querySelector('.cm-editor')).not.toBeNull();
  });

  it('focuses the filter with the shortcut', () => {
    const host = mount();
    key(editorOf(host).contentDOM, 'KeyF', { key: 'F', ctrlKey: true, shiftKey: true });
    expect(document.activeElement).toBe(host.querySelector('[aria-label="JSONPath filter"]'));
  });

  it('folds and unfolds everything with the shortcuts', () => {
    const host = mount({ raw: '{"a":{"b":[1]}}' });
    const view = editorOf(host);
    key(view.contentDOM, 'BracketLeft', { key: '[', altKey: true });
    expect(foldedRanges(view.state).size).toBe(2);
    key(view.contentDOM, 'BracketRight', { key: ']', altKey: true });
    expect(foldedRanges(view.state).size).toBe(0);
  });

  it('copies the cursor path with the shortcut', async () => {
    const writeText = mockClipboard();
    const host = mount();
    key(editorOf(host).contentDOM, 'KeyC', { key: 'C', ctrlKey: true, shiftKey: true });
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('$'));
  });

  it('opens the editor search with the shortcut', () => {
    const host = mount();
    const event = key(editorOf(host).contentDOM, 'KeyF', { key: 'f', ctrlKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(host.querySelector('.cm-search')).not.toBeNull();
  });

  it('uses custom shortcuts and lets disabled ones reach the browser', async () => {
    const host = mount({ shortcuts: { ...defaultShortcuts, search: '', toggleRaw: 'Ctrl+Alt+Y' } });
    const content = editorOf(host).contentDOM;
    const find = key(content, 'KeyF', { key: 'f', ctrlKey: true });
    expect(find.defaultPrevented).toBe(false);
    expect(host.querySelector('.cm-search')).toBeNull();
    key(content, 'KeyR', { key: 'r', altKey: true });
    await nextTick();
    expect(host.querySelector('.cm-editor')).not.toBeNull();
    key(content, 'KeyY', { key: 'y', ctrlKey: true, altKey: true });
    await nextTick();
    expect(host.querySelector('.jv-raw')).not.toBeNull();
  });

  it('typing in the filter does not trigger shortcuts', async () => {
    const host = mount({ raw: '{"a":{"b":[1]}}' });
    const input = host.querySelector<HTMLInputElement>('[aria-label="JSONPath filter"]')!;
    const typed = [
      key(input, 'KeyR', { key: 'r' }),
      key(input, 'KeyR', { key: 'R', shiftKey: true }),
      // AltGr+[ on a Spanish keyboard arrives as Ctrl+Alt.
      key(input, 'BracketLeft', { key: '[', ctrlKey: true, altKey: true }),
    ];
    await nextTick();
    expect(typed.map((event) => event.defaultPrevented)).toEqual([false, false, false]);
    expect(host.querySelector('.cm-editor')).not.toBeNull();
    expect(foldedRanges(editorOf(host).state).size).toBe(0);
  });

  it('lets Ctrl+F through to the browser on the Raw tab', async () => {
    const host = mount();
    host.querySelector<HTMLButtonElement>('[role="tab"]:nth-child(2)')!.click();
    await nextTick();
    expect(key(host.querySelector('.jv-raw')!, 'KeyF', { key: 'f', ctrlKey: true }).defaultPrevented).toBe(false);
  });
```

`e2e/navigation.spec.ts`: append:

```ts
test('works with the default keyboard shortcuts', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const content = page.locator(`${viewer} .cm-content`);
  await expect(content).toContainText('"list"');
  await page.keyboard.press('Alt+BracketLeft');
  await expect(content).not.toContainText('"list"');
  await page.keyboard.press('Alt+BracketRight');
  await expect(content).toContainText('"list"');
  await page.keyboard.press('Control+Shift+KeyF');
  await expect(page.getByRole('textbox', { name: 'JSONPath filter' })).toBeFocused();
  await page.keyboard.press('Alt+KeyR');
  await expect(page.locator(`${viewer} .jv-raw`)).toBeVisible();
  await page.keyboard.press('Alt+KeyR');
  await expect(content).toBeVisible();
});

test('copies the cursor path with Ctrl+Shift+C', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await page.locator(`${viewer} .cm-line`, { hasText: '"list"' }).click();
  await page.keyboard.press('Control+Shift+KeyC');
  await expect(page.locator(`${viewer} .jv-status-message`)).toHaveText('Copied path');
  expect(await readClipboard(page)).toBe('$.nested.list');
});

test('uses the shortcuts from the settings', async ({ context, server }) => {
  await setStorage(context, 'sync', { settings: { shortcuts: { toggleRaw: 'Ctrl+Alt+Y' } } });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name"');
  // If Alt+R still toggled, the next shortcut would toggle back to Code and the check would fail.
  await page.keyboard.press('Alt+KeyR');
  await page.keyboard.press('Control+Alt+KeyY');
  await expect(page.locator(`${viewer} .jv-raw`)).toBeVisible();
});
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `pnpm exec vitest run src/components/JsonViewer.test.ts`
Expected: FAIL. The shortcut tests fail; the earlier tests still pass.

- [ ] **Step 3: Implement**

`src/editor/setup.ts`: replace the keymap line:

```ts
    // Ctrl+F is a configurable viewer shortcut (JsonViewer), so CodeMirror must not claim it.
    keymap.of([...searchKeymap.filter((binding) => binding.key !== 'Mod-f'), ...foldKeymap, ...defaultKeymap]),
```

`src/components/CodeView.vue`:
- Add `import { openSearchPanel } from '@codemirror/search';`.
- Extend `defineExpose`:

```ts
defineExpose({
  foldFromLevel(level: number): void {
    if (view) foldFromLevel(view, level);
  },
  unfoldAll(): void {
    if (view) unfoldAll(view);
  },
  openSearch(): void {
    if (view) openSearchPanel(view);
  },
  focus(): void {
    view?.focus();
  },
});
```

`src/components/JsonViewer.vue`: make these changes to the Task 10 version.

1. Imports. Change the Vue import to `import { computed, nextTick, onBeforeUnmount, ref } from 'vue';` and add `import { actionFor, comboFromEvent, defaultShortcuts, type ShortcutAction, type Shortcuts } from '@/settings/shortcuts';`.

2. Props. Add `shortcuts?: Shortcuts;` to the props type and `shortcuts: () => defaultShortcuts` to the `withDefaults` defaults.

3. After `onEscape`, add:

```ts
const rawPre = ref<HTMLPreElement>();

async function setMode(next: 'code' | 'raw'): Promise<void> {
  mode.value = next;
  // CodeView focuses itself on mount; the Raw text needs focus so the next shortcut still reaches us.
  if (next === 'raw') {
    await nextTick();
    rawPre.value?.focus();
  }
}

/** Runs a shortcut's action; false when it doesn't apply here, so the key keeps its usual meaning. */
function runShortcut(action: ShortcutAction): boolean {
  const onCode = mode.value === 'code';
  switch (action) {
    case 'search':
      if (onCode) codeView.value?.openSearch();
      return onCode;
    case 'filter':
      filter.value?.focus();
      return true;
    case 'toggleRaw':
      void setMode(onCode ? 'raw' : 'code');
      return true;
    case 'foldAll':
      if (onCode) foldTo(FOLD_ALL_LEVEL);
      return onCode;
    case 'unfoldAll':
      if (onCode) unfoldEverything();
      return onCode;
    case 'copyPath':
      if (onCode) copyPath();
      return onCode;
  }
}

/** Capture phase: configured shortcuts win over CodeMirror's own key bindings. */
function onShortcut(event: KeyboardEvent): void {
  if (event.isComposing) return;
  const combo = comboFromEvent(event);
  const action = combo === null ? null : actionFor(props.shortcuts, combo);
  if (action === null || !runShortcut(action)) return;
  event.preventDefault();
  event.stopPropagation();
}
```

4. Template:
- The root gets `@keydown.capture="onShortcut"` next to `@keydown="onEscape"`.
- The Raw view becomes `<pre v-else ref="rawPre" class="jv-body jv-raw" tabindex="0">{{ raw }}</pre>`.

`src/components/viewer.css`: append:

```css
.jv-raw:focus:not(:focus-visible) {
  outline: none;
}
```

`src/entrypoints/viewer.content/index.ts`: in the `h(JsonViewer, { … })` props, add `shortcuts: state.settings.shortcuts,` after `font: state.settings.font,`.

`src/options/PreviewPane.vue`:
- Add `const viewerShortcuts = computed(() => ({ ...props.settings.shortcuts }));` after `viewerFont`.
- Pass `:shortcuts="viewerShortcuts"` to `JsonViewer`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test && pnpm compile`
Expected: PASS.

Run: `pnpm build && pnpm exec playwright test e2e/navigation.spec.ts e2e/viewer.spec.ts`
Expected: PASS, including the existing `focuses the editor so Ctrl+F opens the in-editor search`.

- [ ] **Step 5: Commit**

```bash
git add src/editor/setup.ts src/components/CodeView.vue src/components/JsonViewer.vue src/components/JsonViewer.test.ts src/components/viewer.css src/entrypoints/viewer.content/index.ts src/options/PreviewPane.vue e2e/navigation.spec.ts
git commit -m "feat(viewer): configurable keyboard shortcuts"
```

---

### Task 12: Shortcuts section in the options page

**Files:**
- Create: `src/options/fields/ShortcutField.vue`, `src/options/fields/ShortcutField.test.ts`, `src/options/sections/ShortcutsSection.vue`
- Modify: `src/entrypoints/options/App.vue`, `src/options/options.css`, `e2e/navigation.spec.ts`

**Interfaces:**
- Consumes: `comboFromEvent`, `isValidShortcut`, `conflictWith`, `defaultShortcuts`, `SHORTCUT_ACTIONS`, `SHORTCUT_LABELS`, `ShortcutAction`, `Shortcuts` (Task 7); `Settings.shortcuts`; `getStorage` (`e2e/storage.ts`).
- Produces:
  - `ShortcutField`: `v-model` (string), props `{ label: string; defaultValue: string; conflict?: string }`.
    - It is a button named `<label> shortcut` that shows the combination or `None`. Click starts recording and the text reads `Press keys…`.
    - While recording: the next valid combination is saved. Esc cancels. Backspace or Delete clears (disables) the shortcut. Tab leaves.
    - A key without Ctrl, Alt or Meta (and not a function key) shows `Use Ctrl, Alt or a function key (F1–F24).` and keeps recording.
    - A `Reset` button (named `Reset <label> shortcut`) appears when the value differs from the default.
  - `ShortcutsSection` (`id="shortcuts"`, heading `Shortcuts`): one field per action, each showing `Also assigned to <other label>.` on conflicts.

- [ ] **Step 1: Write the failing tests**

`src/options/fields/ShortcutField.test.ts`:

```ts
// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, ref, type App } from 'vue';
import ShortcutField from './ShortcutField.vue';

let app: App | undefined;

afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
});

function mount(initial = 'Alt+R', conflict?: string) {
  const value = ref(initial);
  const host = document.createElement('div');
  document.body.append(host);
  app = createApp({
    render: () =>
      h(ShortcutField, {
        label: 'Toggle Raw',
        defaultValue: 'Alt+R',
        conflict,
        modelValue: value.value,
        'onUpdate:modelValue': (next: string) => {
          value.value = next;
        },
      }),
  });
  app.mount(host);
  const button = host.querySelector<HTMLButtonElement>('[aria-label="Toggle Raw shortcut"]')!;
  return { host, value, button };
}

function press(target: HTMLElement, code: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

const text = (element: Element) => element.textContent?.trim();

describe('ShortcutField', () => {
  it('records a combination after a click', async () => {
    const { button, value } = mount();
    expect(text(button)).toBe('Alt+R');
    button.click();
    await nextTick();
    expect(text(button)).toBe('Press keys…');
    press(button, 'ControlLeft', { ctrlKey: true });
    press(button, 'KeyY', { ctrlKey: true, altKey: true });
    await nextTick();
    expect(value.value).toBe('Ctrl+Alt+Y');
    expect(text(button)).toBe('Ctrl+Alt+Y');
  });

  it('rejects keys without Ctrl, Alt, Meta or a function key and keeps recording', async () => {
    const { host, button, value } = mount();
    button.click();
    await nextTick();
    press(button, 'KeyK');
    await nextTick();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Use Ctrl, Alt or a function key');
    expect(value.value).toBe('Alt+R');
    expect(text(button)).toBe('Press keys…');
  });

  it('cancels with Esc and clears with Backspace', async () => {
    const { button, value } = mount();
    button.click();
    await nextTick();
    press(button, 'Escape');
    await nextTick();
    expect(value.value).toBe('Alt+R');
    expect(text(button)).toBe('Alt+R');
    button.click();
    await nextTick();
    press(button, 'Backspace');
    await nextTick();
    expect(value.value).toBe('');
    expect(text(button)).toBe('None');
  });

  it('lets Tab move focus and ignores keys when not recording', async () => {
    const { button, value } = mount();
    expect(press(button, 'KeyY', { ctrlKey: true, altKey: true }).defaultPrevented).toBe(false);
    button.click();
    await nextTick();
    expect(press(button, 'Tab').defaultPrevented).toBe(false);
    await nextTick();
    expect(text(button)).toBe('Alt+R');
    expect(value.value).toBe('Alt+R');
  });

  it('offers Reset when the value differs from the default', async () => {
    const { host, value } = mount('Ctrl+Q');
    host.querySelector<HTMLButtonElement>('[aria-label="Reset Toggle Raw shortcut"]')!.click();
    await nextTick();
    expect(value.value).toBe('Alt+R');
    expect(host.querySelector('[aria-label="Reset Toggle Raw shortcut"]')).toBeNull();
  });

  it('shows a conflict', () => {
    const { host } = mount('Alt+R', 'JSONPath filter');
    expect(host.textContent).toContain('Also assigned to JSONPath filter.');
  });
});
```

`e2e/navigation.spec.ts`:
- Change the storage import to `import { getStorage, setStorage } from './storage';`.
- Append:

```ts
test('records a shortcut in the options page and uses it in the viewer', async ({ context, server, extensionId }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  const field = options.getByRole('button', { name: 'Toggle Raw shortcut', exact: true });
  await expect(field).toHaveText('Alt+R');
  await field.click();
  await expect(field).toHaveText('Press keys…');
  await options.keyboard.press('Control+Alt+KeyY');
  await expect(field).toHaveText('Ctrl+Alt+Y');
  await expect
    .poll(() => getStorage(context, 'sync', 'settings'))
    .toMatchObject({ shortcuts: { toggleRaw: 'Ctrl+Alt+Y' } });
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name"');
  await page.keyboard.press('Control+Alt+KeyY');
  await expect(page.locator(`${viewer} .jv-raw`)).toBeVisible();
});

test('warns about a shortcut used twice and clears it with Backspace', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  const filterField = options.getByRole('button', { name: 'JSONPath filter shortcut', exact: true });
  await filterField.click();
  await options.keyboard.press('Alt+KeyR');
  await expect(filterField).toHaveText('Alt+R');
  await expect(options.getByText('Also assigned to Toggle Raw.')).toBeVisible();
  await expect(options.getByText('Also assigned to JSONPath filter.')).toBeVisible();
  await filterField.click();
  await options.keyboard.press('Backspace');
  await expect(filterField).toHaveText('None');
  await expect(options.getByText(/Also assigned to/)).toHaveCount(0);
});
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `pnpm exec vitest run src/options/fields/ShortcutField.test.ts`
Expected: FAIL. `./ShortcutField.vue` does not exist.

- [ ] **Step 3: Implement**

`src/options/fields/ShortcutField.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { comboFromEvent, isValidShortcut } from '@/settings/shortcuts';

defineProps<{ label: string; defaultValue: string; conflict?: string }>();
const model = defineModel<string>({ required: true });
const recording = ref(false);
const invalid = ref(false);
// Key-ups that follow a recorded combination must not "click" the button again (Space would restart recording).
let swallowKeyup = false;

function toggle(): void {
  recording.value = !recording.value;
  invalid.value = false;
}

function finish(value?: string): void {
  if (value !== undefined) model.value = value;
  recording.value = false;
  invalid.value = false;
  swallowKeyup = true;
}

function onKeydown(event: KeyboardEvent): void {
  if (!recording.value) {
    swallowKeyup = false;
    return;
  }
  const plain = !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey;
  // Tab still moves focus, so the field never traps the keyboard.
  if (plain && event.code === 'Tab') {
    recording.value = false;
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (plain && event.code === 'Escape') return finish();
  if (plain && (event.code === 'Backspace' || event.code === 'Delete')) return finish('');
  const combo = comboFromEvent(event);
  // A modifier on its own: wait for the rest of the combination.
  if (combo === null) return;
  if (isValidShortcut(combo)) finish(combo);
  else invalid.value = true;
}

function onKeyup(event: KeyboardEvent): void {
  if (recording.value || swallowKeyup) event.preventDefault();
}
</script>

<template>
  <div class="opt-field opt-shortcut">
    <span class="opt-label">{{ label }}</span>
    <div class="opt-shortcut-row">
      <button
        type="button"
        class="opt-shortcut-key"
        :class="{ 'opt-recording': recording }"
        :aria-label="`${label} shortcut`"
        :aria-pressed="recording"
        @click="toggle"
        @keydown="onKeydown"
        @keyup="onKeyup"
        @blur="recording = false"
      >
        {{ recording ? 'Press keys…' : model || 'None' }}
      </button>
      <button v-if="model !== defaultValue" type="button" :aria-label="`Reset ${label} shortcut`" @click="model = defaultValue">
        Reset
      </button>
    </div>
    <small v-if="invalid" class="opt-hint opt-errors" role="alert">Use Ctrl, Alt or a function key (F1–F24).</small>
    <small v-else-if="conflict" class="opt-hint opt-errors">Also assigned to {{ conflict }}.</small>
  </div>
</template>
```

`src/options/sections/ShortcutsSection.vue`:

```vue
<script setup lang="ts">
import ShortcutField from '../fields/ShortcutField.vue';
import {
  conflictWith,
  defaultShortcuts,
  SHORTCUT_ACTIONS,
  SHORTCUT_LABELS,
  type ShortcutAction,
  type Shortcuts,
} from '@/settings/shortcuts';

const props = defineProps<{ shortcuts: Shortcuts }>();

function conflict(action: ShortcutAction): string | undefined {
  const other = conflictWith(props.shortcuts, action);
  return other === null ? undefined : SHORTCUT_LABELS[other];
}
</script>

<template>
  <section id="shortcuts" class="opt-section">
    <h2>Shortcuts</h2>
    <p class="opt-hint">
      Click a shortcut and press the new keys. Backspace removes it, Esc cancels. Search, folding and the cursor
      path work on the Code tab.
    </p>
    <ShortcutField
      v-for="action in SHORTCUT_ACTIONS"
      :key="action"
      v-model="shortcuts[action]"
      :label="SHORTCUT_LABELS[action]"
      :default-value="defaultShortcuts[action]"
      :conflict="conflict(action)"
    />
  </section>
</template>
```

`src/entrypoints/options/App.vue`:
- Import `import ShortcutsSection from '@/options/sections/ShortcutsSection.vue';` with the other sections.
- Add `<a href="#shortcuts">Shortcuts</a>` after `<a href="#structure">Structure</a>`.
- Add `<ShortcutsSection :shortcuts="settings.shortcuts" />` after `<StructureSection :viewer="settings.viewer" />`.

`src/options/options.css`: append:

```css
.opt-shortcut-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.opt-shortcut-key {
  min-width: 160px;
  text-align: left;
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
}

.opt-shortcut-key.opt-recording {
  border-color: var(--opt-accent);
  outline: 2px solid var(--opt-accent);
  outline-offset: 1px;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test && pnpm compile`
Expected: PASS.

Run: `pnpm build && pnpm exec playwright test e2e/navigation.spec.ts e2e/options.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/options/fields/ShortcutField.vue src/options/fields/ShortcutField.test.ts src/options/sections/ShortcutsSection.vue src/entrypoints/options/App.vue src/options/options.css e2e/navigation.spec.ts
git commit -m "feat(options): record keyboard shortcuts"
```

---

### Task 13: Documentation and full verification

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-10-11-json-viewer-design.md`
- Create: `docs/notes/pendientes-fase-4.md`

**Interfaces:**
- Consumes: everything above. Produces no code.

Docs are in Spanish, like the existing README and notes.

- [ ] **Step 1: README**

In `README.md`, in "## Configuración", add these bullets after "**Comportamiento** y **Estructura:** …". Also add "plegado al abrir" to that bullet: "las mismas opciones del json-viewer original, con interruptores, y plegado al abrir (como `alwaysFold`)".

```markdown
- **Atajos:** cada acción del visor tiene un atajo que se cambia pulsando la nueva combinación (Retroceso lo quita).
```

Then add this section before "## Temas incluidos":

```markdown
## En el visor

- **Barra inferior:** ruta JSON del cursor (`$.items[3]["e-mail"]`; clic = copiar), tamaño, líneas y formato.
- **Barra superior:** filtro JSONPath (Enter aplica, Esc vuelve al documento; admite filtros como
  `$..items[?(@.price > 10)]`), plegar todo / desplegar todo / plegar por nivel, copiar formateado o minificado,
  descargar `.json` y ordenar claves (solo en esa pestaña).
- **Atajos por defecto:** buscar `Ctrl+F`, filtro `Ctrl+Shift+F`, Raw `Alt+R`, plegar / desplegar todo `Alt+[` /
  `Alt+]`, copiar ruta `Ctrl+Shift+C`. Se reconocen por la posición física de la tecla.
```

- [ ] **Step 2: Spec**

In `docs/superpowers/specs/2026-10-11-json-viewer-design.md`:
- §2 Pila: replace "`jsonpath-plus` (con `eval: false`) para el filtro." with "`jsonpath-plus` (con `eval: 'safe'`: intérprete propio, sin `eval`/`Function`; ver §6.2) para el filtro."
- §6.2: after the bullet list, add:

```markdown
Decisiones de la Fase 4:

- El filtro usa `eval: 'safe'` en vez de `eval: false`: con `false` ningún filtro `[?(...)]` funciona, y `'safe'` no ejecuta código ni accede a globales (compatible con CSP). Se aplica con Enter, no al escribir; el resultado es siempre un array y se abre sin plegar.
- Niveles: el valor raíz es el nivel 1. "Plegar todo" deja abierto el raíz (nivel 2); la UI muestra "Show N levels" (= nivel N + 1).
- Copiar y descargar actúan sobre lo que muestra Code (el resultado del filtro si hay uno). Sin API de portapapeles (http no local) se usa `execCommand('copy')`.
```

- §6.4: after the table, add:

```markdown
Se guardan como `"Ctrl+Shift+F"` y se comparan por tecla física (`KeyboardEvent.code`), así Shift, Alt y AltGr no cambian la tecla; AltGr llega como Ctrl+Alt y no coincide con un atajo `Alt+…`. Exigen Ctrl, Alt o Meta (o una tecla F). `""` desactiva la acción; si dos acciones comparten combinación gana la primera y opciones avisa.
```

- §6.7: in the `alwaysFold` row, change `foldFromLevel` (0 = no plegar) to `foldFromLevel` (0 = no plegar; 2 = `alwaysFold`).

- [ ] **Step 3: Known limitations note**

`docs/notes/pendientes-fase-4.md`:

```markdown
# Pendientes tras la Fase 4

## Limitaciones conocidas
- jsonpath-plus no resuelve claves entre corchetes que contengan `'`, `]`, `\`, `~`, `*`, `@`, `^`, `..` o `$` sola
  (`$["a'b"]` no encuentra nada): la ruta copiada del cursor no sirve como filtro para esas claves.
- Con números grandes (`JSON.rawJSON`), `$..*` devuelve además el texto del número como string.
- El formato mostrado es siempre "JSON" hasta que la Fase 6 añada JSONP y NDJSON.
- `Ctrl+Shift+C` es también "inspeccionar elemento" de las DevTools; si el navegador se lo queda, cambiar el atajo.
```

- [ ] **Step 4: Full verification**

Run: `pnpm test && pnpm compile && pnpm test:e2e`
Expected: everything PASSES. Record the unit and e2e totals in your report.

Run:

```bash
ls -l .output/chrome-mv3/content-scripts/detector.js
LC_ALL=C grep -c -P '[^\x00-\x7F]' .output/chrome-mv3/content-scripts/viewer.js .output/chrome-mv3/content-scripts/detector.js
grep -o '"permissions":\[[^]]*\]' .output/chrome-mv3/manifest.json
```

Expected:
- `detector.js` is still 4233 bytes.
- Both grep counts are `0`.
- Permissions are `["storage","scripting"]`.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/specs/2026-10-11-json-viewer-design.md docs/notes/pendientes-fase-4.md
git commit -m "docs: document navigation, actions and shortcuts"
```

Manual check in Edge (for the human, after merge):
1. `Ctrl+Shift+C` copies the path instead of opening the DevTools inspector.
2. With a Spanish keyboard, typing `[`, `]` and `@` in the filter box types the character.
3. Download saves `<name>.json`.
4. Copy works on a plain-http (non-localhost) JSON URL.

