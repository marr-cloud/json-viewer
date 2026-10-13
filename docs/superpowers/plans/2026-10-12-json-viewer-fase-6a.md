# JSON Viewer — Fase 6a (Detección y entrada) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open more kinds of JSON, keep the viewer off sites the user excludes, and give JSON a way in when no page serves it:
- JSONP (`callback({...})`) and NDJSON / JSON Lines (one value per line), with the format named in the status bar;
- `text/plain` and JavaScript responses when their body parses as JSON or JSONP;
- an excluded-sites list, edited in a new **Sites** section of the options page;
- a context menu: **View as JSON** forces the viewer on the page, **View selection as JSON** opens the selection in the scratchpad;
- a **scratchpad** page, opened from the toolbar icon, to paste JSON and see it in the viewer.

**Architecture:**
- **Detection and parsing (pure).**
  - `src/detect/jsonp.ts` finds the JSON inside a JSONP call.
  - `src/detect/detect.ts` grows from "JSON or not" to `json | jsonp | ndjson`, plus `sniffKind` for text with no content type.
  - `src/parse/formats.ts` parses each kind and keeps error positions in the raw text.
  - `prepareDocument` takes the kind and falls back to NDJSON when "JSON" turns out to be NDJSON.
- **Background modules (`src/background/`).**
  - `viewer.ts`: inject the viewer, optionally forced, and skip excluded hosts.
  - `menus.ts`: the two context menu items.
  - `scratchpad.ts`: open the scratchpad, optionally handing it text.
  - `src/entrypoints/background.ts` only wires listeners.
- **Shared page plumbing.**
  - `src/viewer/session.ts` (`createViewerSession`) is the settings, theme and font wiring the content script had inline, now reused by the scratchpad.
  - `src/components/ViewerShadowRoot.vue` isolates a viewer in a shadow root. It was extracted from the options preview and is reused by the scratchpad.

**Tech Stack:** WXT 0.21.4, Vue 3.5, CodeMirror 6, TypeScript, pnpm, Node 24, Vitest 5 (+ happy-dom, `wxt/testing/fake-browser`), Playwright 1.64. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-11-json-viewer-design.md`:
- §3.1 (entrypoints, permissions), §3.2 (`detect`, `parse` interfaces);
- §6.6 (Detección y entrada), §6.7 (`excludedHosts`), §6.8 (Sitios section);
- §7 (errors: doubtful detection, failed injection), §10 Fase 6.

Phase 6b (export/import settings and i18n en/es) is a separate, later plan.

**How this plan was made:** every task's code was written and run on a scratch branch on 2026-10-12, one commit per task. The diffs and files below are taken from those commits. After each task, `pnpm test` and `pnpm compile` were green and the task's e2e spec passed. After the last code task, 474 unit tests and 95 e2e tests passed. Applying the patches in order reproduces that tree.

### Decisions that refine the spec (approved with this plan)

1. **JSONP.**
   - A JSONP body is an optional `/**/`, then a callback name (`cb`, `jQuery123.cb_1`, `$cb`), then `(`, the JSON, `)` and an optional `;`.
   - `application/json` and `+json` responses are claimed as JSONP by that shape alone, with no parse in the detector.
   - `text/plain` and JavaScript responses (`text/javascript`, `application/javascript`, `application/x-javascript`) are claimed only when the wrapped value is an object or array that parses. So `console.log("x")` and real scripts are left alone.
   - The viewer shows the wrapped JSON. Copy and download act on it, and the status bar says "JSONP".
2. **NDJSON.**
   - Chromium **downloads** `application/x-ndjson`, `application/jsonl` and `application/x-jsonlines` instead of showing them, so no content script ever sees them there. This was probed on 2026-10-12.
   - NDJSON therefore reaches the viewer in two ways:
     - as `text/plain`, when there are at least two non-blank lines and each is an object or array that parses;
     - as a JSON content type whose body fails as JSON but is valid NDJSON. Some APIs do this; `prepareDocument` falls back.
   - The NDJSON content types are still recognized, for other browsers.
   - It is shown as an array of the records, so JSONPath works (`$[3].id`). An error names the line ("Line 2: …") and is marked at its place in the raw text. The status bar says "NDJSON".
3. **Excluded sites.**
   - `excludedHosts` is checked in the **background**, before injecting, not in the detector.
     - Settings are read only when JSON was found, and the detector stays small and storage-free.
     - This refines §3.1, which puts the check in the detector.
   - Patterns:
     - Patterns are host names with `*` wildcards, matched case-insensitively against the frame URL's host. Ports are ignored.
     - `*.example.com` also matches `example.com`.
     - A pasted URL keeps only its host.
     - At most 50 patterns of 100 characters each, so the settings item stays under storage.sync's 8 KB.
     - IPv6 literals aren't supported.
   - **View as JSON** ignores the list: the user asked explicitly.
4. **Context menu.**
   - **View as JSON** (page context) forces the viewer in the clicked frame.
     - The background sets a flag in the content scripts' shared isolated world, then injects the viewer.
     - The viewer then uses the page's `<pre>` text if there is one, or else `document.body.innerText`. An unparsable page shows the usual error banner over the raw text.
   - **View selection as JSON** opens a scratchpad tab with the selection.
     - The text is read from the frame with `getSelection()`, which keeps line breaks; `info.selectionText` is the fallback.
     - It is handed over through `storage.session`, never disk or sync.
   - If the viewer can't run on the page (`chrome://`, the Web Store), the toolbar icon gets a red "!" badge and a tooltip with the reason. This replaces §7's notification, which would need the `notifications` permission.
5. **Scratchpad.**
   - The manifest gets an `action` with no popup. A click on the icon opens `scratchpad.html` next to the current tab.
   - Text pasted on the left is shown on the right in the viewer, re-parsed 250 ms after typing stops. Its kind is sniffed, so JSON, JSONP and NDJSON all work.
   - Nothing is saved: closing the tab drops the text.
6. **Shared plumbing.**
   - `createViewerSession(fonts, media?)` replaces the content script's inline wiring with the same behavior: settings, custom CSS, custom themes, the color scheme, the toolbar toggle and the stored font.
   - `ViewerShadowRoot.vue` (a host div, a shadow root, `viewer.css` and a slot) replaces the options preview's inline shadow-root code.
7. **Permissions and sizes.**
   - Permissions become `storage`, `scripting` and `contextMenus`; `host_permissions` stays `<all_urls>`.
   - The detector bundle grows from 4233 to about 5206 bytes, under the 8192 limit.

## Global Constraints

- pnpm only (`pnpm add`, `pnpm exec`; never npm or npx for project commands), Node 24. Manifest V3.
- Permissions are exactly `storage`, `scripting`, plus `contextMenus` from Task 7 on. `host_permissions` stays `['<all_urls>']`.
- `srcDir: 'src'`; alias `@/` → `src/`.
  - The `detector` content script must stay ≤ 8192 bytes: 4233 today, 5206 after Task 1.
  - It must not import Vue, CodeMirror, `@/parse/*` or storage.
- Keep `wxt.config.ts`'s rolldown `minify.codegen.asciiOnly` and `build.chunkSizeWarningLimit: 800`.
- No new dependencies. Import types from `@codemirror/*` packages only, not `@lezer/*`, except where a file already does.
- `src/themes/{color,types,scopes,fromVSCode,validate}.ts` and `src/shared/guards.ts` keep relative imports only (they run under `tsx`).
- Storage keys:
  - `sync:settings` stays at version 1. `excludedHosts` is added without a version bump; `validateSettings` fills it in.
  - The only new key is `session:scratchpadInput`.
- Identifiers, comments and UI text in English. Docs in `docs/` in Spanish. Conventional commits.
- Unit tests sit next to code (`src/**/*.test.ts`); e2e tests live in `e2e/`.
  - Component tests use happy-dom and Vue's `createApp`, not `@vue/test-utils`.
  - Background tests use `fakeBrowser` from `wxt/testing/fake-browser`, with `vi.spyOn(...).mockImplementation(fn as never)` for APIs it doesn't implement (`scripting.executeScript`, `tabs.create`, `contextMenus.*`).
- Write U+FEFF (BOM) in code as `0xfeff` / `String.fromCharCode(0xfeff)`, never as a `\uFEFF` escape typed into the Write or Edit tool: the tool turns that escape into a literal BOM character.
- The CodeView reconfigure watch is shallow: objects passed to `JsonViewer`/`CodeView` must be replaced, not mutated.
- Write files with the Write/Edit tools, or by applying this plan's patches with `git apply`. Don't use shell heredocs. Check `git diff` before each commit.
- Before each commit run `pnpm test` and `pnpm compile`. Tasks with e2e steps also run `pnpm build` and the named specs with `pnpm exec playwright test <files>`. The last task runs the full `pnpm test:e2e`.

**Applying patches.** Where a step gives a diff, save it to a file under the job's temp directory and run `git apply --whitespace=nowarn <file>` from the repo root. If it doesn't apply cleanly, because an earlier task drifted, make the same edits by hand with the Edit tool and report the drift. Where a step gives a whole file, write it exactly as shown.

## Review Focus

1. **Scripts and text that only look like data.**
   - Cases: `console.log("x")`, `define([...], fn)`, a log whose first line is JSON.
   - Expected: never claimed, and the page stays as the browser rendered it.
   - Tests: Task 1 `ignores …` table; Task 2 e2e `leaves real scripts alone`.
2. **Errors inside JSONP and NDJSON.**
   - Expected: the banner gives the line and column in the raw response (for NDJSON, "Line N: …"), and the marker sits on that character.
   - Tests: Task 2 `parseJsonp`/`parseNdjson` "reports …" tests and JsonViewer `locates a JSONP error in the raw text`.
3. **Sloppy host patterns** (pasted URLs, uppercase, ports, spaces, junk, more than 50).
   - Expected: normalized or listed as left out, never stored broken, and settings still sync.
   - Tests: Task 3 `hosts.test.ts` and `schema.test.ts` `keeps only valid, distinct host patterns`; Task 4 e2e `the Sites section saves host patterns and flags the rest`.
4. **View as JSON where it can't work or on non-JSON pages.**
   - Cases: restricted pages, HTML pages.
   - Expected: on restricted pages, a badge and a reason, with the page untouched. On HTML pages, the viewer over the page text, with an error banner if it doesn't parse.
   - Tests: Task 7 `marks the toolbar icon when the viewer cannot run on the page`; e2e `"View as JSON" opens the viewer on pages that were not detected`.
5. **Selections.**
   - Cases: multi-line selections, and selections the frame can't report (inside an input, or a frame the extension can't script).
   - Expected: line breaks kept, with a fallback to the menu's selection text.
   - Tests: Task 7 `opens the selection in a scratchpad next to the tab` and `falls back to the menu selection text when the frame cannot be read`.

---

### Task 1: JSONP and NDJSON detection

**Files:**
- Create: `src/detect/jsonp.ts`, `src/detect/jsonp.test.ts`
- Modify (rewrite): `src/detect/detect.ts`, `src/detect/detect.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `src/detect/jsonp.ts`:
    - `interface JsonpBounds { callback: string; from: number; to: number }`;
    - `jsonpBounds(text: string): JsonpBounds | null`. `text.slice(from, to)` is the wrapped JSON. It accepts a leading BOM and whitespace.
  - `src/detect/detect.ts`:
    - `type JsonKind = 'json' | 'jsonp' | 'ndjson'`;
    - `interface Detection { kind: JsonKind }`;
    - `detect(contentType, text): Detection | null` (rules in Decision 1–2);
    - `sniffKind(text): JsonKind` (no content type: jsonp if wrapped, ndjson if `isNdjson`, else json);
    - `isNdjson(text): boolean`.
    - `normalizeContentType` and `isJsonContentType` are unchanged.

- [ ] **Step 1: Write the failing tests**

Create `src/detect/jsonp.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { jsonpBounds } from './jsonp';

const BOM = String.fromCharCode(0xfeff);

const inner = (text: string) => {
  const bounds = jsonpBounds(text);
  return bounds && { callback: bounds.callback, json: text.slice(bounds.from, bounds.to) };
};

describe('jsonpBounds', () => {
  it('finds the JSON inside a callback call', () => {
    expect(inner('cb({"a":1})')).toEqual({ callback: 'cb', json: '{"a":1}' });
    expect(inner('  jQuery.cb_1 ( [1, 2] ) ;\n')).toEqual({ callback: 'jQuery.cb_1', json: ' [1, 2] ' });
    expect(inner('/**/ $cb({"a":1});')).toEqual({ callback: '$cb', json: '{"a":1}' });
    expect(inner(BOM + 'cb(1)')).toEqual({ callback: 'cb', json: '1' });
  });

  it('rejects JSON and other text', () => {
    for (const text of ['{"a":1}', '[1]', 'cb', 'cb(1', 'cb(1) + 2', '1cb(1)', 'cb()x', 'a-b(1)', '']) {
      expect(jsonpBounds(text), text).toBeNull();
    }
  });

  it('accepts an empty call, which then fails to parse', () => {
    expect(inner('cb()')).toEqual({ callback: 'cb', json: '' });
  });
});
```

Replace `src/detect/detect.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { detect, isJsonContentType, isNdjson, normalizeContentType, sniffKind } from './detect';

const BOM = String.fromCharCode(0xfeff);

describe('normalizeContentType', () => {
  it('drops parameters and lowercases', () => {
    expect(normalizeContentType('Application/JSON; charset=utf-8')).toBe('application/json');
  });
});

describe('isJsonContentType', () => {
  it.each([
    ['application/json', true],
    ['text/json', true],
    ['application/ld+json', true],
    ['application/vnd.api+json; charset=utf-8', true],
    ['text/plain', false],
    ['text/html', false],
    ['application/javascript', false],
  ])('%s → %s', (type, expected) => {
    expect(isJsonContentType(type)).toBe(expected);
  });
});

describe('detect', () => {
  it.each([
    ['application/json', '{}'],
    ['application/json; charset=utf-8', 'not json at all'],
    ['APPLICATION/JSON', '[]'],
    ['application/ld+json', '{"@context":"x"}'],
    ['text/json', '[1]'],
    ['text/plain', '[{"a":1}]'],
    ['text/plain', BOM + '  {"a":1}  '],
    ['application/javascript', '{"a":1}'],
  ])('detects %s with %j as JSON', (type, text) => {
    expect(detect(type, text)).toEqual({ kind: 'json' });
  });

  it.each([
    ['application/json', 'cb({"a":1})'],
    ['application/javascript', 'cb({"a":1});'],
    ['text/javascript; charset=utf-8', '/**/ jQuery123.cb([1, 2]);'],
    ['application/x-javascript', 'cb([1])'],
    ['text/plain', 'cb({"a":1})'],
  ])('detects %s with %j as JSONP', (type, text) => {
    expect(detect(type, text)).toEqual({ kind: 'jsonp' });
  });

  it.each([
    ['application/x-ndjson', '{"a":1}\n{"a":2}\n'],
    ['application/jsonl', 'anything'],
    ['text/plain', '{"a":1}\n\n{"a":2}\r\n[3]\n'],
  ])('detects %s with %j as NDJSON', (type, text) => {
    expect(detect(type, text)).toEqual({ kind: 'ndjson' });
  });

  it.each([
    ['text/plain', '[INFO] server started'],
    ['text/plain', '{ not json'],
    ['text/plain', 'hello'],
    ['text/plain', '42'],
    ['text/plain', ''],
    ['text/plain', '{"a":1}\n{oops}'],
    ['text/plain', 'cb({oops})'],
    ['text/html', '{"a":1}'],
    ['application/javascript', 'console.log("hi");'],
    ['application/javascript', 'cb({oops})'],
    ['application/javascript', '{"a":1}\n{"a":2}'],
    ['application/octet-stream', '{}'],
  ])('ignores %s with %j', (type, text) => {
    expect(detect(type, text)).toBeNull();
  });
});

describe('isNdjson', () => {
  it('needs two or more objects or arrays, one per line', () => {
    expect(isNdjson('{"a":1}\n{"b":2}')).toBe(true);
    expect(isNdjson(BOM + '[1]\n[2]\n')).toBe(true);
    expect(isNdjson('{"a":1}')).toBe(false);
    expect(isNdjson('1\n2')).toBe(false);
    expect(isNdjson('{\n  "a": 1\n}')).toBe(false);
    expect(isNdjson('')).toBe(false);
  });
});

describe('sniffKind', () => {
  it('tells JSONP and NDJSON from JSON without a content type', () => {
    expect(sniffKind('cb({"a":1})')).toBe('jsonp');
    expect(sniffKind('{"a":1}\n{"a":2}')).toBe('ndjson');
    expect(sniffKind('{"a":1}')).toBe('json');
    expect(sniffKind('not json')).toBe('json');
    expect(sniffKind('')).toBe('json');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/detect`
Expected: FAIL. `./jsonp` cannot be resolved, and `isNdjson`/`sniffKind` are not exported.

- [ ] **Step 3: Implement**

Create `src/detect/jsonp.ts`:

```ts
// A callback name, optionally dotted ("jQuery.cb", "a.b_1"), after optional whitespace and the "/**/" some APIs
// prepend; JSON itself can never start this way.
const JSONP_START = /^\s*(?:\/\*\*\/\s*)?([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\(/;

export interface JsonpBounds {
  callback: string;
  /** Start of the wrapped JSON, just after "(". */
  from: number;
  /** End of the wrapped JSON, at the closing ")". */
  to: number;
}

const isSpace = (char: string | undefined) => char !== undefined && /\s/.test(char);

/** Where the JSON sits inside `callback( … );`, or null when `text` isn't wrapped that way. */
export function jsonpBounds(text: string): JsonpBounds | null {
  const match = JSONP_START.exec(text);
  if (!match) return null;
  let end = text.length;
  while (isSpace(text[end - 1])) end--;
  if (text[end - 1] === ';') end--;
  while (isSpace(text[end - 1])) end--;
  if (text[end - 1] !== ')' || end - 1 < match[0].length) return null;
  return { callback: match[1]!, from: match[0].length, to: end - 1 };
}
```

Replace `src/detect/detect.ts` with:

```ts
import { jsonpBounds } from './jsonp';

/** How the response wraps its JSON: plain, a JSONP callback, or one value per line (NDJSON / JSON Lines). */
export type JsonKind = 'json' | 'jsonp' | 'ndjson';

export interface Detection {
  kind: JsonKind;
}

const JSON_TYPES = new Set(['application/json', 'text/json']);
const SUFFIX_JSON = /^application\/[\w.+-]+\+json$/;
// Chromium downloads these instead of showing them, so in practice they reach the viewer only in other browsers.
const NDJSON_TYPES = new Set([
  'application/x-ndjson',
  'application/ndjson',
  'application/jsonl',
  'application/x-jsonlines',
  'application/jsonlines',
]);
const SCRIPT_TYPES = new Set(['text/javascript', 'application/javascript', 'application/x-javascript']);

export function normalizeContentType(contentType: string): string {
  return (contentType.split(';')[0] ?? '').trim().toLowerCase();
}

export function isJsonContentType(contentType: string): boolean {
  const type = normalizeContentType(contentType);
  return JSON_TYPES.has(type) || SUFFIX_JSON.test(type);
}

/**
 * JSON and NDJSON content types are always shown (invalid bodies get an error banner).
 * text/plain and JavaScript are only claimed when the body parses: as an object or array, as JSONP,
 * or (text/plain only) as NDJSON. So plain logs like "[INFO] …" and real scripts are left alone.
 */
export function detect(contentType: string, text: string): Detection | null {
  const type = normalizeContentType(contentType);
  if (NDJSON_TYPES.has(type)) return { kind: 'ndjson' };
  // Cheap: JSON content types are claimed without parsing; the viewer parses once.
  if (isJsonContentType(type)) return { kind: jsonpBounds(text) ? 'jsonp' : 'json' };
  const plain = type === 'text/plain';
  if (!plain && !SCRIPT_TYPES.has(type)) return null;
  if (isValidJsonp(text)) return { kind: 'jsonp' };
  if (isJsonContainer(text)) return { kind: 'json' };
  if (plain && isNdjson(text)) return { kind: 'ndjson' };
  return null;
}

/** The kind of a text with no content type to go by (pasted text, a page forced into the viewer). */
export function sniffKind(text: string): JsonKind {
  if (jsonpBounds(text)) return 'jsonp';
  return isNdjson(text) ? 'ndjson' : 'json';
}

function parses(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function isJsonContainer(text: string): boolean {
  const trimmed = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).trim();
  return (trimmed[0] === '{' || trimmed[0] === '[') && parses(trimmed);
}

function isValidJsonp(text: string): boolean {
  const bounds = jsonpBounds(text);
  return bounds !== null && isJsonContainer(text.slice(bounds.from, bounds.to));
}

/**
 * At least two lines, each an object or array that parses on its own (blank lines are skipped).
 * Stops at the first line that doesn't, so a pretty-printed document fails on its first line.
 */
export function isNdjson(text: string): boolean {
  let records = 0;
  let start = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  while (start < text.length) {
    let end = text.indexOf('\n', start);
    if (end === -1) end = text.length;
    const line = text.slice(start, end).trim();
    start = end + 1;
    if (line === '') continue;
    if ((line[0] !== '{' && line[0] !== '[') || !parses(line)) return false;
    records++;
  }
  return records >= 2;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/detect`
Expected: PASS (49 tests, `readRawText` included).

- [ ] **Step 5: Check the detector's size, then commit**

Run: `pnpm test`, `pnpm compile`, `pnpm build`, then `wc -c .output/chrome-mv3/content-scripts/detector.js`.
Expected: all green, and the detector is about 5206 bytes, at most 8192. Put the number in the report.

```bash
git add src/detect/jsonp.ts src/detect/jsonp.test.ts src/detect/detect.ts src/detect/detect.test.ts
git commit -m "feat(detect): recognize JSONP and NDJSON responses"
```

---

### Task 2: Show JSONP and NDJSON in the viewer

**Files:**
- Create: `src/parse/formats.ts`, `src/parse/formats.test.ts`, `e2e/input.spec.ts`
- Modify: `src/viewer/prepare.ts` (rewrite), `src/viewer/prepare.test.ts`, `src/components/JsonViewer.vue`, `src/components/JsonViewer.test.ts`, `src/entrypoints/viewer.content/index.ts`, `e2e/server.ts`

**Interfaces:**
- Consumes: `JsonKind`, `detect`, `sniffKind`, `isNdjson` (Task 1, `src/detect/detect.ts`); `jsonpBounds` (Task 1); `parseJson`, `stripBom`, `offsetToLineColumn`, `ParseError`, `ParseResult` (`src/parse/parse.ts`, unchanged).
- Produces:
  - `src/parse/formats.ts`: `parseDocument(text, kind): ParseResult`, `parseJsonp(text)`, `parseNdjson(text)`. NDJSON gives an array of the values. Error offsets, lines and columns refer to the BOM-stripped raw text.
  - `prepareDocument(raw, options, kind: JsonKind = 'json'): PreparedDocument`. `PreparedDocument` gains `kind`, the format actually shown: `'json'` input that is valid NDJSON comes back as `'ndjson'`.
  - `JsonViewer` prop `format?: JsonKind` (default `'json'`). It **replaces** the old `format?: string` prop, which only labeled the status bar and was never passed. The status bar shows `JSON`, `JSONP` or `NDJSON` from `prepared.kind`.
  - The content script passes `format: detect(document.contentType, raw)?.kind ?? sniffKind(raw)`.
  - `e2e/server.ts` routes:
    - `/data.jsonp` (application/javascript);
    - `/plain.jsonp` (text/plain);
    - `/script.js` (application/javascript, not data);
    - `/records.jsonl` (text/plain NDJSON);
    - `/ndjson-as-json` (application/json NDJSON).
  - `e2e/input.spec.ts`, which Tasks 3, 4, 6 and 7 extend.

- [ ] **Step 1: Write the failing tests**

Create `src/parse/formats.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseDocument, parseJsonp, parseNdjson } from './formats';

const BOM = String.fromCharCode(0xfeff);

describe('parseJsonp', () => {
  it('parses the wrapped JSON', () => {
    expect(parseJsonp('cb({"a":1});')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseJsonp(BOM + '/**/ jQuery.cb([1, 2])')).toEqual({ ok: true, value: [1, 2] });
  });

  it('keeps big numbers', () => {
    const result = parseJsonp('cb({"id":12345678901234567890})');
    expect(result.ok && JSON.stringify(result.value)).toBe('{"id":12345678901234567890}');
  });

  it('reports errors where they are in the whole response', () => {
    const text = 'cb({\n  "a": 1,\n})';
    const result = parseJsonp(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ line: 3, column: 1, offset: text.indexOf('}') });
  });

  it('says so when the text is not JSONP', () => {
    expect(parseJsonp('{"a":1}')).toMatchObject({ ok: false, error: { line: 1, column: 1, offset: 0 } });
  });
});

describe('parseNdjson', () => {
  it('returns the values in order, skipping blank lines', () => {
    expect(parseNdjson('{"a":1}\n\n[2]\r\n"x"\n')).toEqual({ ok: true, value: [{ a: 1 }, [2], 'x'] });
    expect(parseNdjson(BOM + '1')).toEqual({ ok: true, value: [1] });
  });

  it('reports the line, column and offset of the first bad line', () => {
    const text = '{"a":1}\n{"b":}\n{"c":3}';
    const result = parseNdjson(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/^Line 2: /);
    expect(result.error).toMatchObject({ line: 2, column: 6, offset: text.indexOf('}', 8) });
  });

  it('fails on an empty document', () => {
    expect(parseNdjson(' \n\n')).toMatchObject({ ok: false, error: { message: 'No JSON values found' } });
  });
});

describe('parseDocument', () => {
  it('picks the parser for the kind', () => {
    expect(parseDocument('{"a":1}', 'json')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseDocument('cb(1)', 'jsonp')).toEqual({ ok: true, value: 1 });
    expect(parseDocument('1\n2', 'ndjson')).toEqual({ ok: true, value: [1, 2] });
    expect(parseDocument('1\n2', 'json').ok).toBe(false);
  });
});
```

Apply to `src/viewer/prepare.test.ts`. Existing expectations gain `kind: 'json'`, and a new `describe` covers JSONP and NDJSON:

```diff
diff --git a/src/viewer/prepare.test.ts b/src/viewer/prepare.test.ts
index 6b41d25..c8795c3 100644
--- a/src/viewer/prepare.test.ts
+++ b/src/viewer/prepare.test.ts
@@ -29,11 +29,13 @@ describe('prepareDocument', () => {
       ok: true,
       text: '{\n  "a": [\n    1\n  ]\n}',
       value: { a: [1] },
+      kind: 'json',
     });
     expect(prepareDocument('{"a":1}', { ...defaultViewerOptions, tabSize: 4 })).toEqual({
       ok: true,
       text: '{\n    "a": 1\n}',
       value: { a: 1 },
+      kind: 'json',
     });
   });
 
@@ -50,6 +52,7 @@ describe('prepareDocument', () => {
       ok: true,
       text: '{\n  "a": 1\n}',
       value: { a: 1 },
+      kind: 'json',
     });
     const invalid = prepareDocument('\uFEFF{', defaultViewerOptions);
     expect(invalid.text).toBe('{');
@@ -79,7 +82,7 @@ describe('prepareDocument', () => {
     ['{}', '{}'],
     ['[]', '[]'],
   ])('handles root value %s', (raw, text) => {
-    expect(prepareDocument(raw, defaultViewerOptions)).toEqual({ ok: true, text, value: JSON.parse(raw) });
+    expect(prepareDocument(raw, defaultViewerOptions)).toEqual({ ok: true, text, value: JSON.parse(raw), kind: 'json' });
   });
 
   it('reports an empty body as an error', () => {
@@ -87,3 +90,32 @@ describe('prepareDocument', () => {
     expect(result.ok).toBe(false);
   });
 });
+
+describe('prepareDocument with other formats', () => {
+  it('unwraps JSONP and splits NDJSON into an array', () => {
+    expect(prepareDocument('cb({"a":1})', defaultViewerOptions, 'jsonp')).toEqual({
+      ok: true,
+      text: '{\n  "a": 1\n}',
+      value: { a: 1 },
+      kind: 'jsonp',
+    });
+    expect(prepareDocument('{"a":1}\n{"a":2}\n', defaultViewerOptions, 'ndjson')).toMatchObject({
+      ok: true,
+      value: [{ a: 1 }, { a: 2 }],
+      kind: 'ndjson',
+    });
+  });
+
+  it('shows NDJSON sent as JSON as NDJSON', () => {
+    expect(prepareDocument('{"a":1}\n{"a":2}', defaultViewerOptions, 'json')).toMatchObject({ ok: true, kind: 'ndjson' });
+  });
+
+  it('keeps the asked-for kind when nothing parses, with the raw text', () => {
+    expect(prepareDocument('cb({"a":})', defaultViewerOptions, 'jsonp')).toMatchObject({
+      ok: false,
+      kind: 'jsonp',
+      text: 'cb({"a":})',
+    });
+    expect(prepareDocument('{"a":1}\n{oops}', defaultViewerOptions, 'json')).toMatchObject({ ok: false, kind: 'json' });
+  });
+});
```

Apply to `src/components/JsonViewer.test.ts`:

```diff
diff --git a/src/components/JsonViewer.test.ts b/src/components/JsonViewer.test.ts
index 50a7e5c..4f95e2e 100644
--- a/src/components/JsonViewer.test.ts
+++ b/src/components/JsonViewer.test.ts
@@ -3,6 +3,7 @@ import { foldedRanges } from '@codemirror/language';
 import { EditorView } from '@codemirror/view';
 import { afterEach, describe, expect, it, vi } from 'vitest';
 import { createApp, h, nextTick, reactive, type App } from 'vue';
+import type { JsonKind } from '@/detect/detect';
 import { defaultLightTheme, defaultTheme } from '@/themes/builtin';
 import type { Theme } from '@/themes/types';
 import { defaultFontSettings, type FontSettings } from '@/settings/font';
@@ -24,6 +25,7 @@ type Props = {
   options?: ViewerOptions;
   features?: Features;
   documentShortcuts?: boolean;
+  format?: JsonKind;
 };
 
 function mount(props: Props = {}) {
@@ -91,6 +93,25 @@ describe('JsonViewer', () => {
     expect(info.textContent).toContain('JSON');
   });
 
+  it('unwraps JSONP and shows NDJSON as an array, naming the format', () => {
+    const jsonp = mount({ raw: 'cb({"a":1});', format: 'jsonp' });
+    expect(editorOf(jsonp).state.doc.toString()).toBe('{\n  "a": 1\n}');
+    expect(jsonp.querySelector('.jv-status-info')!.textContent).toContain('JSONP');
+    expect(jsonp.querySelector('.jv-error')).toBeNull();
+    app?.unmount();
+    document.body.innerHTML = '';
+    // Sent as JSON, recognized as NDJSON.
+    const ndjson = mount({ raw: '{"a":1}\n{"a":2}' });
+    expect(editorOf(ndjson).state.doc.toString()).toBe('[\n  {\n    "a": 1\n  },\n  {\n    "a": 2\n  }\n]');
+    expect(ndjson.querySelector('.jv-status-info')!.textContent).toContain('NDJSON');
+  });
+
+  it('locates a JSONP error in the raw text', () => {
+    const host = mount({ raw: 'cb({"a":})', format: 'jsonp' });
+    expect(host.querySelector('.jv-error')!.textContent).toContain('line 1, column 9');
+    expect(host.querySelector('.jv-status-info')!.textContent).toContain('JSONP');
+  });
+
   it('shows the cursor path and copies it on click', async () => {
     const writeText = mockClipboard();
     const host = mount();
```

Apply to `e2e/server.ts`:

```diff
diff --git a/e2e/server.ts b/e2e/server.ts
index 0e929d8..a8e827b 100644
--- a/e2e/server.ts
+++ b/e2e/server.ts
@@ -55,6 +55,12 @@ const routes: Record<string, Route> = {
   '/rich.json': { type: 'application/json', body: richJson },
   '/rich-csp.json': { type: 'application/json', body: richJson, headers: { 'content-security-policy': "img-src 'none'" } },
   '/rich-broken.json': { type: 'application/json', body: richBrokenJson },
+  '/data.jsonp': { type: 'application/javascript', body: 'callback({"name":"jsonp","list":[1,2]});' },
+  '/plain.jsonp': { type: 'text/plain', body: '/**/ cb({"name":"plain jsonp"})' },
+  '/script.js': { type: 'application/javascript', body: 'console.log("not data");' },
+  // Chromium downloads application/x-ndjson and application/jsonl, so NDJSON reaches the viewer as text or JSON.
+  '/records.jsonl': { type: 'text/plain; charset=utf-8', body: '{"id":1,"name":"first"}\n{"id":2,"name":"second"}\n' },
+  '/ndjson-as-json': { type: 'application/json', body: '{"id":1}\n{"id":2}\n' },
   '/pixel.svg': { type: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"/>' },
 };
 
```

Create `e2e/input.spec.ts`:

```ts
import { expect, test } from './fixtures';

const viewer = 'json-viewer-app';

test.beforeEach(async ({ extensionId }) => {
  expect(extensionId).toMatch(/^[a-p]{32}$/);
});

test('unwraps JSONP served as JavaScript or text', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.jsonp'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name": "jsonp"');
  await expect(page.locator(`${viewer} .jv-status-info`)).toContainText('JSONP');
  await page.goto(server.url('/plain.jsonp'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name": "plain jsonp"');
});

test('leaves real scripts alone', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/script.js'));
  await page.waitForTimeout(500);
  await expect(page.locator(viewer)).toHaveCount(0);
  await expect(page.locator('body > pre')).toBeVisible();
});

test('shows NDJSON as an array, whether sent as text or as JSON', async ({ context, server }) => {
  const page = await context.newPage();
  for (const route of ['/records.jsonl', '/ndjson-as-json']) {
    await page.goto(server.url(route));
    await expect(page.locator(`${viewer} .cm-content`)).toContainText('"id": 2');
    await expect(page.locator(`${viewer} .jv-status-info`)).toContainText('NDJSON');
    await expect(page.locator(`${viewer} .jv-error`)).toHaveCount(0);
  }
});
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `pnpm exec vitest run src/parse/formats.test.ts src/viewer/prepare.test.ts src/components/JsonViewer.test.ts`
Expected: FAIL. `./formats` cannot be resolved, `kind` is missing from `prepareDocument`'s result, and JSONP isn't unwrapped.

- [ ] **Step 3: Implement**

Create `src/parse/formats.ts`:

```ts
import type { JsonKind } from '@/detect/detect';
import { jsonpBounds } from '@/detect/jsonp';
import { offsetToLineColumn, parseJson, stripBom, type ParseError, type ParseResult } from './parse';

/** Parses a response of the given kind. Error offsets, lines and columns refer to the BOM-stripped text. */
export function parseDocument(text: string, kind: JsonKind): ParseResult {
  if (kind === 'jsonp') return parseJsonp(text);
  if (kind === 'ndjson') return parseNdjson(text);
  return parseJson(text);
}

/** The JSON inside `callback( … );`. */
export function parseJsonp(text: string): ParseResult {
  const source = stripBom(text);
  const bounds = jsonpBounds(source);
  if (bounds === null) {
    return { ok: false, error: { message: 'Not a JSONP response: expected callback(...)', line: 1, column: 1, offset: 0 } };
  }
  const inner = parseJson(source.slice(bounds.from, bounds.to));
  if (inner.ok) return inner;
  return { ok: false, error: shift(inner.error, source, bounds.from) };
}

/** One JSON value per line (blank lines skipped), as an array of the values. */
export function parseNdjson(text: string): ParseResult {
  const source = stripBom(text);
  const values: unknown[] = [];
  let start = 0;
  let line = 1;
  while (start < source.length) {
    let end = source.indexOf('\n', start);
    if (end === -1) end = source.length;
    // A trailing \r (CRLF) is whitespace to JSON.parse, so it can stay.
    const lineText = source.slice(start, end);
    if (lineText.trim() !== '') {
      const result = parseJson(lineText);
      if (!result.ok) {
        const error = shift(result.error, source, start);
        return { ok: false, error: { ...error, message: `Line ${line}: ${result.error.message}` } };
      }
      values.push(result.value);
    }
    start = end + 1;
    line++;
  }
  if (values.length === 0) {
    return { ok: false, error: { message: 'No JSON values found', line: null, column: null, offset: null } };
  }
  return { ok: true, value: values };
}

/** Moves an error found in `source.slice(from)` to its place in `source`. */
function shift(error: ParseError, source: string, from: number): ParseError {
  if (error.offset === null) return error;
  const offset = from + error.offset;
  return { ...error, ...offsetToLineColumn(source, offset), offset };
}
```

Replace `src/viewer/prepare.ts` with:

```ts
import { isNdjson, type JsonKind } from '@/detect/detect';
import { formatJson } from '@/parse/format';
import { parseDocument } from '@/parse/formats';
import { stripBom, type ParseError } from '@/parse/parse';
import type { ViewerOptions } from './options';

/** `kind` is the format actually shown, which can differ from the one asked for (see prepareDocument). */
export type PreparedDocument = (
  | { ok: true; text: string; value: unknown }
  | { ok: false; text: string; error: ParseError }
) & { kind: JsonKind };

const TOO_DEEP = 'Document is nested too deeply to format';

/**
 * Parses and formats the raw response. Never throws: failures carry the raw text.
 * JSON that doesn't parse but is valid NDJSON (some APIs send NDJSON as application/json) is shown as NDJSON.
 */
export function prepareDocument(
  raw: string,
  options: Pick<ViewerOptions, 'tabSize' | 'sortKeys' | 'indentCStyle'>,
  kind: JsonKind = 'json',
): PreparedDocument {
  let shown = kind;
  let parsed = parseDocument(raw, kind);
  if (!parsed.ok && kind === 'json' && isNdjson(raw)) {
    shown = 'ndjson';
    parsed = parseDocument(raw, 'ndjson');
  }
  if (!parsed.ok) return { ok: false, text: stripBom(raw), error: parsed.error, kind: shown };

  try {
    const text = formatJson(parsed.value, {
      indent: options.tabSize,
      sortKeys: options.sortKeys,
      cStyle: options.indentCStyle,
    });
    return { ok: true, text, value: parsed.value, kind: shown };
  } catch (e) {
    const message = e instanceof RangeError ? TOO_DEEP : String(e);
    return { ok: false, text: stripBom(raw), error: { message, line: null, column: null, offset: null }, kind: shown };
  }
}
```

Apply to `src/components/JsonViewer.vue`:

```diff
diff --git a/src/components/JsonViewer.vue b/src/components/JsonViewer.vue
index a7a946f..b2a302c 100644
--- a/src/components/JsonViewer.vue
+++ b/src/components/JsonViewer.vue
@@ -11,6 +11,7 @@ import { toCssVars } from '@/themes/css';
 import { resolveColors } from '@/themes/resolve';
 import type { Theme } from '@/themes/types';
 import { copyText } from '@/viewer/clipboard';
+import type { JsonKind } from '@/detect/detect';
 import type { ParseError } from '@/parse/parse';
 import { downloadName, downloadText } from '@/viewer/download';
 import { defaultFeatures, FOLD_ALL_LEVEL, richValues, type Features, type ViewerOptions } from '@/viewer/options';
@@ -29,8 +30,8 @@ const props = withDefaults(
     source?: { url: string; loadedAt: Date };
     toggleLabel?: string;
     font?: FontSettings;
-    /** Shown in the status bar. */
-    format?: string;
+    /** How the raw text wraps its JSON. NDJSON sent as JSON is recognized anyway; the status bar shows the result. */
+    format?: JsonKind;
     shortcuts?: Shortcuts;
     /** Optional features: the JSONPath filter and the value decorations follow them. */
     features?: Features;
@@ -46,7 +47,7 @@ const props = withDefaults(
     source: undefined,
     toggleLabel: undefined,
     font: undefined,
-    format: 'JSON',
+    format: 'json',
     shortcuts: () => defaultShortcuts,
     features: () => defaultFeatures,
     documentShortcuts: false,
@@ -64,8 +65,14 @@ const sortOverride = ref<boolean | null>(null);
 const sortKeys = computed(() => sortOverride.value ?? props.options.sortKeys);
 const indentCStyle = computed(() => props.options.indentCStyle);
 const prepared = computed(() =>
-  prepareDocument(props.raw, { tabSize: tabSize.value, sortKeys: sortKeys.value, indentCStyle: indentCStyle.value }),
+  prepareDocument(
+    props.raw,
+    { tabSize: tabSize.value, sortKeys: sortKeys.value, indentCStyle: indentCStyle.value },
+    props.format,
+  ),
 );
+const FORMAT_LABELS: Record<JsonKind, string> = { json: 'JSON', jsonp: 'JSONP', ndjson: 'NDJSON' };
+const formatLabel = computed(() => FORMAT_LABELS[prepared.value.kind]);
 const filterText = ref('');
 /** The filter in effect; applied on Enter so big documents aren't re-queried on every keystroke. */
 const appliedPath = ref<string | null>(null);
@@ -301,7 +308,7 @@ onBeforeUnmount(() => document.removeEventListener('keydown', onDocumentKeydown,
       :path="mode === 'code' ? cursorPath : null"
       :size="size"
       :lines="lines"
-      :format="format"
+      :format="formatLabel"
       :message="message"
       :note="matches"
       :light-mode="lightMode ? options.lightModeThresholdMB : null"
```

Apply to `src/entrypoints/viewer.content/index.ts`:

```diff
diff --git a/src/entrypoints/viewer.content/index.ts b/src/entrypoints/viewer.content/index.ts
index 46ad553..e4f4c0a 100644
--- a/src/entrypoints/viewer.content/index.ts
+++ b/src/entrypoints/viewer.content/index.ts
@@ -2,6 +2,7 @@ import '@/components/viewer.css';
 import { browser } from 'wxt/browser';
 import { computed, createApp, h, reactive } from 'vue';
 import JsonViewer from '@/components/JsonViewer.vue';
+import { detect, sniffKind } from '@/detect/detect';
 import { readRawText } from '@/detect/readRawText';
 import { createFontLoader } from '@/fonts/loader';
 import { trackStoredFont } from '@/fonts/track';
@@ -26,6 +27,7 @@ export default defineContentScript({
     const raw = readRawText(document);
     if (raw === null) return;
     root.setAttribute(GUARD, '');
+    const format = detect(document.contentType, raw)?.kind ?? sniffKind(raw);
 
     let restore: (() => void) | undefined;
     let ui: Awaited<ReturnType<typeof createShadowRootUi>> | undefined;
@@ -99,6 +101,7 @@ export default defineContentScript({
               h('div', { class: 'jv-page' }, [
                 h(JsonViewer, {
                   raw,
+                  format,
                   options: state.settings.viewer,
                   font: state.settings.font,
                   shortcuts: state.settings.shortcuts,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/parse src/viewer src/components`
Expected: PASS.

Run: `pnpm build`, then `pnpm exec playwright test e2e/input.spec.ts e2e/viewer.spec.ts`
Expected: PASS (3 new tests plus the existing viewer tests).

- [ ] **Step 5: Full checks and commit**

Run: `pnpm test` and `pnpm compile`.

```bash
git add src/parse/formats.ts src/parse/formats.test.ts src/viewer/prepare.ts src/viewer/prepare.test.ts src/components/JsonViewer.vue src/components/JsonViewer.test.ts src/entrypoints/viewer.content/index.ts e2e/server.ts e2e/input.spec.ts
git commit -m "feat(viewer): show JSONP and NDJSON, naming the format in the status bar"
```

---

### Task 3: Excluded sites

**Files:**
- Create: `src/settings/hosts.ts`, `src/settings/hosts.test.ts`, `src/background/viewer.ts`, `src/background/viewer.test.ts`
- Modify: `src/settings/schema.ts`, `src/settings/schema.test.ts`, `src/entrypoints/background.ts`, `e2e/input.spec.ts`

**Interfaces:**
- Consumes: `FieldValidator` shape `(value, fallback) => T` (`src/settings/fields.ts`); `loadSettings` (`src/settings/storage.ts`).
- Produces:
  - `src/settings/hosts.ts`:
    - `MAX_EXCLUDED_HOSTS = 50`, `MAX_HOST_PATTERN_LENGTH = 100`;
    - `normalizeHostPattern(input): string | null`;
    - `interface HostList { hosts: string[]; invalid: string[]; dropped: number }` and `parseHostList(text): HostList`;
    - `validateExcludedHosts(value, fallback): string[]`, which always returns a new array;
    - `hostMatches(hostname, pattern)`, `isExcludedHost(hostname, patterns)`.
  - `Settings.excludedHosts: string[]` (default `[]`).
  - `src/background/viewer.ts`:
    - `VIEWER_SCRIPT = '/content-scripts/viewer.js'`;
    - `interface FrameTarget { tabId: number; frameId: number }`;
    - `injectViewer(target): Promise<void>` (Task 7 adds a `force` parameter);
    - `onJsonDetected(target, url: string | undefined): Promise<void>`.
  - `src/entrypoints/background.ts` routes `json-detected` messages to `onJsonDetected`, passing `sender.url`.

- [ ] **Step 1: Write the failing tests**

Create `src/settings/hosts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  hostMatches,
  isExcludedHost,
  MAX_EXCLUDED_HOSTS,
  normalizeHostPattern,
  parseHostList,
  validateExcludedHosts,
} from './hosts';

describe('normalizeHostPattern', () => {
  it('keeps host patterns, lowercased', () => {
    expect(normalizeHostPattern('  API.Example.com ')).toBe('api.example.com');
    expect(normalizeHostPattern('*.example.com')).toBe('*.example.com');
    expect(normalizeHostPattern('localhost')).toBe('localhost');
    expect(normalizeHostPattern('127.0.0.1')).toBe('127.0.0.1');
    expect(normalizeHostPattern('10.0.*')).toBe('10.0.*');
  });

  it('takes the host out of a pasted URL', () => {
    expect(normalizeHostPattern('https://api.example.com:8080/v1?x=1')).toBe('api.example.com');
    expect(normalizeHostPattern('example.com/path')).toBe('example.com');
    expect(normalizeHostPattern('localhost:3000')).toBe('localhost');
  });

  it('rejects anything else', () => {
    for (const value of ['', '   ', 'a b.com', 'exa_mple.com', '.example.com', 'example..com', 'user@example.com', '[::1]']) {
      expect(normalizeHostPattern(value), value).toBeNull();
    }
    expect(normalizeHostPattern(`${'a'.repeat(101)}.com`)).toBeNull();
  });
});

describe('parseHostList', () => {
  it('reads one pattern per line, without duplicates, and lists the invalid lines', () => {
    expect(parseHostList('example.com\n\n EXAMPLE.com\nnot a host\n*.test\r\n')).toEqual({
      hosts: ['example.com', '*.test'],
      invalid: ['not a host'],
      dropped: 0,
    });
  });

  it(`keeps at most ${MAX_EXCLUDED_HOSTS} patterns`, () => {
    const text = Array.from({ length: MAX_EXCLUDED_HOSTS + 3 }, (_, i) => `h${i}.com`).join('\n');
    const list = parseHostList(text);
    expect(list.hosts).toHaveLength(MAX_EXCLUDED_HOSTS);
    expect(list.dropped).toBe(3);
  });
});

describe('validateExcludedHosts', () => {
  it('keeps the valid strings of an array', () => {
    expect(validateExcludedHosts(['a.com', 42, 'bad host', 'A.com', '*.b.com'], [])).toEqual(['a.com', '*.b.com']);
  });

  it('falls back when the value is not an array', () => {
    expect(validateExcludedHosts('a.com', ['x.com'])).toEqual(['x.com']);
    expect(validateExcludedHosts(undefined, [])).toEqual([]);
  });
});

describe('hostMatches', () => {
  it('matches exactly, case-insensitively and ignoring a trailing dot', () => {
    expect(hostMatches('api.example.com', 'api.example.com')).toBe(true);
    expect(hostMatches('API.Example.com.', 'api.example.com')).toBe(true);
    expect(hostMatches('example.com', 'api.example.com')).toBe(false);
    expect(hostMatches('xapi.example.com', 'api.example.com')).toBe(false);
  });

  it('treats a leading *. as the domain and its subdomains', () => {
    expect(hostMatches('example.com', '*.example.com')).toBe(true);
    expect(hostMatches('a.b.example.com', '*.example.com')).toBe(true);
    expect(hostMatches('notexample.com', '*.example.com')).toBe(false);
  });

  it('lets * match anything elsewhere', () => {
    expect(hostMatches('10.0.3.4', '10.0.*')).toBe(true);
    expect(hostMatches('api-staging.example.com', 'api-*.example.com')).toBe(true);
    expect(hostMatches('api.example.com', 'api-*.example.com')).toBe(false);
  });
});

describe('isExcludedHost', () => {
  it('is true when any pattern matches', () => {
    expect(isExcludedHost('127.0.0.1', ['example.com', '127.0.0.1'])).toBe(true);
    expect(isExcludedHost('127.0.0.1', [])).toBe(false);
  });
});
```

Apply to `src/settings/schema.test.ts`:

```diff
diff --git a/src/settings/schema.test.ts b/src/settings/schema.test.ts
index adde259..e2480f2 100644
--- a/src/settings/schema.test.ts
+++ b/src/settings/schema.test.ts
@@ -34,6 +34,7 @@ describe('validateSettings', () => {
       font: defaultFontSettings,
       shortcuts: defaultShortcuts,
       features: defaultFeatures,
+      excludedHosts: [],
     });
   });
 
@@ -46,6 +47,7 @@ describe('validateSettings', () => {
       font: { ...defaultFontSettings, source: 'google', family: 'JetBrains Mono' },
       shortcuts: { ...defaultShortcuts, toggleRaw: 'Ctrl+Alt+R' },
       features: { ...defaultFeatures, imagePreview: false },
+      excludedHosts: ['api.example.com', '*.internal.test'],
     };
     expect(validateSettings(input)).toEqual(input);
   });
@@ -66,9 +68,15 @@ describe('validateSettings', () => {
       font: defaultFontSettings,
       shortcuts: defaultShortcuts,
       features: defaultFeatures,
+      excludedHosts: [],
     });
   });
 
+  it('keeps only valid, distinct host patterns', () => {
+    expect(validateSettings({ excludedHosts: ['A.com', 'a.com', 'bad host', 3] }).excludedHosts).toEqual(['a.com']);
+    expect(validateSettings({ excludedHosts: 'a.com' }).excludedHosts).toEqual([]);
+  });
+
   it('validates the features one by one', () => {
     const result = validateSettings({ features: { colorSwatches: false, imagePreview: 'no', extra: true } });
     expect(result.features).toEqual({ ...defaultFeatures, colorSwatches: false });
@@ -94,5 +102,6 @@ describe('validateSettings', () => {
   it('never returns the shared default objects', () => {
     const result = validateSettings(undefined);
     expect(result.viewer).not.toBe(defaultViewerOptions);
+    expect(result.excludedHosts).not.toBe(defaultSettings.excludedHosts);
   });
 });
```

Create `src/background/viewer.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { injectViewer, onJsonDetected, VIEWER_SCRIPT } from './viewer';

describe('background viewer injection', () => {
  let executeScript: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fakeBrowser.reset();
    executeScript = vi.fn().mockResolvedValue([]);
    vi.spyOn(fakeBrowser.scripting, 'executeScript').mockImplementation(executeScript as never);
  });

  const target = { tabId: 7, frameId: 3 };

  it('injects the viewer into the frame', async () => {
    await injectViewer(target);
    expect(executeScript).toHaveBeenCalledTimes(1);
    expect(executeScript).toHaveBeenCalledWith({ target: { tabId: 7, frameIds: [3] }, files: [VIEWER_SCRIPT] });
  });

  it('skips excluded sites', async () => {
    await fakeBrowser.storage.sync.set({ settings: { excludedHosts: ['*.example.com'] } });
    await onJsonDetected(target, 'https://api.example.com/v1/items');
    expect(executeScript).not.toHaveBeenCalled();
    await onJsonDetected(target, 'https://example.org/items');
    expect(executeScript).toHaveBeenCalledTimes(1);
  });

  it('injects when the frame URL is unknown or not a URL', async () => {
    await fakeBrowser.storage.sync.set({ settings: { excludedHosts: ['*'] } });
    await onJsonDetected(target, undefined);
    await onJsonDetected(target, 'not a url');
    expect(executeScript).toHaveBeenCalledTimes(2);
  });
});
```

Apply to `e2e/input.spec.ts`:

```diff
diff --git a/e2e/input.spec.ts b/e2e/input.spec.ts
index afe0c5c..9e4ec8f 100644
--- a/e2e/input.spec.ts
+++ b/e2e/input.spec.ts
@@ -1,4 +1,5 @@
 import { expect, test } from './fixtures';
+import { setStorage } from './storage';
 
 const viewer = 'json-viewer-app';
 
@@ -32,3 +33,14 @@ test('shows NDJSON as an array, whether sent as text or as JSON', async ({ conte
     await expect(page.locator(`${viewer} .jv-error`)).toHaveCount(0);
   }
 });
+
+test('skips excluded sites but not others', async ({ context, server }) => {
+  await setStorage(context, 'sync', { settings: { excludedHosts: ['127.0.0.1'] } });
+  const page = await context.newPage();
+  await page.goto(server.url('/data.json'));
+  await page.waitForTimeout(500);
+  await expect(page.locator(viewer)).toHaveCount(0);
+  await expect(page.locator('body > pre')).toBeVisible();
+  await page.goto(server.insecureUrl('/data.json'));
+  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name": "x"');
+});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/settings src/background`
Expected: FAIL. `./hosts` and `./viewer` cannot be resolved, and `excludedHosts` is missing from the settings.

- [ ] **Step 3: Implement**

Create `src/settings/hosts.ts`:

```ts
// Settings live in one storage.sync item (8 KB): 50 patterns of up to 100 characters stay well inside it.
export const MAX_EXCLUDED_HOSTS = 50;
export const MAX_HOST_PATTERN_LENGTH = 100;

// Letters, digits, hyphens and * wildcards, in dot-separated labels ("api.example.com", "*.example.com", "10.0.*").
const HOST_PATTERN = /^[a-z0-9*-]+(?:\.[a-z0-9*-]+)*$/;

/**
 * A host pattern in canonical form, or null. Accepts a pasted URL ("https://api.example.com:8080/v1") and keeps
 * only its host; ports are ignored when matching.
 */
export function normalizeHostPattern(input: string): string | null {
  let host = input.trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  host = host.split(/[/?#]/, 1)[0] ?? '';
  host = host.replace(/:\d*$/, '');
  if (host === '' || host.length > MAX_HOST_PATTERN_LENGTH || !HOST_PATTERN.test(host)) return null;
  return host;
}

export interface HostList {
  hosts: string[];
  /** Lines that aren't host patterns, as typed. */
  invalid: string[];
  /** Valid patterns dropped because the list is full. */
  dropped: number;
}

/** Reads one pattern per line: normalized, without duplicates, and at most MAX_EXCLUDED_HOSTS. */
export function parseHostList(text: string): HostList {
  const hosts: string[] = [];
  const invalid: string[] = [];
  let dropped = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const host = normalizeHostPattern(line);
    if (host === null) invalid.push(line.trim());
    else if (hosts.includes(host)) continue;
    else if (hosts.length === MAX_EXCLUDED_HOSTS) dropped++;
    else hosts.push(host);
  }
  return { hosts, invalid, dropped };
}

/** The settings validator: keeps the valid, distinct patterns of an array (at most MAX_EXCLUDED_HOSTS). */
export function validateExcludedHosts(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return parseHostList(value.filter((item): item is string => typeof item === 'string').join('\n')).hosts;
}

/** `*` matches any characters; a leading "*." also matches the bare domain ("*.example.com" matches example.com). */
export function hostMatches(hostname: string, pattern: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  const body = (glob: string) => glob.split('*').map((part) => part.replace(/\./g, '\\.')).join('.*');
  const source = pattern.startsWith('*.') ? `^(?:.*\\.)?${body(pattern.slice(2))}$` : `^${body(pattern)}$`;
  return new RegExp(source).test(host);
}

export function isExcludedHost(hostname: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => hostMatches(hostname, pattern));
}
```

Apply to `src/settings/schema.ts`:

```diff
diff --git a/src/settings/schema.ts b/src/settings/schema.ts
index 3f229cc..6a658c9 100644
--- a/src/settings/schema.ts
+++ b/src/settings/schema.ts
@@ -1,5 +1,6 @@
 import { bool, intInRange, nonEmptyId, oneOf, validateFields, type ObjectValidators } from './fields';
 import { defaultFontSettings, validateFontSettings, type FontSettings } from './font';
+import { validateExcludedHosts } from './hosts';
 import { defaultShortcuts, validateShortcuts, type Shortcuts } from './shortcuts';
 import {
   defaultFeatures,
@@ -21,6 +22,8 @@ export interface Settings {
   font: FontSettings;
   shortcuts: Shortcuts;
   features: Features;
+  /** Host patterns where detected JSON is left alone (see hosts.ts). */
+  excludedHosts: string[];
 }
 
 export const defaultSettings: Settings = {
@@ -31,6 +34,7 @@ export const defaultSettings: Settings = {
   font: defaultFontSettings,
   shortcuts: defaultShortcuts,
   features: defaultFeatures,
+  excludedHosts: [],
 };
 
 export const TAB_SIZE_MIN = 1;
@@ -68,6 +72,7 @@ const settingsValidators: ObjectValidators<Settings> = {
   font: (value) => validateFontSettings(value),
   shortcuts: (value) => validateShortcuts(value),
   features: (value) => validateFields(value, defaultFeatures, featureValidators),
+  excludedHosts: validateExcludedHosts,
 };
 
 /** Returns complete settings; every missing or invalid field falls back to its default. */
```

Create `src/background/viewer.ts`:

```ts
import { isExcludedHost } from '@/settings/hosts';
import { loadSettings } from '@/settings/storage';

export const VIEWER_SCRIPT = '/content-scripts/viewer.js';

export interface FrameTarget {
  tabId: number;
  frameId: number;
}

/** Runs the viewer content script in one frame. */
export async function injectViewer({ tabId, frameId }: FrameTarget): Promise<void> {
  await browser.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files: [VIEWER_SCRIPT] });
}

function hostnameOf(url: string | undefined): string | null {
  try {
    return url === undefined ? null : new URL(url).hostname;
  } catch {
    return null;
  }
}

/** A detector found JSON in this frame: open the viewer unless the user excluded the site. */
export async function onJsonDetected(target: FrameTarget, url: string | undefined): Promise<void> {
  const hostname = hostnameOf(url);
  if (hostname !== null && isExcludedHost(hostname, (await loadSettings()).excludedHosts)) return;
  await injectViewer(target);
}
```

Replace `src/entrypoints/background.ts` with:

```ts
import { onJsonDetected } from '@/background/viewer';
import { isJsonDetectedMessage, isOpenOptionsMessage } from '@/messages';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender) => {
    if (isOpenOptionsMessage(message)) {
      void browser.runtime.openOptionsPage();
      return;
    }
    if (!isJsonDetectedMessage(message)) return;
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    onJsonDetected({ tabId, frameId: sender.frameId ?? 0 }, sender.url).catch((error: unknown) =>
      console.warn('[json-viewer] viewer injection failed', error),
    );
  });
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/settings src/background`
Expected: PASS. `src/options/useSettings.test.ts` and `src/settings/storage.test.ts` compare with `defaultSettings`, so they follow automatically.

Run: `pnpm build`, then `pnpm exec playwright test e2e/input.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Full checks and commit**

Run: `pnpm test` and `pnpm compile`.

```bash
git add src/settings/hosts.ts src/settings/hosts.test.ts src/settings/schema.ts src/settings/schema.test.ts src/background/viewer.ts src/background/viewer.test.ts src/entrypoints/background.ts e2e/input.spec.ts
git commit -m "feat(settings): skip JSON detected on excluded sites"
```

---

### Task 4: Sites section in the options page

**Files:**
- Create: `src/options/sections/SitesSection.vue`
- Modify: `src/entrypoints/options/App.vue`, `e2e/input.spec.ts`

**Interfaces:**
- Consumes: `parseHostList`, `MAX_EXCLUDED_HOSTS` (Task 3); `Settings.excludedHosts` (Task 3).
- Produces:
  - `SitesSection` (`id="sites"`, heading `Sites`) with `v-model:hosts` (`string[]`).
  - One textarea labeled `Don't open the viewer on`, saved on `change` (blur) in canonical form.
  - Invalid lines and a full list are reported in `role="alert"` paragraphs.
  - The nav gets a `Sites` link after `Shortcuts`.

- [ ] **Step 1: Write the failing e2e test**

Apply to `e2e/input.spec.ts`:

```diff
diff --git a/e2e/input.spec.ts b/e2e/input.spec.ts
index 9e4ec8f..853bceb 100644
--- a/e2e/input.spec.ts
+++ b/e2e/input.spec.ts
@@ -1,5 +1,5 @@
 import { expect, test } from './fixtures';
-import { setStorage } from './storage';
+import { getStorage, setStorage } from './storage';
 
 const viewer = 'json-viewer-app';
 
@@ -44,3 +44,14 @@ test('skips excluded sites but not others', async ({ context, server }) => {
   await page.goto(server.insecureUrl('/data.json'));
   await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name": "x"');
 });
+
+test('the Sites section saves host patterns and flags the rest', async ({ context, extensionId }) => {
+  const options = await context.newPage();
+  await options.goto(`chrome-extension://${extensionId}/options.html`);
+  const field = options.getByLabel("Don't open the viewer on");
+  await field.fill('https://API.example.com/v1\nnot a host\n*.test');
+  await field.press('Tab');
+  await expect(field).toHaveValue('api.example.com\n*.test');
+  await expect(options.getByRole('alert')).toContainText('not a host');
+  await expect.poll(() => getStorage(context, 'sync', 'settings')).toMatchObject({ excludedHosts: ['api.example.com', '*.test'] });
+});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm build`, then `pnpm exec playwright test e2e/input.spec.ts -g "Sites section"`
Expected: FAIL. There is no field labeled "Don't open the viewer on".

- [ ] **Step 3: Implement**

Create `src/options/sections/SitesSection.vue`:

```vue
<script setup lang="ts">
import { ref, watch } from 'vue';
import { MAX_EXCLUDED_HOSTS, parseHostList } from '@/settings/hosts';

const hosts = defineModel<string[]>('hosts', { required: true });

const text = ref(hosts.value.join('\n'));
const invalid = ref<string[]>([]);
const dropped = ref(0);

// Reset to defaults (or another tab) replaced the list: show it, unless it's what the text already says.
watch(hosts, (value) => {
  if (value.join('\n') !== parseHostList(text.value).hosts.join('\n')) text.value = value.join('\n');
});

/** Saves on change (blur), not per key; the text is rewritten in canonical form. */
function onChange(): void {
  const list = parseHostList(text.value);
  invalid.value = list.invalid;
  dropped.value = list.dropped;
  hosts.value = list.hosts;
  text.value = list.hosts.join('\n');
}
</script>

<template>
  <section id="sites" class="opt-section">
    <h2>Sites</h2>
    <label class="opt-field">
      <span class="opt-label">Don't open the viewer on</span>
      <textarea
        v-model="text"
        rows="5"
        spellcheck="false"
        placeholder="api.example.com&#10;*.internal.example.com"
        @change="onChange"
      />
      <small class="opt-hint">
        One host per line. *.example.com also matches example.com, and * matches anything. Right-click a page and
        choose View as JSON to open it there anyway.
      </small>
    </label>
    <p v-if="invalid.length > 0" class="opt-hint opt-errors" role="alert">
      Not a host, left out: {{ invalid.join(', ') }}
    </p>
    <p v-if="dropped > 0" class="opt-hint opt-errors" role="alert">Only the first {{ MAX_EXCLUDED_HOSTS }} hosts are kept.</p>
  </section>
</template>
```

Apply to `src/entrypoints/options/App.vue`:

```diff
diff --git a/src/entrypoints/options/App.vue b/src/entrypoints/options/App.vue
index adfaa92..6fd5acd 100644
--- a/src/entrypoints/options/App.vue
+++ b/src/entrypoints/options/App.vue
@@ -9,6 +9,7 @@ import BehaviorSection from '@/options/sections/BehaviorSection.vue';
 import FeaturesSection from '@/options/sections/FeaturesSection.vue';
 import StructureSection from '@/options/sections/StructureSection.vue';
 import ShortcutsSection from '@/options/sections/ShortcutsSection.vue';
+import SitesSection from '@/options/sections/SitesSection.vue';
 import PreviewPane from '@/options/PreviewPane.vue';
 import { useCustomThemes } from '@/options/useCustomThemes';
 import { useSettings } from '@/options/useSettings';
@@ -57,6 +58,7 @@ function onReset(): void {
         <a href="#structure">Structure</a>
         <a href="#features">Features</a>
         <a href="#shortcuts">Shortcuts</a>
+        <a href="#sites">Sites</a>
         <a href="#advanced">Advanced</a>
         <a href="#about">About</a>
       </nav>
@@ -79,6 +81,7 @@ function onReset(): void {
       <StructureSection :viewer="settings.viewer" />
       <FeaturesSection :features="settings.features" :viewer="settings.viewer" />
       <ShortcutsSection :shortcuts="settings.shortcuts" />
+      <SitesSection v-model:hosts="settings.excludedHosts" />
       <AdvancedSection v-model:custom-css="customCss" />
       <AboutSection />
     </main>
```

- [ ] **Step 4: Run the e2e tests to verify they pass**

Run: `pnpm build`, then `pnpm exec playwright test e2e/input.spec.ts e2e/options.spec.ts`
Expected: PASS.

- [ ] **Step 5: Full checks and commit**

Run: `pnpm test` and `pnpm compile`.

```bash
git add src/options/sections/SitesSection.vue src/entrypoints/options/App.vue e2e/input.spec.ts
git commit -m "feat(options): add a Sites section for excluded hosts"
```

---

### Task 5: Shared viewer session and shadow root

A refactor with no behavior change. It moves two things out so the scratchpad (Task 6) can reuse them:
- the content script's settings, theme and font wiring goes to `createViewerSession`;
- the options preview's shadow-root code goes to `ViewerShadowRoot.vue`.

**Files:**
- Create: `src/viewer/session.ts`, `src/viewer/session.test.ts`, `src/components/ViewerShadowRoot.vue`
- Modify: `src/entrypoints/viewer.content/index.ts`, `src/options/PreviewPane.vue`, `src/options/options.css`

**Interfaces:**
- Consumes: `loadSettings`, `watchSettings`, `customCssItem` (`src/settings/storage.ts`); `listCustomThemes`, `watchCustomThemes` (`src/themes/store.ts`); `activeTheme`, `pickThemeKind`, `toggledKind`, `ThemeKind` (`src/themes/active.ts`); `createFontLoader`, `FontFaceTarget` (`src/fonts/loader.ts`); `trackStoredFont` (`src/fonts/track.ts`).
- Produces:
  - `src/viewer/session.ts`:
    - `interface ViewerSessionState { settings; customCss; customThemes; prefersDark; override }`;
    - `interface ViewerSession { state; theme: ComputedRef<Theme>; kind: ComputedRef<ThemeKind>; toggleTheme(); stop() }`;
    - `createViewerSession(fonts: FontFaceTarget, media?: MediaQueryList): Promise<ViewerSession>`.
    - `state.settings` is replaced, never mutated, on every storage change.
  - `src/components/ViewerShadowRoot.vue`:
    - renders `<div class="jv-shadow-host">`, attaches an open shadow root, and teleports `viewer.css` plus its default slot (a `JsonViewer`) into it;
    - the host's size comes from the page's CSS. Options uses `.opt-preview-frame > .jv-shadow-host`.

- [ ] **Step 1: Write the failing test**

Create `src/viewer/session.test.ts`:

```ts
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createViewerSession, type ViewerSession } from './session';

/** A MediaQueryList whose `matches` the test flips. */
function fakeMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  return {
    matches,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    change(next: boolean) {
      for (const listener of listeners) listener({ matches: next } as MediaQueryListEvent);
    },
    listeners,
  };
}

const fonts = { add: () => undefined, delete: () => true };

describe('createViewerSession', () => {
  let session: ViewerSession | undefined;
  beforeEach(() => fakeBrowser.reset());
  afterEach(() => {
    session?.stop();
    session = undefined;
  });

  const open = async (media = fakeMedia(false)) => {
    session = await createViewerSession(fonts, media as unknown as MediaQueryList);
    return { session, media };
  };

  it('loads the stored settings and custom CSS', async () => {
    await fakeBrowser.storage.sync.set({ settings: { themeMode: 'light', viewer: { tabSize: 4 } } });
    await fakeBrowser.storage.local.set({ customCss: '.cm-editor { color: red }' });
    const { session } = await open();
    expect(session.state.settings.viewer.tabSize).toBe(4);
    expect(session.state.customCss).toBe('.cm-editor { color: red }');
    expect(session.kind.value).toBe('light');
    expect(session.theme.value.id).toBe('light-plus');
  });

  it('follows storage changes by replacing the settings object', async () => {
    const { session } = await open();
    const before = session.state.settings;
    await fakeBrowser.storage.sync.set({ settings: { viewer: { tabSize: 8 } } });
    await vi.waitFor(() => expect(session.state.settings.viewer.tabSize).toBe(8));
    expect(session.state.settings).not.toBe(before);
  });

  it('follows the system color scheme and the toolbar toggle', async () => {
    const { session, media } = await open(fakeMedia(true));
    expect(session.kind.value).toBe('dark');
    media.change(false);
    expect(session.kind.value).toBe('light');
    session.toggleTheme();
    expect(session.kind.value).toBe('dark');
  });

  it('stops listening when stopped', async () => {
    const { session, media } = await open();
    expect(media.listeners.size).toBe(1);
    session.stop();
    expect(media.listeners.size).toBe(0);
    await fakeBrowser.storage.sync.set({ settings: { viewer: { tabSize: 8 } } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(session.state.settings.viewer.tabSize).toBe(2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/viewer/session.test.ts`
Expected: FAIL. `./session` cannot be resolved.

- [ ] **Step 3: Implement**

Create `src/viewer/session.ts`:

```ts
import { computed, reactive, type ComputedRef } from 'vue';
import { createFontLoader, type FontFaceTarget } from '@/fonts/loader';
import { trackStoredFont } from '@/fonts/track';
import type { Settings } from '@/settings/schema';
import { customCssItem, loadSettings, watchSettings } from '@/settings/storage';
import { activeTheme, pickThemeKind, toggledKind, type ThemeKind } from '@/themes/active';
import { listCustomThemes, watchCustomThemes } from '@/themes/store';
import type { Theme } from '@/themes/types';

export interface ViewerSessionState {
  settings: Settings;
  customCss: string;
  customThemes: Theme[];
  prefersDark: boolean;
  /** The toolbar's light/dark toggle, for this page only. */
  override: ThemeKind | null;
}

export interface ViewerSession {
  /** Replaced (never mutated) as storage changes, so it can go straight to JsonViewer's props. */
  readonly state: ViewerSessionState;
  readonly theme: ComputedRef<Theme>;
  readonly kind: ComputedRef<ThemeKind>;
  toggleTheme(): void;
  /** Stops following storage, the color scheme and the font. */
  stop(): void;
}

/**
 * Loads what a full-page viewer needs (settings, custom CSS and themes, the downloaded font) and keeps it in sync
 * with storage and the system color scheme. Used by the content script and the scratchpad.
 */
export async function createViewerSession(
  fonts: FontFaceTarget,
  media: MediaQueryList = window.matchMedia('(prefers-color-scheme: dark)'),
): Promise<ViewerSession> {
  const [settings, customCss, customThemes] = await Promise.all([
    loadSettings(),
    customCssItem.getValue(),
    listCustomThemes(),
  ]);
  const state = reactive<ViewerSessionState>({
    settings,
    customCss,
    customThemes,
    prefersDark: media.matches,
    override: null,
  });
  const theme = computed(() => activeTheme(state.settings, state.customThemes, state.prefersDark, state.override));
  const kind = computed(() => pickThemeKind(state.settings.themeMode, state.prefersDark, state.override));

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
      void listCustomThemes()
        .then((list) => {
          state.customThemes = list;
        })
        .catch((error: unknown) => console.warn('[json-viewer] custom theme reload failed', error));
    }),
    // Faces go on the page's document.fonts, which a viewer in a shadow root uses too.
    trackStoredFont(
      () => (state.settings.font.source === 'google' ? state.settings.font.family : ''),
      createFontLoader(fonts),
    ),
    () => media.removeEventListener('change', onMediaChange),
  ];

  return {
    state,
    theme,
    kind,
    toggleTheme() {
      state.override = toggledKind(state.settings.themeMode, state.prefersDark, state.override);
    },
    stop() {
      for (const stop of stops) stop();
    },
  };
}
```

Create `src/components/ViewerShadowRoot.vue`:

```vue
<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue';
import viewerCss from './viewer.css?inline';

// The viewer's custom CSS is a plain <style>; a shadow root keeps it (and viewer.css) off the host page.
const host = ref<HTMLDivElement>();
const shadowRoot = shallowRef<ShadowRoot>();
onMounted(() => {
  shadowRoot.value = host.value!.attachShadow({ mode: 'open' });
});
</script>

<template>
  <div ref="host" class="jv-shadow-host" />
  <Teleport v-if="shadowRoot" :to="shadowRoot">
    <component :is="'style'">{{ viewerCss }}</component>
    <!-- The JsonViewer to isolate. -->
    <slot />
  </Teleport>
</template>
```

Apply to `src/entrypoints/viewer.content/index.ts`:

```diff
diff --git a/src/entrypoints/viewer.content/index.ts b/src/entrypoints/viewer.content/index.ts
index e4f4c0a..26fb3a7 100644
--- a/src/entrypoints/viewer.content/index.ts
+++ b/src/entrypoints/viewer.content/index.ts
@@ -1,16 +1,12 @@
 import '@/components/viewer.css';
 import { browser } from 'wxt/browser';
-import { computed, createApp, h, reactive } from 'vue';
+import { createApp, h } from 'vue';
 import JsonViewer from '@/components/JsonViewer.vue';
 import { detect, sniffKind } from '@/detect/detect';
 import { readRawText } from '@/detect/readRawText';
-import { createFontLoader } from '@/fonts/loader';
-import { trackStoredFont } from '@/fonts/track';
 import { OPEN_OPTIONS, type OpenOptionsMessage } from '@/messages';
-import { customCssItem, loadSettings, watchSettings } from '@/settings/storage';
-import { activeTheme, pickThemeKind, toggledKind, type ThemeKind } from '@/themes/active';
-import { listCustomThemes, watchCustomThemes } from '@/themes/store';
 import { hideOriginal } from '@/viewer/hideOriginal';
+import { createViewerSession, type ViewerSession } from '@/viewer/session';
 
 const GUARD = 'data-json-viewer';
 
@@ -31,61 +27,25 @@ export default defineContentScript({
 
     let restore: (() => void) | undefined;
     let ui: Awaited<ReturnType<typeof createShadowRootUi>> | undefined;
+    let session: ViewerSession | undefined;
     let failed = false;
     const fail = (error: unknown): void => {
       if (failed) return;
       failed = true;
       restore?.();
       ui?.remove();
+      session?.stop();
       root.removeAttribute(GUARD);
       console.warn('[json-viewer] viewer failed to render', error);
     };
 
     try {
-      const [settings, customCss, customThemes] = await Promise.all([
-        loadSettings(),
-        customCssItem.getValue(),
-        listCustomThemes(),
-      ]);
-      const media = window.matchMedia('(prefers-color-scheme: dark)');
-      const state = reactive({
-        settings,
-        customCss,
-        customThemes,
-        prefersDark: media.matches,
-        override: null as ThemeKind | null,
-      });
-      const theme = computed(() => activeTheme(state.settings, state.customThemes, state.prefersDark, state.override));
-      const kind = computed(() => pickThemeKind(state.settings.themeMode, state.prefersDark, state.override));
+      const current = await createViewerSession(document.fonts);
+      session = current;
+      ctx.onInvalidated(() => current.stop());
+      const { state } = current;
       const source = { url: location.href, loadedAt: new Date() };
 
-      const onMediaChange = (event: MediaQueryListEvent) => {
-        state.prefersDark = event.matches;
-      };
-      media.addEventListener('change', onMediaChange);
-      const stops = [
-        watchSettings((value) => {
-          state.settings = value;
-        }),
-        customCssItem.watch((value) => {
-          state.customCss = value ?? '';
-        }),
-        watchCustomThemes(() => {
-          void listCustomThemes()
-            .then((list) => {
-              state.customThemes = list;
-            })
-            .catch((error: unknown) => console.warn('[json-viewer] custom theme reload failed', error));
-        }),
-        // Faces go on the page's document.fonts, which the viewer's shadow root uses too.
-        trackStoredFont(
-          () => (state.settings.font.source === 'google' ? state.settings.font.family : ''),
-          createFontLoader(document.fonts),
-        ),
-        () => media.removeEventListener('change', onMediaChange),
-      ];
-      ctx.onInvalidated(() => stops.forEach((stop) => stop()));
-
       const openSettings = () => {
         const message: OpenOptionsMessage = { type: OPEN_OPTIONS };
         void browser.runtime.sendMessage(message).catch(() => {});
@@ -107,13 +67,11 @@ export default defineContentScript({
                   shortcuts: state.settings.shortcuts,
                   features: state.settings.features,
                   documentShortcuts: true,
-                  theme: theme.value,
-                  kind: kind.value,
+                  theme: current.theme.value,
+                  kind: current.kind.value,
                   customCss: state.customCss,
                   source,
-                  onToggleTheme: () => {
-                    state.override = toggledKind(state.settings.themeMode, state.prefersDark, state.override);
-                  },
+                  onToggleTheme: current.toggleTheme,
                   onOpenSettings: openSettings,
                 }),
               ]),
```

Apply to `src/options/PreviewPane.vue`:

```diff
diff --git a/src/options/PreviewPane.vue b/src/options/PreviewPane.vue
index a31c55f..522e765 100644
--- a/src/options/PreviewPane.vue
+++ b/src/options/PreviewPane.vue
@@ -1,8 +1,8 @@
 <script setup lang="ts">
-import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
+import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
 import { SAMPLE_JSON, SAMPLE_URL } from './sample';
 import JsonViewer from '@/components/JsonViewer.vue';
-import viewerCss from '@/components/viewer.css?inline';
+import ViewerShadowRoot from '@/components/ViewerShadowRoot.vue';
 import { createFontLoader } from '@/fonts/loader';
 import { trackStoredFont } from '@/fonts/track';
 import type { Settings } from '@/settings/schema';
@@ -22,16 +22,12 @@ const override = ref<ThemeKind | null>(null);
 const onMediaChange = (event: MediaQueryListEvent) => {
   prefersDark.value = event.matches;
 };
-// The viewer's custom CSS is a plain <style>; a shadow root keeps it from leaking into the options page.
-const host = ref<HTMLDivElement>();
-const shadowRoot = shallowRef<ShadowRoot>();
 const viewerOptions = computed(() => ({ ...props.settings.viewer }));
 const viewerFont = computed(() => ({ ...props.settings.font }));
 const viewerShortcuts = computed(() => ({ ...props.settings.shortcuts }));
 const viewerFeatures = computed(() => ({ ...props.settings.features }));
 let stopFont: (() => void) | undefined;
 onMounted(() => {
-  shadowRoot.value = host.value!.attachShadow({ mode: 'open' });
   media.addEventListener('change', onMediaChange);
   stopFont = trackStoredFont(
     () => (props.settings.font.source === 'google' ? props.settings.font.family : ''),
@@ -56,9 +52,7 @@ function toggleTheme(): void {
 
 <template>
   <div class="opt-preview-frame">
-    <div ref="host" class="opt-preview-host" />
-    <Teleport v-if="shadowRoot" :to="shadowRoot">
-      <component :is="'style'">{{ viewerCss }}</component>
+    <ViewerShadowRoot>
       <!-- autoHighlight only sets the initial tab, so remount when it changes. -->
       <JsonViewer
         :key="String(settings.viewer.autoHighlight)"
@@ -74,6 +68,6 @@ function toggleTheme(): void {
         toggle-label="Preview: switch between light and dark"
         @toggle-theme="toggleTheme"
       />
-    </Teleport>
+    </ViewerShadowRoot>
   </div>
 </template>
```

Apply to `src/options/options.css`:

```diff
diff --git a/src/options/options.css b/src/options/options.css
index 86e4268..cbe8259 100644
--- a/src/options/options.css
+++ b/src/options/options.css
@@ -195,7 +195,7 @@ button:disabled {
   border-radius: 8px;
 }
 
-.opt-preview-host {
+.opt-preview-frame > .jv-shadow-host {
   display: block;
   height: 100%;
 }
```

- [ ] **Step 4: Run the tests to verify they pass, and that nothing changed for users**

Run: `pnpm exec vitest run src/viewer`
Expected: PASS.

Run: `pnpm build`, then `pnpm exec playwright test e2e/viewer.spec.ts e2e/settings.spec.ts e2e/options.spec.ts e2e/themes.spec.ts e2e/fonts.spec.ts e2e/values.spec.ts`
Expected: PASS (67 tests). These cover live settings, themes, custom CSS, fonts and the options preview.

- [ ] **Step 5: Full checks and commit**

Run: `pnpm test` and `pnpm compile`.

```bash
git add src/viewer/session.ts src/viewer/session.test.ts src/components/ViewerShadowRoot.vue src/entrypoints/viewer.content/index.ts src/options/PreviewPane.vue src/options/options.css
git commit -m "refactor(viewer): share the viewer session and the shadow root host"
```

---

### Task 6: Scratchpad

**Files:**
- Create:
  - `src/scratchpad/input.ts`, `src/scratchpad/input.test.ts`
  - `src/scratchpad/ScratchpadApp.vue`, `src/scratchpad/scratchpad.css`
  - `src/entrypoints/scratchpad/index.html`, `src/entrypoints/scratchpad/main.ts`
  - `src/background/scratchpad.ts`, `src/background/scratchpad.test.ts`
- Modify: `src/entrypoints/background.ts`, `wxt.config.ts`, `e2e/storage.ts`, `e2e/input.spec.ts`

**Interfaces:**
- Consumes: `createViewerSession`, `ViewerSession` (Task 5); `ViewerShadowRoot` (Task 5); `sniffKind` (Task 1); `JsonViewer` prop `format` (Task 2).
- Produces:
  - `src/scratchpad/input.ts`: `scratchpadInputItem` (`session:scratchpadInput`, a string) and `takeScratchpadInput(): Promise<string>`, which reads the value and clears it.
  - `src/background/scratchpad.ts`: `SCRATCHPAD_PAGE = '/scratchpad.html'` and `openScratchpad(text = '', index?: number)`.
  - The page `scratchpad.html`, titled "JSON Scratchpad":
    - a textarea labeled `JSON input` and a `Clear` button;
    - the viewer in `.sp-output`, or the empty state `.sp-empty`.
  - The manifest gets `action: { default_title: 'Open the JSON scratchpad' }`. A click on the icon opens the scratchpad next to the tab.
  - `e2e/storage.ts` accepts the `'session'` area.

- [ ] **Step 1: Write the failing tests**

Create `src/scratchpad/input.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { scratchpadInputItem, takeScratchpadInput } from './input';

describe('takeScratchpadInput', () => {
  beforeEach(() => fakeBrowser.reset());

  it('returns the handed-over text once', async () => {
    await scratchpadInputItem.setValue('{"a":1}');
    expect(await takeScratchpadInput()).toBe('{"a":1}');
    expect(await takeScratchpadInput()).toBe('');
  });

  it('keeps the text in session storage only', async () => {
    await scratchpadInputItem.setValue('[1]');
    expect(await fakeBrowser.storage.session.get('scratchpadInput')).toEqual({ scratchpadInput: '[1]' });
    expect(await fakeBrowser.storage.local.get(null)).toEqual({});
  });
});
```

Create `src/background/scratchpad.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { scratchpadInputItem } from '@/scratchpad/input';
import { openScratchpad, SCRATCHPAD_PAGE } from './scratchpad';

describe('openScratchpad', () => {
  let createTab: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fakeBrowser.reset();
    createTab = vi.fn().mockResolvedValue({});
    vi.spyOn(fakeBrowser.tabs, 'create').mockImplementation(createTab as never);
  });

  it('opens the scratchpad page at the given position', async () => {
    await openScratchpad('', 4);
    expect(createTab).toHaveBeenCalledWith({ url: fakeBrowser.runtime.getURL(SCRATCHPAD_PAGE), index: 4 });
    expect(await scratchpadInputItem.getValue()).toBe('');
  });

  it('hands text over to the page', async () => {
    await openScratchpad('[1, 2]');
    expect(await scratchpadInputItem.getValue()).toBe('[1, 2]');
    expect(createTab).toHaveBeenCalledOnce();
  });
});
```

Apply to `e2e/storage.ts`:

```diff
diff --git a/e2e/storage.ts b/e2e/storage.ts
index 25e8772..b78a870 100644
--- a/e2e/storage.ts
+++ b/e2e/storage.ts
@@ -1,10 +1,10 @@
 import type { BrowserContext } from '@playwright/test';
 
-type StorageArea = 'sync' | 'local';
+type StorageArea = 'sync' | 'local' | 'session';
 type ChromeStorage = { storage: Record<StorageArea, { set(items: Record<string, unknown>): Promise<void> }> };
 type ChromeGet = { storage: Record<StorageArea, { get(key: string): Promise<Record<string, unknown>> }> };
 
-/** Writes raw chrome.storage items from the extension's service worker (keys without WXT's "sync:"/"local:" prefix). */
+/** Writes raw chrome.storage items from the extension's service worker (keys without WXT's "sync:"/"local:"/"session:" prefix). */
 export async function setStorage(context: BrowserContext, area: StorageArea, items: Record<string, unknown>): Promise<void> {
   let [worker] = context.serviceWorkers();
   if (!worker) worker = await context.waitForEvent('serviceworker');
```

Apply to `e2e/input.spec.ts`:

```diff
diff --git a/e2e/input.spec.ts b/e2e/input.spec.ts
index 853bceb..3b3f102 100644
--- a/e2e/input.spec.ts
+++ b/e2e/input.spec.ts
@@ -55,3 +55,25 @@ test('the Sites section saves host patterns and flags the rest', async ({ contex
   await expect(options.getByRole('alert')).toContainText('not a host');
   await expect.poll(() => getStorage(context, 'sync', 'settings')).toMatchObject({ excludedHosts: ['api.example.com', '*.test'] });
 });
+
+test('the scratchpad formats pasted text', async ({ context, extensionId }) => {
+  const page = await context.newPage();
+  await page.goto(`chrome-extension://${extensionId}/scratchpad.html`);
+  const input = page.getByLabel('JSON input');
+  await expect(input).toBeFocused();
+  await expect(page.locator('.sp-empty')).toBeVisible();
+  await input.fill('cb({"pasted": true})');
+  await expect(page.locator('.sp-output .cm-content')).toContainText('"pasted": true');
+  await expect(page.locator('.sp-output .jv-status-info')).toContainText('JSONP');
+  await page.getByRole('button', { name: 'Clear' }).click();
+  await expect(page.locator('.sp-empty')).toBeVisible();
+});
+
+test('the scratchpad opens with handed-over text', async ({ context, extensionId }) => {
+  await setStorage(context, 'session', { scratchpadInput: '[1, 2, 3]' });
+  const page = await context.newPage();
+  await page.goto(`chrome-extension://${extensionId}/scratchpad.html`);
+  await expect(page.getByLabel('JSON input')).toHaveValue('[1, 2, 3]');
+  await expect(page.locator('.sp-output .cm-content')).toContainText('3');
+  await expect.poll(() => getStorage(context, 'session', 'scratchpadInput')).toBeUndefined();
+});
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `pnpm exec vitest run src/scratchpad src/background/scratchpad.test.ts`
Expected: FAIL. `./input` and `./scratchpad` cannot be resolved.

- [ ] **Step 3: Implement**

Create `src/scratchpad/input.ts`:

```ts
import { storage } from '#imports';

/**
 * Text handed to the next scratchpad that opens ("View selection as JSON"). Session storage: it never reaches
 * disk or sync, and only extension pages and the background can read it.
 */
export const scratchpadInputItem = storage.defineItem<string>('session:scratchpadInput', { fallback: '' });

/** Reads and clears the handed-over text, so a reload or a second scratchpad starts empty. */
export async function takeScratchpadInput(): Promise<string> {
  const text = await scratchpadInputItem.getValue();
  if (text !== '') await scratchpadInputItem.removeValue();
  return text;
}
```

Create `src/background/scratchpad.ts`:

```ts
import { scratchpadInputItem } from '@/scratchpad/input';

export const SCRATCHPAD_PAGE = '/scratchpad.html';

/** Opens a scratchpad tab, optionally with text to show (`index` places the tab, e.g. next to the current one). */
export async function openScratchpad(text = '', index?: number): Promise<void> {
  if (text !== '') await scratchpadInputItem.setValue(text);
  await browser.tabs.create({ url: browser.runtime.getURL(SCRATCHPAD_PAGE), index });
}
```

Create `src/scratchpad/ScratchpadApp.vue`:

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import { takeScratchpadInput } from './input';
import JsonViewer from '@/components/JsonViewer.vue';
import ViewerShadowRoot from '@/components/ViewerShadowRoot.vue';
import { sniffKind } from '@/detect/detect';
import type { ViewerSession } from '@/viewer/session';

const props = defineProps<{ session: ViewerSession }>();

/** Re-parse once typing pauses, not on every key: documents can be large. */
const INPUT_DELAY_MS = 250;

const input = ref('');
const raw = ref('');
const textarea = ref<HTMLTextAreaElement>();
let timer: ReturnType<typeof setTimeout> | undefined;

function show(text: string): void {
  clearTimeout(timer);
  raw.value = text;
}

function onInput(): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    raw.value = input.value;
  }, INPUT_DELAY_MS);
}

function clear(): void {
  input.value = '';
  show('');
  textarea.value?.focus();
}

function openSettings(): void {
  void browser.runtime.openOptionsPage();
}

const format = computed(() => sniffKind(raw.value));
const state = props.session.state;

onMounted(async () => {
  const handed = await takeScratchpadInput();
  if (handed !== '') {
    input.value = handed;
    show(handed);
  }
  textarea.value?.focus();
});
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div class="sp-app">
    <header class="sp-header">
      <h1 class="sp-title">JSON Scratchpad</h1>
      <span class="sp-hint">Paste JSON, JSONP or NDJSON on the left.</span>
      <button type="button" class="sp-button" :disabled="input === ''" @click="clear">Clear</button>
    </header>
    <textarea
      ref="textarea"
      v-model="input"
      class="sp-input"
      aria-label="JSON input"
      spellcheck="false"
      placeholder='{"paste": "JSON here"}'
      @input="onInput"
    />
    <div class="sp-output">
      <ViewerShadowRoot v-if="raw.trim() !== ''">
        <JsonViewer
          :raw="raw"
          :format="format"
          :options="state.settings.viewer"
          :font="state.settings.font"
          :shortcuts="state.settings.shortcuts"
          :features="state.settings.features"
          :theme="session.theme.value"
          :kind="session.kind.value"
          :custom-css="state.customCss"
          @toggle-theme="session.toggleTheme"
          @open-settings="openSettings"
        />
      </ViewerShadowRoot>
      <p v-else class="sp-empty">The formatted result appears here.</p>
    </div>
  </div>
</template>
```

Create `src/scratchpad/scratchpad.css`:

```css
:root {
  color-scheme: light dark;
  --sp-bg: #ffffff;
  --sp-fg: #1f2328;
  --sp-muted: #59636e;
  --sp-panel: #f6f8fa;
  --sp-border: #d1d9e0;
  --sp-accent: #0969da;
}

@media (prefers-color-scheme: dark) {
  :root {
    --sp-bg: #0d1117;
    --sp-fg: #e6edf3;
    --sp-muted: #9198a1;
    --sp-panel: #151b23;
    --sp-border: #3d444d;
    --sp-accent: #4493f8;
  }
}

* {
  box-sizing: border-box;
}

html,
body,
#app {
  margin: 0;
  height: 100%;
  background: var(--sp-bg);
  color: var(--sp-fg);
  font: 14px/1.5 system-ui, sans-serif;
}

.sp-app {
  height: 100%;
  display: grid;
  grid-template-columns: minmax(240px, 2fr) 3fr;
  grid-template-rows: auto minmax(0, 1fr);
}

.sp-header {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--sp-border);
}

.sp-title {
  margin: 0;
  font-size: 16px;
}

.sp-hint {
  flex: 1;
  color: var(--sp-muted);
}

.sp-button {
  padding: 4px 12px;
  border: 1px solid var(--sp-border);
  border-radius: 6px;
  background: var(--sp-panel);
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.sp-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.sp-input {
  min-height: 0;
  padding: 12px 16px;
  border: none;
  border-right: 1px solid var(--sp-border);
  outline: none;
  resize: none;
  background: var(--sp-panel);
  color: inherit;
  font: 13px/1.5 ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace;
}

.sp-input:focus-visible {
  box-shadow: inset 0 0 0 2px var(--sp-accent);
}

.sp-output {
  display: flex;
  min-width: 0;
  min-height: 0;
}

.sp-output > .jv-shadow-host {
  flex: 1;
  min-width: 0;
  height: 100%;
}

.sp-empty {
  margin: auto;
  color: var(--sp-muted);
}

@media (max-width: 800px) {
  .sp-app {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 40% minmax(0, 1fr);
  }

  .sp-input {
    border-right: none;
    border-bottom: 1px solid var(--sp-border);
  }
}
```

Create `src/entrypoints/scratchpad/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>JSON Scratchpad</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

Create `src/entrypoints/scratchpad/main.ts`:

```ts
import '@/scratchpad/scratchpad.css';
import { createApp } from 'vue';
import ScratchpadApp from '@/scratchpad/ScratchpadApp.vue';
import { createViewerSession } from '@/viewer/session';

createViewerSession(document.fonts)
  .then((session) => createApp(ScratchpadApp, { session }).mount('#app'))
  .catch((error: unknown) => {
    console.error('[json-viewer] scratchpad failed to start', error);
    document.body.textContent = 'The scratchpad could not load its settings. Reload the page to try again.';
  });
```

Apply to `src/entrypoints/background.ts`:

```diff
diff --git a/src/entrypoints/background.ts b/src/entrypoints/background.ts
index 521a309..3678fef 100644
--- a/src/entrypoints/background.ts
+++ b/src/entrypoints/background.ts
@@ -1,7 +1,13 @@
+import { openScratchpad } from '@/background/scratchpad';
 import { onJsonDetected } from '@/background/viewer';
 import { isJsonDetectedMessage, isOpenOptionsMessage } from '@/messages';
 
 export default defineBackground(() => {
+  // The toolbar icon has no popup: a click opens the scratchpad next to the current tab.
+  browser.action.onClicked.addListener((tab) => {
+    openScratchpad('', tab.index + 1).catch((error: unknown) => console.warn('[json-viewer] scratchpad failed', error));
+  });
+
   browser.runtime.onMessage.addListener((message, sender) => {
     if (isOpenOptionsMessage(message)) {
       void browser.runtime.openOptionsPage();
```

Apply to `wxt.config.ts`:

```diff
diff --git a/wxt.config.ts b/wxt.config.ts
index 783ec13..48a9ca7 100644
--- a/wxt.config.ts
+++ b/wxt.config.ts
@@ -21,6 +21,8 @@ export default defineConfig({
     name: 'JSON Viewer',
     description: 'Fast, themeable JSON viewer with VS Code themes and Google Fonts.',
     permissions: ['storage', 'scripting'],
+    // No popup: clicking the icon opens the scratchpad (background.ts).
+    action: { default_title: 'Open the JSON scratchpad' },
     homepage_url: 'https://github.com/marr-cloud/json-viewer',
   },
 });
```

Run `pnpm exec wxt prepare` once, so the generated types know `/scratchpad.html`. `browser.runtime.getURL` only accepts known paths.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/scratchpad src/background`
Expected: PASS.

Run: `pnpm build`, then `pnpm exec playwright test e2e/input.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Full checks and commit**

Run: `pnpm test` and `pnpm compile`. `.output/chrome-mv3/manifest.json` must now contain `"action":{"default_title":"Open the JSON scratchpad"}`.

```bash
git add src/scratchpad src/entrypoints/scratchpad src/background/scratchpad.ts src/background/scratchpad.test.ts src/entrypoints/background.ts wxt.config.ts e2e/storage.ts e2e/input.spec.ts
git commit -m "feat(scratchpad): paste JSON into a viewer page opened from the toolbar icon"
```

---

### Task 7: View as JSON (context menu)

**Files:**
- Create: `src/background/menus.ts`, `src/background/menus.test.ts`
- Modify: `src/messages.ts`, `src/background/viewer.ts`, `src/background/viewer.test.ts`, `src/entrypoints/background.ts`, `src/entrypoints/viewer.content/index.ts`, `wxt.config.ts`, `e2e/server.ts`, `e2e/input.spec.ts`

**Interfaces:**
- Consumes: `injectViewer`, `FrameTarget`, `VIEWER_SCRIPT` (Task 3); `openScratchpad`, `SCRATCHPAD_PAGE` (Task 6); `scratchpadInputItem` (Task 6).
- Produces:
  - `FORCE_VIEWER_FLAG = '__jsonViewerForced'` (`src/messages.ts`).
  - `injectViewer(target, force = false)`. When forced, it first runs `func(flag) { globalThis[flag] = true }` with `args: [FORCE_VIEWER_FLAG]` in the same frame, then the viewer.
  - `src/background/menus.ts`:
    - `MENU_VIEW_PAGE = 'view-page-as-json'` and `MENU_VIEW_SELECTION = 'view-selection-as-json'`;
    - `createMenus()`: `removeAll`, then the "View as JSON" item (`page` context) and the "View selection as JSON" item (`selection` context);
    - `onMenuClick(info, tab)`. A failure gives the tab a `!` badge in `#d1242f` and a title `JSON Viewer can't open this page: <reason>`.
  - The viewer content script, when forced, falls back to `document.body.innerText` if the page isn't a plain-text response.
  - The manifest permissions become `["storage","scripting","contextMenus"]`.
  - `e2e/server.ts` route `/json-in-html` (text/html with JSON in a `<p>`).

- [ ] **Step 1: Write the failing tests**

Apply to `src/background/viewer.test.ts`:

```diff
diff --git a/src/background/viewer.test.ts b/src/background/viewer.test.ts
index 642dc9b..19a5772 100644
--- a/src/background/viewer.test.ts
+++ b/src/background/viewer.test.ts
@@ -1,5 +1,6 @@
 import { beforeEach, describe, expect, it, vi } from 'vitest';
 import { fakeBrowser } from 'wxt/testing/fake-browser';
+import { FORCE_VIEWER_FLAG } from '@/messages';
 import { injectViewer, onJsonDetected, VIEWER_SCRIPT } from './viewer';
 
 describe('background viewer injection', () => {
@@ -18,6 +19,19 @@ describe('background viewer injection', () => {
     expect(executeScript).toHaveBeenCalledWith({ target: { tabId: 7, frameIds: [3] }, files: [VIEWER_SCRIPT] });
   });
 
+  it('sets the force flag first when forced', async () => {
+    await injectViewer(target, true);
+    expect(executeScript).toHaveBeenCalledTimes(2);
+    const [flag, viewer] = executeScript.mock.calls.map(([details]) => details);
+    expect(flag).toMatchObject({ target: { tabId: 7, frameIds: [3] }, args: [FORCE_VIEWER_FLAG] });
+    // In the browser the function runs in the page's isolated world; run it here to see what it sets.
+    const scope = globalThis as unknown as Record<string, unknown>;
+    (flag.func as (name: string) => void)(FORCE_VIEWER_FLAG);
+    expect(scope[FORCE_VIEWER_FLAG]).toBe(true);
+    delete scope[FORCE_VIEWER_FLAG];
+    expect(viewer).toEqual({ target: { tabId: 7, frameIds: [3] }, files: [VIEWER_SCRIPT] });
+  });
+
   it('skips excluded sites', async () => {
     await fakeBrowser.storage.sync.set({ settings: { excludedHosts: ['*.example.com'] } });
     await onJsonDetected(target, 'https://api.example.com/v1/items');
```

Create `src/background/menus.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { scratchpadInputItem } from '@/scratchpad/input';
import { createMenus, MENU_VIEW_PAGE, MENU_VIEW_SELECTION, onMenuClick } from './menus';
import { SCRATCHPAD_PAGE } from './scratchpad';
import { VIEWER_SCRIPT } from './viewer';

const tab = { id: 7, index: 2 } as Browser.tabs.Tab;
const click = (menuItemId: string, extra: Partial<Browser.contextMenus.OnClickData> = {}) =>
  ({ menuItemId, editable: false, pageUrl: 'https://example.com/', frameId: 0, ...extra }) as Browser.contextMenus.OnClickData;

describe('context menus', () => {
  let executeScript: ReturnType<typeof vi.fn>;
  let createTab: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fakeBrowser.reset();
    executeScript = vi.fn().mockResolvedValue([]);
    vi.spyOn(fakeBrowser.scripting, 'executeScript').mockImplementation(executeScript as never);
    createTab = vi.fn().mockResolvedValue({});
    vi.spyOn(fakeBrowser.tabs, 'create').mockImplementation(createTab as never);
  });

  it('creates "View as JSON" for pages and "View selection as JSON" for selections', async () => {
    const removeAll = vi.spyOn(fakeBrowser.contextMenus, 'removeAll').mockResolvedValue(undefined);
    const create = vi.spyOn(fakeBrowser.contextMenus, 'create').mockReturnValue(1);
    await createMenus();
    expect(removeAll).toHaveBeenCalledOnce();
    expect(create.mock.calls.map(([props]) => props)).toEqual([
      { id: MENU_VIEW_PAGE, title: 'View as JSON', contexts: ['page'] },
      { id: MENU_VIEW_SELECTION, title: 'View selection as JSON', contexts: ['selection'] },
    ]);
  });

  it('forces the viewer into the clicked frame', async () => {
    await onMenuClick(click(MENU_VIEW_PAGE, { frameId: 4 }), tab);
    expect(executeScript).toHaveBeenCalledTimes(2);
    expect(executeScript.mock.calls[1]![0]).toEqual({ target: { tabId: 7, frameIds: [4] }, files: [VIEWER_SCRIPT] });
  });

  it('opens the selection in a scratchpad next to the tab', async () => {
    executeScript.mockResolvedValue([{ result: '{"a":\n1}' }]);
    await onMenuClick(click(MENU_VIEW_SELECTION, { selectionText: '{"a": 1}' }), tab);
    expect(await scratchpadInputItem.getValue()).toBe('{"a":\n1}');
    expect(createTab).toHaveBeenCalledWith({ url: fakeBrowser.runtime.getURL(SCRATCHPAD_PAGE), index: 3 });
  });

  it('falls back to the menu selection text when the frame cannot be read', async () => {
    executeScript.mockRejectedValue(new Error('Cannot access contents of the page'));
    await onMenuClick(click(MENU_VIEW_SELECTION, { selectionText: '[1, 2]' }), tab);
    expect(await scratchpadInputItem.getValue()).toBe('[1, 2]');
  });

  it('marks the toolbar icon when the viewer cannot run on the page', async () => {
    executeScript.mockRejectedValue(new Error('Cannot access a chrome:// URL'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await onMenuClick(click(MENU_VIEW_PAGE), tab);
    expect(await fakeBrowser.action.getBadgeText({ tabId: 7 })).toBe('!');
    expect(await fakeBrowser.action.getTitle({ tabId: 7 })).toContain('Cannot access a chrome:// URL');
  });

  it('ignores clicks without a tab', async () => {
    await onMenuClick(click(MENU_VIEW_PAGE), undefined);
    expect(executeScript).not.toHaveBeenCalled();
  });
});
```

Apply to `e2e/server.ts`:

```diff
diff --git a/e2e/server.ts b/e2e/server.ts
index a8e827b..4609fc2 100644
--- a/e2e/server.ts
+++ b/e2e/server.ts
@@ -46,6 +46,7 @@ const routes: Record<string, Route> = {
   '/ld': { type: 'application/ld+json; charset=utf-8', body: '{"@context":"https://schema.org"}' },
   '/plain-json': { type: 'text/plain', body: '[{"a":1}]' },
   '/plain-log': { type: 'text/plain', body: '[INFO] server started' },
+  '/json-in-html': { type: 'text/html', body: '<!doctype html><title>t</title><p>{"b": 2}</p>' },
   '/page.html': { type: 'text/html', body: '<!doctype html><title>t</title><pre>{"a":1}</pre>' },
   '/invalid.json': { type: 'application/json', body: '{\n  "a": 1,\n}' },
   '/invalid-crlf.json': { type: 'application/json', body: '{\r\n  "a": 1,\r\n  "b": 2,\r\n}' },
```

Apply to `e2e/input.spec.ts`. The e2e test drives the same two injections from the service worker, because Playwright can't click a native context menu. `menus.test.ts` checks that the menu handler makes exactly those calls.

```diff
diff --git a/e2e/input.spec.ts b/e2e/input.spec.ts
index 3b3f102..26c1e13 100644
--- a/e2e/input.spec.ts
+++ b/e2e/input.spec.ts
@@ -1,3 +1,4 @@
+import type { BrowserContext } from '@playwright/test';
 import { expect, test } from './fixtures';
 import { getStorage, setStorage } from './storage';
 
@@ -77,3 +78,39 @@ test('the scratchpad opens with handed-over text', async ({ context, extensionId
   await expect(page.locator('.sp-output .cm-content')).toContainText('3');
   await expect.poll(() => getStorage(context, 'session', 'scratchpadInput')).toBeUndefined();
 });
+
+/** What "View as JSON" does (src/background/viewer.ts injectViewer with force), run from the service worker. */
+async function forceViewer(context: BrowserContext, url: string): Promise<void> {
+  let [worker] = context.serviceWorkers();
+  if (!worker) worker = await context.waitForEvent('serviceworker');
+  await worker.evaluate(async (pageUrl) => {
+    type Scripting = {
+      executeScript(details: { target: { tabId: number }; func?: (flag: string) => void; args?: string[]; files?: string[] }): Promise<unknown>;
+    };
+    const api = (globalThis as unknown as { chrome: { tabs: { query(q: { url: string }): Promise<{ id: number }[]> }; scripting: Scripting } }).chrome;
+    const [tab] = await api.tabs.query({ url: pageUrl });
+    const target = { tabId: tab!.id };
+    await api.scripting.executeScript({
+      target,
+      func: (flag) => {
+        (globalThis as unknown as Record<string, unknown>)[flag] = true;
+      },
+      args: ['__jsonViewerForced'],
+    });
+    await api.scripting.executeScript({ target, files: ['/content-scripts/viewer.js'] });
+  }, url);
+}
+
+test('"View as JSON" opens the viewer on pages that were not detected', async ({ context, server }) => {
+  const page = await context.newPage();
+  for (const [route, text] of [
+    ['/page.html', '"a": 1'],
+    ['/json-in-html', '"b": 2'],
+  ] as const) {
+    await page.goto(server.url(route));
+    await page.waitForTimeout(300);
+    await expect(page.locator(viewer)).toHaveCount(0);
+    await forceViewer(context, server.url(route));
+    await expect(page.locator(`${viewer} .cm-content`)).toContainText(text);
+  }
+});
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `pnpm exec vitest run src/background`
Expected: FAIL. `./menus` cannot be resolved, and `FORCE_VIEWER_FLAG` is not exported.

- [ ] **Step 3: Implement**

Apply to `src/messages.ts`:

```diff
diff --git a/src/messages.ts b/src/messages.ts
index 6321bc4..98a7dda 100644
--- a/src/messages.ts
+++ b/src/messages.ts
@@ -17,3 +17,9 @@ export interface OpenOptionsMessage {
 export function isOpenOptionsMessage(value: unknown): value is OpenOptionsMessage {
   return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === OPEN_OPTIONS;
 }
+
+/**
+ * Set by the background on the content scripts' isolated world before injecting the viewer for "View as JSON":
+ * the viewer then opens even though the page wasn't detected as JSON.
+ */
+export const FORCE_VIEWER_FLAG = '__jsonViewerForced';
```

Apply to `src/background/viewer.ts`:

```diff
diff --git a/src/background/viewer.ts b/src/background/viewer.ts
index fb20b96..50fcff9 100644
--- a/src/background/viewer.ts
+++ b/src/background/viewer.ts
@@ -1,3 +1,4 @@
+import { FORCE_VIEWER_FLAG } from '@/messages';
 import { isExcludedHost } from '@/settings/hosts';
 import { loadSettings } from '@/settings/storage';
 
@@ -8,9 +9,22 @@ export interface FrameTarget {
   frameId: number;
 }
 
-/** Runs the viewer content script in one frame. */
-export async function injectViewer({ tabId, frameId }: FrameTarget): Promise<void> {
-  await browser.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files: [VIEWER_SCRIPT] });
+/**
+ * Runs the viewer content script in one frame. `force` opens it even on a page that wasn't detected as JSON
+ * ("View as JSON"): the flag goes on the content scripts' shared isolated world, where the viewer reads it.
+ */
+export async function injectViewer({ tabId, frameId }: FrameTarget, force = false): Promise<void> {
+  const target = { tabId, frameIds: [frameId] };
+  if (force) {
+    await browser.scripting.executeScript({
+      target,
+      func: (flag: string) => {
+        (globalThis as unknown as Record<string, unknown>)[flag] = true;
+      },
+      args: [FORCE_VIEWER_FLAG],
+    });
+  }
+  await browser.scripting.executeScript({ target, files: [VIEWER_SCRIPT] });
 }
 
 function hostnameOf(url: string | undefined): string | null {
```

Create `src/background/menus.ts`:

```ts
import type { Browser } from 'wxt/browser';
import { openScratchpad } from './scratchpad';
import { injectViewer, type FrameTarget } from './viewer';

export const MENU_VIEW_PAGE = 'view-page-as-json';
export const MENU_VIEW_SELECTION = 'view-selection-as-json';

/** Menus survive service worker restarts but not updates, so they are rebuilt on install and update. */
export async function createMenus(): Promise<void> {
  await browser.contextMenus.removeAll();
  browser.contextMenus.create({ id: MENU_VIEW_PAGE, title: 'View as JSON', contexts: ['page'] });
  browser.contextMenus.create({ id: MENU_VIEW_SELECTION, title: 'View selection as JSON', contexts: ['selection'] });
}

/** The selection with its line breaks (info.selectionText may lose them), or the fallback. */
async function selectedText({ tabId, frameId }: FrameTarget, fallback: string): Promise<string> {
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      func: () => getSelection()?.toString() ?? '',
    });
    const text: unknown = injection?.result;
    return typeof text === 'string' && text.trim() !== '' ? text : fallback;
  } catch {
    return fallback;
  }
}

/** Marks the toolbar icon on this tab and says why in its tooltip; the page stays as it was. */
async function reportFailure(tabId: number, error: unknown): Promise<void> {
  const reason = error instanceof Error ? error.message : String(error);
  console.warn('[json-viewer] "View as JSON" failed', error);
  try {
    await browser.action.setBadgeBackgroundColor({ tabId, color: '#d1242f' });
    await browser.action.setBadgeText({ tabId, text: '!' });
    await browser.action.setTitle({ tabId, title: `JSON Viewer can't open this page: ${reason}` });
  } catch (badgeError) {
    console.warn('[json-viewer] could not mark the toolbar icon', badgeError);
  }
}

export async function onMenuClick(info: Browser.contextMenus.OnClickData, tab: Browser.tabs.Tab | undefined): Promise<void> {
  if (tab?.id === undefined) return;
  const target = { tabId: tab.id, frameId: info.frameId ?? 0 };
  try {
    if (info.menuItemId === MENU_VIEW_PAGE) {
      await injectViewer(target, true);
    } else if (info.menuItemId === MENU_VIEW_SELECTION) {
      await openScratchpad(await selectedText(target, info.selectionText ?? ''), tab.index + 1);
    }
  } catch (error) {
    await reportFailure(tab.id, error);
  }
}
```

Apply to `src/entrypoints/background.ts`:

```diff
diff --git a/src/entrypoints/background.ts b/src/entrypoints/background.ts
index 3678fef..0d1729d 100644
--- a/src/entrypoints/background.ts
+++ b/src/entrypoints/background.ts
@@ -1,8 +1,13 @@
+import { createMenus, onMenuClick } from '@/background/menus';
 import { openScratchpad } from '@/background/scratchpad';
 import { onJsonDetected } from '@/background/viewer';
 import { isJsonDetectedMessage, isOpenOptionsMessage } from '@/messages';
 
 export default defineBackground(() => {
+  browser.runtime.onInstalled.addListener(() => {
+    createMenus().catch((error: unknown) => console.warn('[json-viewer] context menus failed', error));
+  });
+  browser.contextMenus.onClicked.addListener((info, tab) => void onMenuClick(info, tab));
   // The toolbar icon has no popup: a click opens the scratchpad next to the current tab.
   browser.action.onClicked.addListener((tab) => {
     openScratchpad('', tab.index + 1).catch((error: unknown) => console.warn('[json-viewer] scratchpad failed', error));
```

Apply to `src/entrypoints/viewer.content/index.ts`:

```diff
diff --git a/src/entrypoints/viewer.content/index.ts b/src/entrypoints/viewer.content/index.ts
index 26fb3a7..0277b84 100644
--- a/src/entrypoints/viewer.content/index.ts
+++ b/src/entrypoints/viewer.content/index.ts
@@ -4,12 +4,17 @@ import { createApp, h } from 'vue';
 import JsonViewer from '@/components/JsonViewer.vue';
 import { detect, sniffKind } from '@/detect/detect';
 import { readRawText } from '@/detect/readRawText';
-import { OPEN_OPTIONS, type OpenOptionsMessage } from '@/messages';
+import { FORCE_VIEWER_FLAG, OPEN_OPTIONS, type OpenOptionsMessage } from '@/messages';
 import { hideOriginal } from '@/viewer/hideOriginal';
 import { createViewerSession, type ViewerSession } from '@/viewer/session';
 
 const GUARD = 'data-json-viewer';
 
+/** "View as JSON" sets this on the content scripts' isolated world before injecting the viewer. */
+function isForced(): boolean {
+  return (globalThis as unknown as Record<string, unknown>)[FORCE_VIEWER_FLAG] === true;
+}
+
 export default defineContentScript({
   matches: ['<all_urls>'],
   // Avoid broadcasting the extension ID to every page via window.postMessage.
@@ -20,7 +25,8 @@ export default defineContentScript({
     const root = document.documentElement;
     const body = document.body;
     if (!body || root.hasAttribute(GUARD)) return;
-    const raw = readRawText(document);
+    // A forced viewer takes whatever text the page shows when it isn't a plain text response.
+    const raw = readRawText(document) ?? (isForced() ? body.innerText : null);
     if (raw === null) return;
     root.setAttribute(GUARD, '');
     const format = detect(document.contentType, raw)?.kind ?? sniffKind(raw);
@@ -84,7 +90,7 @@ export default defineContentScript({
           app?.unmount();
         },
       });
-      // Hide (don't remove) the browser's rendering so the original stays recoverable.
+      // Hide (don't remove) the page's own rendering so the original stays recoverable.
       restore = hideOriginal(body);
       ui.mount();
     } catch (error) {
```

Apply to `wxt.config.ts`:

```diff
diff --git a/wxt.config.ts b/wxt.config.ts
index 48a9ca7..1f419ba 100644
--- a/wxt.config.ts
+++ b/wxt.config.ts
@@ -20,7 +20,7 @@ export default defineConfig({
   manifest: {
     name: 'JSON Viewer',
     description: 'Fast, themeable JSON viewer with VS Code themes and Google Fonts.',
-    permissions: ['storage', 'scripting'],
+    permissions: ['storage', 'scripting', 'contextMenus'],
     // No popup: clicking the icon opens the scratchpad (background.ts).
     action: { default_title: 'Open the JSON scratchpad' },
     homepage_url: 'https://github.com/marr-cloud/json-viewer',
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/background`
Expected: PASS.

Run: `pnpm build`, then `pnpm exec playwright test e2e/input.spec.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Full checks and commit**

Run: `pnpm test` and `pnpm compile`. Check `.output/chrome-mv3/manifest.json`'s permissions: `["storage","scripting","contextMenus"]`.

```bash
git add src/messages.ts src/background/viewer.ts src/background/viewer.test.ts src/background/menus.ts src/background/menus.test.ts src/entrypoints/background.ts src/entrypoints/viewer.content/index.ts wxt.config.ts e2e/server.ts e2e/input.spec.ts
git commit -m "feat(background): add View as JSON and View selection as JSON to the context menu"
```

---

### Task 8: Documentation and full verification

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-10-11-json-viewer-design.md`
- Create: `docs/notes/pendientes-fase-6a.md`

**Interfaces:**
- Consumes: everything above. Produces no code.

Docs are in Spanish. Read each file first and match its style: bullets, and lines wrapped at about 120 characters.

- [ ] **Step 1: README**

Add to "## En el visor", after the "**Búsqueda (`Ctrl+F`):**" bullet:

```markdown
- **Formatos:** además de JSON, JSONP (`callback({...})`, se muestra el JSON de dentro) y NDJSON / JSON Lines (un
  valor por línea, se muestra como array). `text/plain` y JavaScript solo se abren si el cuerpo es JSON o JSONP
  válido. La barra inferior indica el formato.
```

Add a new section after "## En el visor":

```markdown
## Fuera de las páginas JSON

- **Scratchpad:** el ícono de la extensión abre una pestaña donde pegar JSON, JSONP o NDJSON y verlo en el visor.
- **Menú contextual:** "View as JSON" abre el visor en cualquier página (también en sitios excluidos); "View
  selection as JSON" abre lo seleccionado en el scratchpad. Si el navegador no deja ejecutar la extensión en la
  página, el ícono muestra un "!" y el motivo al pasar el ratón.
```

In "## Configuración", add after the "**Funciones:**" bullet:

```markdown
- **Sitios:** hosts donde no abrir el visor (uno por línea; `*.example.com` incluye `example.com`, `*` comodín).
```

- [ ] **Step 2: Spec**

In `docs/superpowers/specs/2026-10-11-json-viewer-design.md`, add after the §6.6 bullet list:

```markdown
Decisiones de la Fase 6a:

- JSONP: `/**/` opcional + nombre de callback (con puntos) + `( … )` + `;` opcional. Con tipo JSON se reconoce por
  la forma; con `text/plain` o JavaScript, solo si lo envuelto es un objeto o array válido.
- NDJSON: Chromium descarga `application/x-ndjson` y `application/jsonl` sin mostrarlos; llega como `text/plain`
  (≥ 2 líneas, cada una objeto o array) o como JSON que resulta ser NDJSON. Se muestra como array; los errores
  dicen "Line N".
- Sitios excluidos: se comprueban en el background antes de inyectar (no en el detector); patrones de host con `*`,
  `*.x` incluye `x`, sin puertos; máximo 50 de 100 caracteres. "View as JSON" los ignora.
- Menú contextual: "View as JSON" (página) fuerza el visor en el frame; "View selection as JSON" abre la selección en
  el scratchpad vía `storage.session`. Si la inyección falla, insignia "!" con el motivo en el ícono (sin permiso
  `notifications`).
- Scratchpad: el ícono (sin popup) lo abre en una pestaña nueva; no guarda el texto.
```

In §3.1:
- in the `detector.content.ts` row, change "consulta la lista de sitios excluidos y, si corresponde, envía" to "y, si corresponde, envía";
- in the `background.ts` row, change "Al recibir `json-detected`, inyecta el visor" to "Al recibir `json-detected`, comprueba la lista de sitios excluidos e inyecta el visor".

In §7, in the "Inyección fallida" row, change "notificación con el motivo" to "insignia «!» en el ícono con el motivo".

- [ ] **Step 3: Pending notes**

Create `docs/notes/pendientes-fase-6a.md`:

```markdown
# Pendientes tras la Fase 6a

## Limitaciones conocidas
- Chromium descarga `application/x-ndjson`, `application/jsonl` y similares en vez de mostrarlos: esas respuestas no
  llegan al visor (sí como `text/plain` o JSON). En Firefox está sin comprobar.
- "View as JSON" sobre una página HTML usa `document.body.innerText`; el visor tapa la página hasta recargar.
- Los patrones de sitios no admiten IPv6 literal (`[::1]`) ni distinguen puertos.
- El scratchpad no guarda el texto entre aperturas.

## Para la Fase 6b
- Exportar / importar configuración y restablecer (§6.8).
- i18n en/es (§6.9): incluye los textos nuevos de esta fase (menú contextual, Sites, scratchpad).
```

- [ ] **Step 4: Full verification**

Run each of these in order and record its output in the report:
1. `pnpm test`: all pass.
2. `pnpm compile`: no output.
3. `pnpm build`: succeeds.
4. `pnpm test:e2e`: all pass. It takes several minutes, so use a long timeout.
5. Detector size: `wc -c .output/chrome-mv3/content-scripts/detector.js`. The result must be ≤ 8192 (about 5206).
6. Non-ASCII bytes in the bundles: `LC_ALL=C grep -c -P '[^\x00-\x7F]' .output/chrome-mv3/content-scripts/*.js .output/chrome-mv3/chunks/*.js`. Expect 0 for every file.
7. Manifest: `node -e "const m=require('./.output/chrome-mv3/manifest.json');console.log(JSON.stringify(m.permissions),JSON.stringify(m.action))"`. Expect `["storage","scripting","contextMenus"] {"default_title":"Open the JSON scratchpad"}`.

List these manual checks in Edge in the report as pending manual verification:
1. Right-click a JSON page that was opened as Raw text on an excluded site → View as JSON opens the viewer.
2. Select JSON on a normal web page (for example a code block on GitHub) → View selection as JSON opens the scratchpad with it.
3. View as JSON on `edge://settings` → the icon shows "!" and the reason on hover.
4. The toolbar icon opens the scratchpad; pasting a 5 MB document stays responsive.
5. A JSONP API, for example any URL with `?callback=cb` that returns `cb({...})`, shows as JSONP.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/specs/2026-10-11-json-viewer-design.md docs/notes/pendientes-fase-6a.md
git commit -m "docs: document JSONP, NDJSON, excluded sites, the scratchpad and View as JSON"
```
