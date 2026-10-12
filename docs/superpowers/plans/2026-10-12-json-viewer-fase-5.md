# JSON Viewer — Fase 5 (Valores enriquecidos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make values easier to read without leaving the viewer:
- color swatches next to color strings;
- local/UTC tooltips on Unix times and ISO dates;
- thumbnails on hover for image URLs;
- a light mode that turns these off for huge documents;
- switches for all of this (and for the JSONPath filter) in a new Features section.

It also fixes the three Phase 4 leftovers marked as Phase 5 priorities.

**Architecture:**
- **Editor extensions (`src/editor/`).** There are three new CodeMirror extensions, each next to its pure detector:
  - `colorSwatches.ts`: a `MatchDecorator`, so only the visible lines are scanned.
  - `dateTooltips.ts` and `imagePreview.ts`: `hoverTooltip`, so nothing runs until the user hovers.
  - `jsonToken.ts`: shared by the two tooltips. It finds the string or number value under the pointer in the `@codemirror/lang-json` syntax tree, so keys never match.
- **Settings and wiring.**
  - `Settings` gains `features` (`jsonPath`, `colorSwatches`, `dateTooltips`, `imagePreview`), and `ViewerOptions` gains `lightModeThresholdMB`.
  - `JsonViewer` decides which value decorations to draw: the features minus light mode. `CodeView` passes them to `buildExtensions`.
  - The options page gets a Features section.
- **Leftovers from Phase 4:**
  - Shortcuts keep working when focus falls to the page body: a document-level listener in the content script's viewer only.
  - On a Mac, Cmd counts as Ctrl, so the default Cmd+F works.
  - The first folding pass gets a shorter parse budget.

**Tech Stack:** WXT 0.21.4, Vue 3.5, CodeMirror 6 (`@codemirror/view` 6.43.14, `@codemirror/language` 6.13.1, `@codemirror/lang-json` 6.0.2), TypeScript, pnpm 12, Node 24, Vitest 5 (+ happy-dom), Playwright 1.64. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-11-json-viewer-design.md`:
- §3.3 step 5 (light mode);
- §6.5 (rich values);
- §6.7 (`lightModeThresholdMB`, `features`);
- §6.8 (Funciones section);
- §10 Fase 5.

Pending notes:
- `docs/notes/pendientes-fase-4.md`: three items, under "Visor (UX)" (Mac, focus on body) and "Rendimiento" (initial fold budget, `byteLength`).
- `docs/notes/pendientes-fase-0-1.md`: "Fase 5 (rendimiento)".

### Decisions that refine the spec (approved with this plan)

1. **Colors.**
   - Only whole string values that are exactly `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()/rgba()` or `hsl()/hsla()` get a swatch. Both comma and space syntax are accepted.
   - Named colors (`"red"`) and colors inside longer text don't count; there would be too many false positives.
   - Keys never get one.
   - The swatch is drawn inside the quotes (`"■ #ff5500"`, as in §6.1) through `style.backgroundColor`. That is a CSSOM property, so nothing can be injected.
2. **Dates.**
   - Integers between 1990-01-01 and 2100-01-01 count as Unix time: in seconds when ×1000 lands in that range, otherwise in milliseconds. Fractions don't count.
   - Strings count when they are ISO 8601: `YYYY-MM-DD`, optionally followed by `THH:mm[:ss[.fraction]]` and `Z` or `±HH:mm`. Impossible days such as `2024-02-30` are rejected (`Date.parse` would roll them over).
   - The tooltip shows three lines: local time with its UTC offset, UTC, and "Unix time in seconds/milliseconds" for numbers.
   - IDs that happen to fall in the range also get a tooltip. That is acceptable because it only appears on hover.
3. **Images.**
   - Only http(s) URLs whose path ends in `.png .jpg .jpeg .gif .webp .svg .avif` (any case; query and hash allowed).
   - The image is requested only when the tooltip opens, with `referrerPolicy = 'no-referrer'`.
   - Pages whose CSP blocks images, and missing images, show "The image could not be loaded.".
   - It is on by default; the spec says "Desactivable", and the new Features section can turn it off.
4. **Light mode.**
   - `viewer.lightModeThresholdMB` replaces `maxJsonSize`: default 20, integer 1–1000, measured in MiB like the status bar.
   - It is measured on the raw response.
   - Above it, the three value decorations are off and the status bar shows "Light mode", with a title that explains why. Everything else works as usual.
5. **`features.jsonPath` off** hides the filter box. Its shortcut then does nothing, so the key keeps its usual meaning.
6. **Shortcuts with focus on the page body.**
   - Clicking a non-focusable part of the viewer (status bar, toolbar gaps) leaves focus on `<body>`, which is outside the viewer's root.
   - The content script's viewer therefore also listens on `document` (capture phase), and only for key events whose target is `body` or `html`.
   - Key events inside the viewer still go through the root listener, so nothing runs twice.
   - The options preview never listens on `document`.
7. **Mac.**
   - Cmd counts as Ctrl, both when matching and when recording, so a stored `"Ctrl+F"` means Cmd+F on a Mac and settings sync across platforms unchanged.
   - Physical Ctrl also counts as Ctrl there.
   - On a Mac the options page shows "Cmd" and "Option", and the hint reads "Use Cmd, Option or a function key (F1–F24).".
8. **Initial fold budget: 1000 → 100 ms.**
   - CodeMirror keeps a timed-out parse to itself: it only reaches the editor state when the parse finishes or when its idle-time worker hands it over. So a longer first budget only helps when it finishes the whole parse.
   - With 100 ms, the parsed part folds at once and the rest folds after the background continuation finishes (the continuation already exists, `CONTINUE_SLICE_MS`), instead of freezing for up to 1 s first.
   - This was checked on 2026-10-12: `forceParsing` with a budget that runs out leaves `syntaxTree(view.state).length` unchanged.
9. **`byteLength`** counts UTF-8 bytes in a loop instead of allocating a `Uint8Array`, since light mode now reads it on documents of 20 MB and more. A lone surrogate counts as U+FFFD (3 bytes), like `TextEncoder`.

## Global Constraints

- pnpm only (`pnpm add`, `pnpm exec`; never npm or npx for project commands), Node 24. Manifest V3. Permissions stay exactly `storage` and `scripting`.
- `srcDir: 'src'`; alias `@/` → `src/`. The `detector` content script must not change (≤ 8192 bytes; today 4233).
- Keep `wxt.config.ts`'s rolldown `minify.codegen.asciiOnly`. Never disable it.
- No new dependencies. Import types from `@codemirror/*` packages only, not `@lezer/*`, except where a file already does (`src/editor/theme.ts`).
- `src/themes/{color,types,scopes,fromVSCode,validate}.ts` and `src/shared/guards.ts` keep relative imports only (they run under `tsx`).
- Storage keys unchanged. `sync:settings` stays at version 1. New fields (`features`, `viewer.lightModeThresholdMB`) are added without a version bump; `validateSettings` fills them with defaults.
- Identifiers, comments and UI text in English. Docs in `docs/` in Spanish. Conventional commits.
- Unit tests sit next to code (`src/**/*.test.ts`); e2e tests live in `e2e/`. Component tests use happy-dom and Vue's `createApp` (no `@vue/test-utils`).
- TypeScript has `noImplicitOverride`: methods that override a base class (e.g. `WidgetType.eq`/`toDOM`) need `override`.
- The CodeView reconfigure watch is shallow. Any object passed to `JsonViewer`/`CodeView` must be replaced, not mutated.
- happy-dom fires `selectionchange` synchronously: in unit tests, call `view.contentDOM.blur()` before dispatching a selection to a focused editor.
- In unit tests, a view whose whole tree must be parsed is built with `ensureSyntaxTree(state, doc.length, 5000)` and then `state.update({}).state`. The no-op transaction moves the finished parse into the state.
- Write files with the Write/Edit tools, not shell heredocs, and check `git diff` before each commit.
- Before each commit run `pnpm test` and `pnpm compile`. Tasks with e2e steps also run `pnpm build` and the named spec with `pnpm exec playwright test <file>`. The last task runs the full `pnpm test:e2e`.

## Review Focus

1. **Huge documents in light mode (≥ threshold).**
   - Expected: no swatches or tooltips, "Light mode" in the status bar, nothing slower than today.
   - Tests: Task 1 unit `isLightMode`; Task 6 component `switches to light mode above the size threshold`; Task 6 e2e `uses light mode above the threshold`.
2. **Keys that look like values** (`"#fff": 1`, `"2024-10-12": 42`, `"https://x/a.png": 1`).
   - Expected: keys never get a swatch or a tooltip.
   - Tests: Task 2 `puts a swatch inside color values, not keys or other strings`; Task 3 `ignores keys and other values`; Task 4 `ignores keys and URLs that are not images`.
3. **Images that can't load** (page CSP `img-src 'none'`, 404, mixed content).
   - Expected: the tooltip says so and nothing else breaks.
   - Tests: Task 4 unit `says so when the image fails to load`; Task 6 e2e `says when the page blocks the image`.
4. **Invalid JSON documents** (error view).
   - Expected: decorations still work on what parses, and nothing throws.
   - Test: Task 5 CodeView `decorates an invalid document without throwing`.
5. **Focus on the page body.**
   - Expected: after a click on the status bar, the shortcuts still work. Keys aimed at other page elements, and the options page, are never hijacked.
   - Tests: Task 8 component `catches shortcuts on the page itself when asked to` and `leaves other page keys alone`; Task 8 e2e `keeps the shortcuts after a click on a non-focusable part of the viewer`.

---

### Task 1: Feature switches, light mode threshold and size helpers

**Files:**
- Modify: `src/viewer/options.ts`, `src/viewer/prepare.test.ts`, `src/settings/schema.ts`, `src/settings/schema.test.ts`, `src/viewer/stats.ts`, `src/viewer/stats.test.ts`
- Create: `src/viewer/options.test.ts`

**Interfaces:**
- Consumes: `bool`, `intInRange`, `validateFields`, `ObjectValidators` (`src/settings/fields.ts`).
- Produces (all in `src/viewer/options.ts` unless noted):
  - `ViewerOptions.lightModeThresholdMB: number` (default `20`)
  - `LIGHT_MODE_MIN_MB = 1`, `LIGHT_MODE_MAX_MB = 1000`
  - `interface Features { jsonPath: boolean; colorSwatches: boolean; dateTooltips: boolean; imagePreview: boolean }`, `defaultFeatures` (all `true`)
  - `type RichValues = Pick<Features, 'colorSwatches' | 'dateTooltips' | 'imagePreview'>`, `NO_RICH_VALUES` (all `false`)
  - `richValues(features: Features, lightMode: boolean): RichValues`
  - `Settings.features: Features` (`src/settings/schema.ts`)
  - `isLightMode(bytes: number, thresholdMB: number): boolean` and an allocation-free `byteLength` (`src/viewer/stats.ts`)

- [ ] **Step 1: Write the failing tests**

Create `src/viewer/options.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultFeatures, NO_RICH_VALUES, richValues } from './options';

describe('richValues', () => {
  it('draws the enabled value decorations', () => {
    expect(richValues(defaultFeatures, false)).toEqual({ colorSwatches: true, dateTooltips: true, imagePreview: true });
    expect(richValues({ ...defaultFeatures, dateTooltips: false, jsonPath: false }, false)).toEqual({
      colorSwatches: true,
      dateTooltips: false,
      imagePreview: true,
    });
  });

  it('draws none in light mode', () => {
    expect(richValues(defaultFeatures, true)).toBe(NO_RICH_VALUES);
  });
});

describe('defaultFeatures', () => {
  it('turns everything on', () => {
    expect(defaultFeatures).toEqual({ jsonPath: true, colorSwatches: true, dateTooltips: true, imagePreview: true });
  });
});
```

In `src/viewer/prepare.test.ts`, add `lightModeThresholdMB: 20,` after `foldFromLevel: 0,` in the `defaultViewerOptions` expectation.

In `src/settings/schema.test.ts`:
- Change the import from `@/viewer/options` to `import { defaultFeatures, defaultViewerOptions } from '@/viewer/options';`.
- In `defaults to auto mode with Light+ and Dark+` and in `replaces each invalid field with its default and keeps the rest`, add `features: defaultFeatures,` after `shortcuts: defaultShortcuts,` in the expected object.
- In `keeps valid values`, add `features: { ...defaultFeatures, imagePreview: false },` to `input` after the `shortcuts` line.
- Add these tests inside `describe('validateSettings', …)`:

```ts
  it('validates the features one by one', () => {
    const result = validateSettings({ features: { colorSwatches: false, imagePreview: 'no', extra: true } });
    expect(result.features).toEqual({ ...defaultFeatures, colorSwatches: false });
  });

  it('clamps and rounds the light mode threshold to 1..1000 MB', () => {
    const threshold = (value: unknown) =>
      validateSettings({ viewer: { lightModeThresholdMB: value } }).viewer.lightModeThresholdMB;
    expect(threshold(50)).toBe(50);
    expect(threshold(0)).toBe(1);
    expect(threshold(5000)).toBe(1000);
    expect(threshold(2.6)).toBe(3);
    expect(threshold('5')).toBe(20);
  });
```

In `src/viewer/stats.test.ts`:
- Change the import to `import { byteLength, countLines, formatBytes, formatCount, isLightMode } from './stats';`.
- Add inside `describe('byteLength', …)`:

```ts
  it('counts a lone surrogate as the 3-byte replacement character, like TextEncoder', () => {
    expect(byteLength('\ud800')).toBe(3);
    expect(byteLength('a\udc00b')).toBe(5);
    expect(byteLength('😀\ud83d')).toBe(7);
  });

  it('matches TextEncoder on mixed text', () => {
    const text = 'aé€😀\ud800z'.repeat(100);
    expect(byteLength(text)).toBe(new TextEncoder().encode(text).length);
  });
```

- Add at the end of the file:

```ts
describe('isLightMode', () => {
  it('is on above the threshold, in MiB', () => {
    expect(isLightMode(20 * 1024 * 1024, 20)).toBe(false);
    expect(isLightMode(20 * 1024 * 1024 + 1, 20)).toBe(true);
    expect(isLightMode(0, 1)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/viewer/options.test.ts src/viewer/prepare.test.ts src/settings/schema.test.ts src/viewer/stats.test.ts`
Expected: FAIL. `defaultFeatures`, `richValues` and `isLightMode` are not exported, and the default options and settings lack the new fields.

- [ ] **Step 3: Implement**

In `src/viewer/options.ts`, add to `ViewerOptions` after `foldFromLevel`:

```ts
  /** Above this size (MiB) the viewer skips color swatches and date and image previews. Replaces "maxJsonSize". */
  lightModeThresholdMB: number;
```

Add `lightModeThresholdMB: 20,` after `foldFromLevel: 0,` in `defaultViewerOptions`. Then append to the file:

```ts
export const LIGHT_MODE_MIN_MB = 1;
export const LIGHT_MODE_MAX_MB = 1000;

/** Optional viewer features (the options page's Features section). */
export interface Features {
  jsonPath: boolean;
  colorSwatches: boolean;
  dateTooltips: boolean;
  imagePreview: boolean;
}

export const defaultFeatures: Features = {
  jsonPath: true,
  colorSwatches: true,
  dateTooltips: true,
  imagePreview: true,
};

/** The decorations CodeMirror draws for values: color swatches, date tooltips and image previews. */
export type RichValues = Pick<Features, 'colorSwatches' | 'dateTooltips' | 'imagePreview'>;

export const NO_RICH_VALUES: RichValues = { colorSwatches: false, dateTooltips: false, imagePreview: false };

/** The value decorations to draw: the enabled ones, or none in light mode. */
export function richValues(features: Features, lightMode: boolean): RichValues {
  if (lightMode) return NO_RICH_VALUES;
  const { colorSwatches, dateTooltips, imagePreview } = features;
  return { colorSwatches, dateTooltips, imagePreview };
}
```

In `src/settings/schema.ts`:
- Replace the `@/viewer/options` import with:

```ts
import {
  defaultFeatures,
  defaultViewerOptions,
  FOLD_LEVELS,
  LIGHT_MODE_MAX_MB,
  LIGHT_MODE_MIN_MB,
  type Features,
  type ViewerOptions,
} from '@/viewer/options';
```

- Add `features: Features;` to `Settings` after `shortcuts`.
- Add `features: defaultFeatures,` to `defaultSettings` after `shortcuts`.
- Add `lightModeThresholdMB: intInRange(LIGHT_MODE_MIN_MB, LIGHT_MODE_MAX_MB),` to `viewerValidators` after `foldFromLevel`.
- Add before `settingsValidators`:

```ts
const featureValidators: ObjectValidators<Features> = {
  jsonPath: bool,
  colorSwatches: bool,
  dateTooltips: bool,
  imagePreview: bool,
};
```

- Add `features: (value) => validateFields(value, defaultFeatures, featureValidators),` to `settingsValidators` after `shortcuts`.

In `src/viewer/stats.ts`, replace `byteLength` with:

```ts
/** UTF-8 bytes, counted without encoding the text (documents can be tens of MB). */
export function byteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
      bytes += 4;
      i++;
    } else {
      // Other BMP characters, and lone surrogates (encoded as U+FFFD).
      bytes += 3;
    }
  }
  return bytes;
}
```

And append:

```ts
/** Light mode: the document is bigger than the threshold (in MiB, like the status bar). */
export function isLightMode(bytes: number, thresholdMB: number): boolean {
  return bytes > thresholdMB * MB;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/viewer/options.test.ts src/viewer/prepare.test.ts src/settings/schema.test.ts src/viewer/stats.test.ts`
Expected: PASS.

- [ ] **Step 5: Full checks and commit**

Run: `pnpm test` and `pnpm compile`. Both must pass. `src/options/useSettings.test.ts` and `src/settings/storage.test.ts` compare with `defaultSettings`, so they follow automatically.

```bash
git add src/viewer/options.ts src/viewer/options.test.ts src/viewer/prepare.test.ts src/settings/schema.ts src/settings/schema.test.ts src/viewer/stats.ts src/viewer/stats.test.ts
git commit -m "feat(settings): add feature switches and the light mode threshold"
```

---

### Task 2: Color swatches

**Files:**
- Create: `src/editor/colorSwatches.ts`, `src/editor/colorSwatches.test.ts`

**Interfaces:**
- Consumes: `syntaxTree` (`@codemirror/language`); `Decoration`, `MatchDecorator`, `ViewPlugin`, `WidgetType` (`@codemirror/view`).
- Produces:
  - `cssColor(value: string): string | null`: the value itself if it is a color as described in Decision 1, else `null`.
  - `COLOR_STRING: RegExp`: a global regex for a quoted color string; group 1 is the color.
  - `colorSwatches(): Extension`: draws `<span class="cm-jv-swatch" aria-hidden="true">` with an inline `background-color` right after the opening quote of each color value on the visible lines.

The detector and the extension were checked against `@codemirror/view` 6.43.14 on 2026-10-12. `MatchDecorator` only scans `view.visibleRanges`. The syntax tree check (`String`, not `PropertyName`) keeps keys out.

- [ ] **Step 1: Write the failing test**

Create `src/editor/colorSwatches.test.ts`:

```ts
// @vitest-environment happy-dom
import { json } from '@codemirror/lang-json';
import { ensureSyntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { colorSwatches, cssColor } from './colorSwatches';

describe('cssColor', () => {
  it('accepts hex, rgb() and hsl() colors in both syntaxes', () => {
    for (const color of [
      '#fff',
      '#FFAA00',
      '#ff550080',
      'rgb(1, 2, 3)',
      'rgba(1,2,3,0.5)',
      'rgb(1 2 3 / 50%)',
      'RGB(10%,20%,30%)',
      'hsl(120, 50%, 50%)',
      'hsla(120deg,50%,50%,.3)',
      'hsl(0.5turn 50% 50% / 0.2)',
    ]) {
      expect(cssColor(color), color).toBe(color);
    }
  });

  it('rejects anything else', () => {
    for (const value of [
      '#ff',
      '#ffff',
      '#fffff',
      '#ggg',
      'rgb(1,2)',
      'red',
      'rgb(1,2,3',
      'url(x)',
      'rgb(1,2,3);color:red',
      'hsl(1,2,3)',
      ' #fff',
      '',
    ]) {
      expect(cssColor(value), value).toBeNull();
    }
  });
});

describe('colorSwatches', () => {
  let view: EditorView | undefined;
  afterEach(() => {
    view?.destroy();
    view = undefined;
  });

  const mount = (doc: string) => {
    const state = EditorState.create({ doc, extensions: [json(), colorSwatches()] });
    ensureSyntaxTree(state, doc.length, 5000);
    // A no-op transaction moves the finished parse into the state.
    view = new EditorView({ state: state.update({}).state, parent: document.body });
    return view;
  };
  const swatches = (v: EditorView) =>
    [...v.dom.querySelectorAll<HTMLElement>('.cm-jv-swatch')].map((swatch) => swatch.style.backgroundColor);

  it('puts a swatch inside color values, not keys or other strings', () => {
    const v = mount('{\n  "#fff": "#ff5500",\n  "c": "rgb(1, 2, 3)",\n  "x": "#ggg",\n  "t": "see #fff"\n}');
    expect(swatches(v)).toEqual(['#ff5500', 'rgb(1, 2, 3)']);
  });

  it('draws the swatch right after the opening quote and hides it from screen readers', () => {
    const v = mount('["#00ff00"]');
    const swatch = v.dom.querySelector('.cm-jv-swatch')!;
    expect(swatch.getAttribute('aria-hidden')).toBe('true');
    expect(v.posAtDOM(swatch)).toBe(2);
  });

  it('follows document changes', () => {
    const v = mount('["#000"]');
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: '["#111", "#222"]' } });
    expect(swatches(v)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/editor/colorSwatches.test.ts`
Expected: FAIL with "Failed to resolve import "./colorSwatches"".

- [ ] **Step 3: Implement**

Create `src/editor/colorSwatches.ts`:

```ts
import { syntaxTree } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import {
  Decoration,
  MatchDecorator,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from '@codemirror/view';

const NUMBER = String.raw`[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?`;
const NUMBER_OR_PERCENT = `${NUMBER}%?`;
const PERCENT = `${NUMBER}%`;
const HUE = `${NUMBER}(?:deg|grad|rad|turn)?`;
// Legacy comma syntax and modern space syntax ("rgb(1 2 3 / 50%)").
const RGB =
  `rgba?\\(\\s*(?:${NUMBER_OR_PERCENT}\\s*,\\s*${NUMBER_OR_PERCENT}\\s*,\\s*${NUMBER_OR_PERCENT}(?:\\s*,\\s*${NUMBER_OR_PERCENT})?` +
  `|${NUMBER_OR_PERCENT}\\s+${NUMBER_OR_PERCENT}\\s+${NUMBER_OR_PERCENT}(?:\\s*\\/\\s*${NUMBER_OR_PERCENT})?)\\s*\\)`;
const HSL =
  `hsla?\\(\\s*(?:${HUE}\\s*,\\s*${PERCENT}\\s*,\\s*${PERCENT}(?:\\s*,\\s*${NUMBER_OR_PERCENT})?` +
  `|${HUE}\\s+${NUMBER_OR_PERCENT}\\s+${NUMBER_OR_PERCENT}(?:\\s*\\/\\s*${NUMBER_OR_PERCENT})?)\\s*\\)`;
const HEX = '#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})';
const COLOR = `${HEX}|${RGB}|${HSL}`;

const WHOLE_COLOR = new RegExp(`^(?:${COLOR})$`, 'i');
/** A JSON string whose whole content is a color, quotes included. */
export const COLOR_STRING = new RegExp(`"(${COLOR})"`, 'gi');

/** The value itself when it is a #rgb/#rrggbb/#rrggbbaa, rgb()/rgba() or hsl()/hsla() color, else null. */
export function cssColor(value: string): string | null {
  return WHOLE_COLOR.test(value) ? value : null;
}

class SwatchWidget extends WidgetType {
  constructor(readonly color: string) {
    super();
  }

  override eq(other: SwatchWidget): boolean {
    return other.color === this.color;
  }

  override toDOM(): HTMLElement {
    const swatch = document.createElement('span');
    swatch.className = 'cm-jv-swatch';
    swatch.setAttribute('aria-hidden', 'true');
    // A CSSOM property, not markup or a style attribute: nothing else can be injected.
    swatch.style.backgroundColor = this.color;
    return swatch;
  }
}

const decorator = new MatchDecorator({
  regexp: COLOR_STRING,
  decorate(add, from, _to, match, view) {
    // Keys are PropertyName nodes: only string values get a swatch.
    if (syntaxTree(view.state).resolveInner(from + 1, 1).name !== 'String') return;
    add(from + 1, from + 1, Decoration.widget({ widget: new SwatchWidget(match[1]!), side: -1 }));
  },
});

/** A small color square inside string values that are CSS colors. Only the visible lines are scanned. */
export function colorSwatches(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = decorator.createDeco(view);
      }

      update(update: ViewUpdate) {
        // The parser may reach the visible lines after they were first decorated.
        if (syntaxTree(update.state) !== syntaxTree(update.startState) && !update.docChanged) {
          this.decorations = decorator.createDeco(update.view);
        } else {
          this.decorations = decorator.updateDeco(update, this.decorations);
        }
      }
    },
    { decorations: (instance) => instance.decorations },
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/editor/colorSwatches.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Full checks and commit**

Run: `pnpm test` and `pnpm compile`.

```bash
git add src/editor/colorSwatches.ts src/editor/colorSwatches.test.ts
git commit -m "feat(editor): show color swatches next to color values"
```

---

### Task 3: Date tooltips

**Files:**
- Create: `src/editor/jsonToken.ts`, `src/editor/jsonToken.test.ts`, `src/editor/dateTooltips.ts`, `src/editor/dateTooltips.test.ts`

**Interfaces:**
- Consumes: `syntaxTree` (`@codemirror/language`); `hoverTooltip`, `Tooltip` (`@codemirror/view`).
- Produces:
  - `src/editor/jsonToken.ts`:
    - `interface ValueToken { kind: 'string' | 'number'; from: number; to: number; value: string }`
    - `valueTokenAt(state: EditorState, pos: number, side: -1 | 1): ValueToken | null`: the string (decoded) or number (as written) value at `pos`. Keys, literals and punctuation return `null`. Task 4 uses it too.
  - `src/editor/dateTooltips.ts`:
    - `interface DetectedDate { ms: number; source: 'seconds' | 'milliseconds' | 'iso' }`
    - `epochDate(value: number): DetectedDate | null`
    - `isoDate(value: string): DetectedDate | null`
    - `describeDate(date: DetectedDate, offsetMinutes: number): string[]`
    - `dateTooltipAt(view, pos, side): Tooltip | null`: a tooltip `<div class="cm-jv-date">` with one `<div>` per line.
    - `dateTooltips(): Extension` (a `hoverTooltip`)

- [ ] **Step 1: Write the failing tests**

Create `src/editor/jsonToken.test.ts`:

```ts
import { json } from '@codemirror/lang-json';
import { ensureSyntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { valueTokenAt } from './jsonToken';

const DOC = '{\n  "k\\u00e9y": "v\\"al",\n  "n": -1.5e3,\n  "t": true\n}';
const state = (() => {
  const s = EditorState.create({ doc: DOC, extensions: [json()] });
  ensureSyntaxTree(s, DOC.length, 5000);
  return s.update({}).state;
})();
const at = (needle: string) => valueTokenAt(state, DOC.indexOf(needle) + 1, 1);

describe('valueTokenAt', () => {
  it('decodes string values', () => {
    expect(at('"v\\"al"')).toEqual({ kind: 'string', from: DOC.indexOf('"v'), to: DOC.indexOf('"v') + 7, value: 'v"al' });
  });

  it('returns numbers as written', () => {
    expect(at('-1.5e3')).toMatchObject({ kind: 'number', value: '-1.5e3' });
  });

  it('ignores keys, literals and punctuation', () => {
    expect(at('"k\\u00e9y"')).toBeNull();
    expect(at('true')).toBeNull();
    expect(valueTokenAt(state, 0, 1)).toBeNull();
  });
});
```

Create `src/editor/dateTooltips.test.ts`:

```ts
// @vitest-environment happy-dom
import { json } from '@codemirror/lang-json';
import { ensureSyntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { dateTooltipAt, describeDate, epochDate, isoDate } from './dateTooltips';

describe('epochDate', () => {
  it('reads seconds and milliseconds between 1990 and 2099', () => {
    expect(epochDate(1728691200)).toEqual({ ms: 1728691200000, source: 'seconds' });
    expect(epochDate(1728691200123)).toEqual({ ms: 1728691200123, source: 'milliseconds' });
    expect(epochDate(631152000)).toEqual({ ms: 631152000000, source: 'seconds' });
  });

  it('ignores numbers outside the range, fractions and unsafe integers', () => {
    for (const value of [631151999, 4102444800, 42, 0, -1728691200, 1728691200.5, 12345678901234567890]) {
      expect(epochDate(value), String(value)).toBeNull();
    }
  });
});

describe('isoDate', () => {
  it('reads dates and date-times', () => {
    expect(isoDate('2024-10-12')).toEqual({ ms: Date.UTC(2024, 9, 12), source: 'iso' });
    expect(isoDate('2024-10-12T09:30:00Z')).toEqual({ ms: Date.UTC(2024, 9, 12, 9, 30), source: 'iso' });
    expect(isoDate('2024-10-12T09:30:00+02:00')).toEqual({ ms: Date.UTC(2024, 9, 12, 7, 30), source: 'iso' });
    expect(isoDate('2024-10-12T09:30:00.123456789Z')?.ms).toBe(Date.UTC(2024, 9, 12, 9, 30, 0, 123));
  });

  it('rejects impossible dates and other strings', () => {
    for (const value of ['2024-02-30', '2024-13-01', '2024-10-12T25:00:00Z', '2024-10-12 09:30', '12/10/2024', 'x']) {
      expect(isoDate(value), value).toBeNull();
    }
  });
});

describe('describeDate', () => {
  it('shows local time with its offset, UTC and how a number was read', () => {
    expect(describeDate({ ms: Date.UTC(2024, 9, 12), source: 'seconds' }, 120)).toEqual([
      '2024-10-12 02:00:00 (UTC+02:00)',
      '2024-10-12 00:00:00 UTC',
      'Unix time in seconds',
    ]);
    expect(describeDate({ ms: Date.UTC(2024, 9, 12, 0, 0, 0, 5), source: 'iso' }, -330)).toEqual([
      '2024-10-11 18:30:00.005 (UTC-05:30)',
      '2024-10-12 00:00:00.005 UTC',
    ]);
  });
});

describe('dateTooltipAt', () => {
  let view: EditorView | undefined;
  afterEach(() => {
    view?.destroy();
    view = undefined;
  });

  const DOC = '{\n  "createdAt": 1728691200,\n  "at": "2024-10-12T00:00:00Z",\n  "2024-10-12": 42\n}';
  const mount = () => {
    const state = EditorState.create({ doc: DOC, extensions: [json()] });
    ensureSyntaxTree(state, DOC.length, 5000);
    view = new EditorView({ state: state.update({}).state, parent: document.body });
    return view;
  };
  const textAt = (v: EditorView, needle: string) => {
    const tooltip = dateTooltipAt(v, DOC.indexOf(needle) + 2, 1);
    return tooltip ? tooltip.create(v).dom.textContent : null;
  };

  it('describes Unix times and ISO strings', () => {
    const v = mount();
    expect(textAt(v, '1728691200')).toContain('2024-10-12 00:00:00 UTC');
    expect(textAt(v, '1728691200')).toContain('Unix time in seconds');
    expect(textAt(v, '"2024-10-12T00')).toContain('2024-10-12 00:00:00 UTC');
  });

  it('ignores keys and other values', () => {
    const v = mount();
    expect(textAt(v, '"2024-10-12":')).toBeNull();
    expect(textAt(v, '42')).toBeNull();
  });

  it('covers the whole token', () => {
    const v = mount();
    const tooltip = dateTooltipAt(v, DOC.indexOf('1728691200') + 3, 1)!;
    expect(DOC.slice(tooltip.pos, tooltip.end)).toBe('1728691200');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/editor/jsonToken.test.ts src/editor/dateTooltips.test.ts`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 3: Implement**

Create `src/editor/jsonToken.ts`:

```ts
import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';

/** A string or number value in the document (keys are PropertyName nodes, so they never match). */
export interface ValueToken {
  kind: 'string' | 'number';
  from: number;
  to: number;
  /** The decoded value: the string's text, or the number as written. */
  value: string;
}

/** The string or number value at `pos`, or null (keys, punctuation, unparsed text). */
export function valueTokenAt(state: EditorState, pos: number, side: -1 | 1): ValueToken | null {
  const node = syntaxTree(state).resolveInner(pos, side);
  const text = state.sliceDoc(node.from, node.to);
  if (node.name === 'Number') return { kind: 'number', from: node.from, to: node.to, value: text };
  if (node.name !== 'String') return null;
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'string' ? { kind: 'string', from: node.from, to: node.to, value } : null;
  } catch {
    return null;
  }
}
```

Create `src/editor/dateTooltips.ts`:

```ts
import type { Extension } from '@codemirror/state';
import { hoverTooltip, type EditorView, type Tooltip } from '@codemirror/view';
import { valueTokenAt } from './jsonToken';

const MIN_MS = Date.UTC(1990, 0, 1);
const MAX_MS = Date.UTC(2100, 0, 1);

export interface DetectedDate {
  ms: number;
  /** How the value was read; shown in the tooltip. */
  source: 'seconds' | 'milliseconds' | 'iso';
}

/** An integer read as Unix time in seconds or milliseconds, when it lands in 1990–2099. */
export function epochDate(value: number): DetectedDate | null {
  if (!Number.isSafeInteger(value)) return null;
  if (value * 1000 >= MIN_MS && value * 1000 < MAX_MS) return { ms: value * 1000, source: 'seconds' };
  if (value >= MIN_MS && value < MAX_MS) return { ms: value, source: 'milliseconds' };
  return null;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

/** An ISO 8601 date or date-time string (e.g. "2024-10-12", "2024-10-12T09:30:00Z"). */
export function isoDate(value: string): DetectedDate | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // Date.parse rolls "2024-02-30" over to March 1st; reject days the month doesn't have.
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : { ms, source: 'iso' };
}

/** "2024-10-12 09:30:00" (milliseconds only when present) for a time already shifted to the wanted zone. */
function formatClock(ms: number): string {
  const iso = new Date(ms).toISOString();
  const clock = iso.slice(0, 19).replace('T', ' ');
  return iso.slice(20, 23) === '000' ? clock : `${clock}.${iso.slice(20, 23)}`;
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

const SOURCE_LABELS: Record<DetectedDate['source'], string | null> = {
  seconds: 'Unix time in seconds',
  milliseconds: 'Unix time in milliseconds',
  iso: null,
};

/**
 * The tooltip lines for a date: local time (with its UTC offset), UTC, and how a number was read.
 * `offsetMinutes` is the local offset east of UTC (Europe/Madrid in summer: 120).
 */
export function describeDate(date: DetectedDate, offsetMinutes: number): string[] {
  const lines = [
    `${formatClock(date.ms + offsetMinutes * 60_000)} (${formatOffset(offsetMinutes)})`,
    `${formatClock(date.ms)} UTC`,
  ];
  const label = SOURCE_LABELS[date.source];
  return label === null ? lines : [...lines, label];
}

/** The date tooltip for the value at `pos`, if it is one. */
export function dateTooltipAt(view: EditorView, pos: number, side: -1 | 1): Tooltip | null {
  const token = valueTokenAt(view.state, pos, side);
  if (token === null) return null;
  const date = token.kind === 'number' ? epochDate(Number(token.value)) : isoDate(token.value);
  if (date === null) return null;
  const lines = describeDate(date, -new Date(date.ms).getTimezoneOffset());
  return {
    pos: token.from,
    end: token.to,
    above: true,
    create() {
      const dom = document.createElement('div');
      dom.className = 'cm-jv-date';
      for (const line of lines) {
        const row = document.createElement('div');
        row.textContent = line;
        dom.append(row);
      }
      return { dom };
    },
  };
}

/** Hovering a Unix time (1990–2099) or an ISO 8601 string shows it in local time and UTC. */
export function dateTooltips(): Extension {
  return hoverTooltip(dateTooltipAt);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/editor/jsonToken.test.ts src/editor/dateTooltips.test.ts`
Expected: PASS (3 + 9 tests).

- [ ] **Step 5: Full checks and commit**

Run: `pnpm test` and `pnpm compile`.

```bash
git add src/editor/jsonToken.ts src/editor/jsonToken.test.ts src/editor/dateTooltips.ts src/editor/dateTooltips.test.ts
git commit -m "feat(editor): show Unix times and ISO dates in local time and UTC on hover"
```

---

### Task 4: Image previews

**Files:**
- Create: `src/editor/imagePreview.ts`, `src/editor/imagePreview.test.ts`

**Interfaces:**
- Consumes: `valueTokenAt` (Task 3, `src/editor/jsonToken.ts`); `hoverTooltip`, `Tooltip` (`@codemirror/view`).
- Produces:
  - `imageUrl(value: string): string | null`: the normalized `href`, or `null`.
  - `imageTooltipAt(view, pos, side): Tooltip | null`: a tooltip `<div class="cm-jv-image">` with an `<img>` (no referrer) and `<div class="cm-jv-image-info">`.
    - The info text reads `Loading…` at first.
    - After the image loads it shows `<width> × <height>`.
    - If the load fails, the `<img>` is removed and the text becomes `The image could not be loaded.`.
  - `imagePreview(): Extension` (a `hoverTooltip`)

- [ ] **Step 1: Write the failing test**

Create `src/editor/imagePreview.test.ts`:

```ts
// @vitest-environment happy-dom
import { json } from '@codemirror/lang-json';
import { ensureSyntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { imageTooltipAt, imageUrl } from './imagePreview';

describe('imageUrl', () => {
  it('accepts http(s) URLs whose path ends in an image extension', () => {
    for (const url of [
      'https://example.com/a.png',
      'http://example.com/b/c.JPG',
      'https://example.com/d.jpeg?size=2#x',
      'https://example.com/e.gif',
      'https://example.com/f.webp',
      'https://api.iconify.design/vscode-icons:file-type-json.svg',
      'https://example.com/g.avif',
    ]) {
      expect(imageUrl(url), url).toBe(new URL(url).href);
    }
  });

  it('rejects other URLs and schemes', () => {
    for (const value of [
      'https://example.com/a.png.html',
      'https://example.com/?file=a.png',
      'ftp://example.com/a.png',
      'data:image/png;base64,AAAA',
      'javascript:alert(1)//.png',
      'a.png',
      '',
    ]) {
      expect(imageUrl(value), value).toBeNull();
    }
  });
});

describe('imageTooltipAt', () => {
  let view: EditorView | undefined;
  afterEach(() => {
    view?.destroy();
    view = undefined;
  });

  const DOC = '{\n  "icon": "https://example.com/i.png",\n  "https://example.com/k.png": 1,\n  "page": "https://example.com/"\n}';
  const mount = () => {
    const state = EditorState.create({ doc: DOC, extensions: [json()] });
    ensureSyntaxTree(state, DOC.length, 5000);
    view = new EditorView({ state: state.update({}).state, parent: document.body });
    return view;
  };
  const tooltipAt = (v: EditorView, needle: string) => imageTooltipAt(v, DOC.indexOf(needle) + 3, 1);

  it('shows the image for image URLs, without a referrer', () => {
    const v = mount();
    const dom = tooltipAt(v, '"https://example.com/i.png"')!.create(v).dom;
    const img = dom.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://example.com/i.png');
    expect(img.referrerPolicy).toBe('no-referrer');
    expect(dom.textContent).toContain('Loading…');
  });

  it('says so when the image fails to load', () => {
    const v = mount();
    const dom = tooltipAt(v, '"https://example.com/i.png"')!.create(v).dom;
    dom.querySelector('img')!.dispatchEvent(new Event('error'));
    expect(dom.querySelector('img')).toBeNull();
    expect(dom.textContent).toBe('The image could not be loaded.');
  });

  it('ignores keys and URLs that are not images', () => {
    const v = mount();
    expect(tooltipAt(v, '"https://example.com/k.png"')).toBeNull();
    expect(tooltipAt(v, '"https://example.com/"')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/editor/imagePreview.test.ts`
Expected: FAIL with "Failed to resolve import "./imagePreview"".

- [ ] **Step 3: Implement**

Create `src/editor/imagePreview.ts`:

```ts
import type { Extension } from '@codemirror/state';
import { hoverTooltip, type EditorView, type Tooltip } from '@codemirror/view';
import { valueTokenAt } from './jsonToken';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'];

/** The URL when `value` is an http(s) URL whose path ends in an image extension, else null. */
export function imageUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const path = url.pathname.toLowerCase();
  return IMAGE_EXTENSIONS.some((extension) => path.endsWith(extension)) ? url.href : null;
}

function imageTooltipDom(src: string): HTMLElement {
  const dom = document.createElement('div');
  dom.className = 'cm-jv-image';
  const info = document.createElement('div');
  info.className = 'cm-jv-image-info';
  info.textContent = 'Loading…';
  const img = document.createElement('img');
  img.alt = '';
  // The image is only requested when the tooltip opens, and without the page as referrer.
  img.referrerPolicy = 'no-referrer';
  img.addEventListener('load', () => {
    info.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
  });
  img.addEventListener('error', () => {
    img.remove();
    info.textContent = 'The image could not be loaded.';
  });
  img.src = src;
  dom.append(img, info);
  return dom;
}

/** The image tooltip for the string at `pos`, if it is an image URL. */
export function imageTooltipAt(view: EditorView, pos: number, side: -1 | 1): Tooltip | null {
  const token = valueTokenAt(view.state, pos, side);
  if (token?.kind !== 'string') return null;
  const src = imageUrl(token.value);
  if (src === null) return null;
  return { pos: token.from, end: token.to, above: true, create: () => ({ dom: imageTooltipDom(src) }) };
}

/** Hovering an image URL (.png, .jpg, .jpeg, .gif, .webp, .svg, .avif) shows a thumbnail. */
export function imagePreview(): Extension {
  return hoverTooltip(imageTooltipAt);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/editor/imagePreview.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Full checks and commit**

Run: `pnpm test` and `pnpm compile`.

```bash
git add src/editor/imagePreview.ts src/editor/imagePreview.test.ts
git commit -m "feat(editor): preview image URLs on hover"
```

---

### Task 5: Value decorations in the editor

**Files:**
- Modify: `src/editor/setup.ts`, `src/editor/setup.test.ts`, `src/editor/theme.ts`, `src/components/CodeView.vue`, `src/components/CodeView.test.ts`

**Interfaces:**
- Consumes: `colorSwatches()` (Task 2), `dateTooltips()` (Task 3), `imagePreview()` (Task 4), `RichValues`, `NO_RICH_VALUES` (Task 1).
- Produces:
  - `EditorSetup.rich?: RichValues`: when omitted, `buildExtensions` uses `NO_RICH_VALUES`.
  - `CodeView` prop `rich?: RichValues`, part of the shallow reconfigure watch. Pass a new object to change it.
  - Theme rules for `.cm-jv-swatch`, `.cm-tooltip`, `.cm-jv-image img` and `.cm-jv-image-info`.

- [ ] **Step 1: Write the failing tests**

In `src/editor/setup.test.ts`:
- Change the `@/viewer/options` import to `import { defaultViewerOptions, NO_RICH_VALUES, type RichValues, type ViewerOptions } from '@/viewer/options';`.
- Add inside `describe('buildExtensions in a mounted view', …)`:

```ts
  const mountRich = (rich: RichValues | undefined) => {
    view = new EditorView({
      state: EditorState.create({
        doc: '["#ff0000"]',
        extensions: buildExtensions({ options: defaultViewerOptions, theme: defaultTheme, error: null, rich }),
      }),
      parent: document.body,
    });
    return view;
  };

  it('adds color swatches only when asked to', () => {
    expect(mountRich({ ...NO_RICH_VALUES, colorSwatches: true }).dom.querySelectorAll('.cm-jv-swatch')).toHaveLength(1);
    view?.destroy();
    expect(mountRich(NO_RICH_VALUES).dom.querySelectorAll('.cm-jv-swatch')).toHaveLength(0);
    view?.destroy();
    expect(mountRich(undefined).dom.querySelectorAll('.cm-jv-swatch')).toHaveLength(0);
  });

  it('accepts every value decoration switched on', () => {
    expect(() => mountRich({ colorSwatches: true, dateTooltips: true, imagePreview: true })).not.toThrow();
  });
```

In `src/components/CodeView.test.ts`:
- Change the `@/viewer/options` import to `import { defaultViewerOptions, NO_RICH_VALUES, type ViewerOptions } from '@/viewer/options';`.
- Add inside the top-level `describe` (the one the existing `mount` tests use):

```ts
  it('adds and removes value decorations without recreating the editor', async () => {
    host = document.createElement('div');
    document.body.append(host);
    const state = reactive({ rich: NO_RICH_VALUES });
    app = createApp({
      render: () =>
        h(CodeView, { doc: '["#ff0000"]', options: defaultViewerOptions, theme: defaultTheme, error: null, rich: state.rich }),
    });
    app.mount(host);
    const editor = host.querySelector<HTMLElement>('.cm-editor')!;
    expect(editor.querySelectorAll('.cm-jv-swatch')).toHaveLength(0);
    state.rich = { ...NO_RICH_VALUES, colorSwatches: true };
    await nextTick();
    expect(editor.querySelectorAll('.cm-jv-swatch')).toHaveLength(1);
    expect(host.querySelector('.cm-editor')).toBe(editor);
  });

  it('decorates an invalid document without throwing', () => {
    host = document.createElement('div');
    document.body.append(host);
    app = createApp({
      render: () =>
        h(CodeView, {
          doc: '{"c": "#ff0000",}',
          options: defaultViewerOptions,
          theme: defaultTheme,
          error: { line: 1, column: 17 },
          rich: { colorSwatches: true, dateTooltips: true, imagePreview: true },
        }),
    });
    app.mount(host);
    expect(host.querySelectorAll('.cm-jv-swatch')).toHaveLength(1);
  });
```

If the existing file's top-level `describe` is not named, put the tests at the end of the first `describe` block that uses `mount`. The `app` and `host` variables are module-level and are cleaned up by the existing `afterEach`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/editor/setup.test.ts src/components/CodeView.test.ts`
Expected: FAIL. `NO_RICH_VALUES` is imported fine, but no swatch is drawn: `expected 0 to have length 1`.

- [ ] **Step 3: Implement**

In `src/editor/setup.ts`:
- Replace `import type { ViewerOptions } from '@/viewer/options';` with `import { NO_RICH_VALUES, type RichValues, type ViewerOptions } from '@/viewer/options';`.
- Add after `import { errorMarker, type ErrorLocation } from './errorLine';`:

```ts
import { colorSwatches } from './colorSwatches';
import { dateTooltips } from './dateTooltips';
```

- Add after `import { foldSummaries } from './foldSummary';`:

```ts
import { imagePreview } from './imagePreview';
```

- Change `EditorSetup` and the function signature to:

```ts
export interface EditorSetup {
  options: ViewerOptions;
  theme: Theme;
  error: ErrorLocation | null;
  /** Color swatches and date/image tooltips; none when omitted. */
  rich?: RichValues;
}

export function buildExtensions({ options, theme, error, rich = NO_RICH_VALUES }: EditorSetup): Extension[] {
```

- Add before `if (error !== null) extensions.push(errorMarker(error));`:

```ts
  if (rich.colorSwatches) extensions.push(colorSwatches());
  if (rich.dateTooltips) extensions.push(dateTooltips());
  if (rich.imagePreview) extensions.push(imagePreview());
```

In `src/editor/theme.ts`, add these rules to the object passed to `EditorView.theme`, after the `'.cm-url, .cm-url span'` rule:

```ts
      '.cm-jv-swatch': {
        display: 'inline-block',
        width: '0.8em',
        height: '0.8em',
        marginRight: '0.25em',
        verticalAlign: '-0.05em',
        border: `1px solid ${v('border')}`,
        borderRadius: '2px',
      },
      '.cm-tooltip': {
        backgroundColor: v('toolbarBackground'),
        color: v('foreground'),
        border: `1px solid ${v('border')}`,
        borderRadius: '4px',
        padding: '4px 8px',
      },
      '.cm-jv-image img': { display: 'block', maxWidth: '240px', maxHeight: '180px', marginBottom: '4px' },
      '.cm-jv-image-info': { opacity: '0.8' },
```

In `src/components/CodeView.vue`:
- Replace `import type { ViewerOptions } from '@/viewer/options';` with `import type { RichValues, ViewerOptions } from '@/viewer/options';`.
- Add to `defineProps`, after `error: ErrorLocation | null;`:

```ts
  /** Color swatches and date/image tooltips; replace the object to change them. */
  rich?: RichValues;
```

- `currentExtensions` becomes:

```ts
function currentExtensions() {
  return buildExtensions({ options: props.options, theme: props.theme, error: props.error, rich: props.rich });
}
```

- The reconfigure watch source becomes `() => [props.options, props.theme, props.error, props.rich] as const`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/editor/setup.test.ts src/components/CodeView.test.ts`
Expected: PASS.

- [ ] **Step 5: Full checks and commit**

Run: `pnpm test` and `pnpm compile`.

```bash
git add src/editor/setup.ts src/editor/setup.test.ts src/editor/theme.ts src/components/CodeView.vue src/components/CodeView.test.ts
git commit -m "feat(editor): draw color swatches and date and image tooltips when enabled"
```

---

### Task 6: Features and light mode in the viewer

**Files:**
- Modify: `src/components/JsonViewer.vue`, `src/components/JsonViewer.test.ts`, `src/components/ViewerStatusBar.vue`, `src/components/viewer.css`, `src/entrypoints/viewer.content/index.ts`, `src/options/PreviewPane.vue`, `e2e/server.ts`
- Create: `e2e/values.spec.ts`

**Interfaces:**
- Consumes: `Features`, `defaultFeatures`, `richValues` (Task 1); `isLightMode`, `byteLength` (Task 1); `CodeView` prop `rich` (Task 5).
- Produces:
  - `JsonViewer` prop `features?: Features` (default `defaultFeatures`).
    - `features.jsonPath === false` hides `JsonPathFilter`, applies no filter, and makes the filter shortcut return `false`.
  - `JsonViewer` internals: `bytes` (computed byte length of `raw`), `lightMode` (computed boolean) and `rich` (computed `RichValues`, passed to CodeView).
  - `ViewerStatusBar` prop `lightMode?: number | null` (the threshold in MB, or `null`). When set, it renders `<span class="jv-light" title="…">Light mode</span>` first in `.jv-status-info`.
  - The content script and `PreviewPane` pass `features`. PreviewPane passes a fresh copy (`{ ...settings.features }`), because the options page mutates settings in place.
  - `e2e/server.ts` route bodies can be `(origin: string) => string` and routes can set extra headers. New routes: `/rich.json`, `/rich-csp.json` (with `content-security-policy: img-src 'none'`) and `/pixel.svg` (2 × 3).
  - `e2e/values.spec.ts`, which Tasks 7 extends.

- [ ] **Step 1: Write the failing tests**

In `src/components/JsonViewer.test.ts`:
- Change the `@/viewer/options` import to `import { defaultFeatures, defaultViewerOptions, type Features, type ViewerOptions } from '@/viewer/options';`.
- Add to the `Props` type:

```ts
  options?: ViewerOptions;
  features?: Features;
```

- Add at the end of `describe('JsonViewer', …)` (after the last test, so `key`, `button` and `editorOf` are in scope):

```ts
  it('hides the JSONPath filter when the feature is off and lets its shortcut through', () => {
    const host = mount({ features: { ...defaultFeatures, jsonPath: false } });
    expect(host.querySelector('[aria-label="JSONPath filter"]')).toBeNull();
    const event = key(editorOf(host).contentDOM, 'KeyF', { key: 'F', ctrlKey: true, shiftKey: true });
    expect(event.defaultPrevented).toBe(false);
  });

  it('draws the value decorations below the size threshold', () => {
    const host = mount({ raw: '["#ff0000"]' });
    expect(host.querySelector('.jv-light')).toBeNull();
    expect(host.querySelectorAll('.cm-jv-swatch')).toHaveLength(1);
  });

  it('leaves out the value decorations that are switched off', () => {
    const host = mount({ raw: '["#ff0000"]', features: { ...defaultFeatures, colorSwatches: false } });
    expect(host.querySelectorAll('.cm-jv-swatch')).toHaveLength(0);
  });

  it('switches to light mode above the size threshold', () => {
    // Just over 1 MB, starting with a color value that would get a swatch.
    const raw = `["#ff0000","${'x'.repeat(1_100_000)}"]`;
    const host = mount({ raw, options: { ...defaultViewerOptions, lightModeThresholdMB: 1 } });
    const light = host.querySelector<HTMLElement>('.jv-light')!;
    expect(light.textContent).toBe('Light mode');
    expect(light.title).toContain('1 MB');
    expect(host.querySelectorAll('.cm-jv-swatch')).toHaveLength(0);
  });
```

In `e2e/server.ts`, replace the `routes` declaration's type and add the new routes and fixtures. Put this before `const routes`:

```ts
interface Route {
  type: string;
  /** A function gets the server's origin, for documents that link back to it. */
  body: string | ((origin: string) => string);
  headers?: Record<string, string>;
}

const richJson = (origin: string) =>
  JSON.stringify({
    accent: '#ff5500',
    '#00ff00': 'a key, not a color',
    createdAt: 1728691200,
    updatedAt: '2024-10-12T09:30:00Z',
    icon: `${origin}/pixel.svg`,
  });
```

Change `const routes: Record<string, { type: string; body: string }> = {` to `const routes: Record<string, Route> = {`. Add these entries at the end of the object:

```ts
  '/rich.json': { type: 'application/json', body: richJson },
  '/rich-csp.json': { type: 'application/json', body: richJson, headers: { 'content-security-policy': "img-src 'none'" } },
  '/pixel.svg': { type: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"/>' },
```

In the request handler, replace the two lines that write the response with:

```ts
    const origin = `http://${req.headers.host ?? '127.0.0.1'}`;
    res.writeHead(200, { 'content-type': route.type, ...route.headers });
    res.end(typeof route.body === 'function' ? route.body(origin) : route.body);
```

Create `e2e/values.spec.ts`:

```ts
import { expect, test } from './fixtures';
import { setStorage } from './storage';

const viewer = 'json-viewer-app';

test.beforeEach(async ({ extensionId }) => {
  expect(extensionId).toMatch(/^[a-p]{32}$/);
});

test('shows color swatches next to color values', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/rich.json'));
  const swatch = page.locator(`${viewer} .cm-jv-swatch`);
  await expect(swatch).toHaveCount(1);
  await expect(swatch).toHaveCSS('background-color', 'rgb(255, 85, 0)');
});

test('shows dates in local time and UTC on hover', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/rich.json'));
  await page.locator(`${viewer} .cm-line span`, { hasText: '1728691200' }).hover();
  const tooltip = page.locator(`${viewer} .cm-jv-date`);
  await expect(tooltip).toContainText('2024-10-12 00:00:00 UTC');
  await expect(tooltip).toContainText('Unix time in seconds');
});

test('previews images on hover', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/rich.json'));
  await page.locator(`${viewer} .cm-url`, { hasText: 'pixel.svg' }).hover();
  await expect(page.locator(`${viewer} .cm-jv-image img`)).toBeVisible();
  await expect(page.locator(`${viewer} .cm-jv-image-info`)).toHaveText('2 × 3');
});

test('says when the page blocks the image', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/rich-csp.json'));
  await page.locator(`${viewer} .cm-url`, { hasText: 'pixel.svg' }).hover();
  await expect(page.locator(`${viewer} .cm-jv-image-info`)).toHaveText('The image could not be loaded.');
});

test('turns features off from the settings', async ({ context, server }) => {
  await setStorage(context, 'sync', { settings: { features: { colorSwatches: false, jsonPath: false } } });
  const page = await context.newPage();
  await page.goto(server.url('/rich.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"accent"');
  await expect(page.locator(`${viewer} .cm-jv-swatch`)).toHaveCount(0);
  await expect(page.getByLabel('JSONPath filter')).toHaveCount(0);
});

test('uses light mode above the threshold', async ({ context, server }) => {
  await setStorage(context, 'sync', { settings: { viewer: { lightModeThresholdMB: 1 } } });
  const page = await context.newPage();
  await page.goto(server.url('/big.json'));
  await expect(page.locator(`${viewer} .jv-light`)).toHaveText('Light mode', { timeout: 15_000 });
  await page.goto(server.url('/rich.json'));
  await expect(page.locator(`${viewer} .cm-jv-swatch`)).toHaveCount(1);
  await expect(page.locator(`${viewer} .jv-light`)).toHaveCount(0);
});
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `pnpm exec vitest run src/components/JsonViewer.test.ts`
Expected: FAIL. The filter is still rendered, no swatch is drawn and `.jv-light` is missing.

- [ ] **Step 3: Implement**

In `src/components/JsonViewer.vue`:
- Replace `import { FOLD_ALL_LEVEL, type ViewerOptions } from '@/viewer/options';` with:

```ts
import { defaultFeatures, FOLD_ALL_LEVEL, richValues, type Features, type ViewerOptions } from '@/viewer/options';
```

- Replace the stats import with `import { byteLength, countLines, formatBytes, formatCount, isLightMode } from '@/viewer/stats';`.
- Add to the props type after `shortcuts?: Shortcuts;`:

```ts
    /** Optional features: the JSONPath filter and the value decorations follow them. */
    features?: Features;
```

- Add to the defaults after `shortcuts: () => defaultShortcuts,`:

```ts
    features: () => defaultFeatures,
```

- In `filtered`, change the first line of the body to:

```ts
  if (!props.features.jsonPath || appliedPath.value === null || !doc.ok) return null;
```

Keep `const doc = prepared.value;` above it.

- Replace `const size = computed(() => formatBytes(byteLength(props.raw)));` with:

```ts
const bytes = computed(() => byteLength(props.raw));
const size = computed(() => formatBytes(bytes.value));
/** Huge documents skip the value decorations; the status bar says so. */
const lightMode = computed(() => isLightMode(bytes.value, props.options.lightModeThresholdMB));
const rich = computed(() => richValues(props.features, lightMode.value));
```

- In `runShortcut`, the `'filter'` case becomes:

```ts
    case 'filter':
      if (!props.features.jsonPath) return false;
      if (!repeat) filter.value?.focus();
      return true;
```

- In the template:
  - add `v-if="features.jsonPath"` to `<JsonPathFilter`;
  - add `:rich="rich"` to `<CodeView` after `:error="shown.error"`;
  - add `:light-mode="lightMode ? options.lightModeThresholdMB : null"` to `<ViewerStatusBar` after `:note="matches"`.

In `src/components/ViewerStatusBar.vue`:
- The props become:

```ts
withDefaults(
  defineProps<{
    path: string | null;
    size: string;
    lines: string;
    format: string;
    note?: string;
    message?: string;
    /** The light mode threshold in MB when light mode is on, else null. */
    lightMode?: number | null;
  }>(),
  { note: undefined, message: '', lightMode: null },
);
```

- Add as the first child of `.jv-status-info`:

```html
      <span
        v-if="lightMode !== null"
        class="jv-light"
        :title="`Over ${lightMode} MB: color swatches and date and image previews are off.`"
        >Light mode</span
      >
```

In `src/components/viewer.css`, add after the `.jv-status-info` rule:

```css
.jv-light {
  font-weight: 600;
}
```

In `src/entrypoints/viewer.content/index.ts`, add `features: state.settings.features,` after `shortcuts: state.settings.shortcuts,` in the `h(JsonViewer, …)` props.

In `src/options/PreviewPane.vue`:
- Add after `const viewerShortcuts = …`:

```ts
const viewerFeatures = computed(() => ({ ...props.settings.features }));
```

- Add `:features="viewerFeatures"` to `<JsonViewer` after `:shortcuts="viewerShortcuts"`.

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `pnpm exec vitest run src/components/JsonViewer.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the e2e tests**

Run: `pnpm build`, then `pnpm exec playwright test e2e/values.spec.ts e2e/viewer.spec.ts e2e/navigation.spec.ts`
Expected: PASS. `viewer.spec.ts` and `navigation.spec.ts` cover the server change and the existing filter behavior.

- [ ] **Step 6: Full checks and commit**

Run: `pnpm test` and `pnpm compile`.

```bash
git add src/components/JsonViewer.vue src/components/JsonViewer.test.ts src/components/ViewerStatusBar.vue src/components/viewer.css src/entrypoints/viewer.content/index.ts src/options/PreviewPane.vue e2e/server.ts e2e/values.spec.ts
git commit -m "feat(viewer): follow the feature switches and use light mode for huge documents"
```

---

### Task 7: Features section in the options page

**Files:**
- Create: `src/options/sections/FeaturesSection.vue`
- Modify: `src/entrypoints/options/App.vue`, `src/options/sample.ts`, `e2e/values.spec.ts`

**Interfaces:**
- Consumes: `Features`, `LIGHT_MODE_MIN_MB`, `LIGHT_MODE_MAX_MB`, `ViewerOptions` (Task 1); `ToggleField` and `NumberField` (`src/options/fields/`); `getStorage` (`e2e/storage.ts`).
- Produces:
  - `FeaturesSection` (`id="features"`, heading `Features`) with props `{ features: Features; viewer: ViewerOptions }`.
  - The section has four switches named `JSONPath filter`, `Color swatches`, `Date tooltips` and `Image previews`, and a number field labelled `Light mode above (MB)`.
  - The nav gets a `Features` link after `Structure`.
  - The sample JSON gains a Unix time and an image URL.

- [ ] **Step 1: Write the failing e2e test**

Append to `e2e/values.spec.ts`. Also change its storage import to `import { getStorage, setStorage } from './storage';`.

```ts
test('the Features section switches features and saves them', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  const preview = options.locator('.opt-preview');
  await expect(preview.locator('.cm-jv-swatch').first()).toBeAttached();
  await expect(preview.getByLabel('JSONPath filter')).toBeVisible();

  await options.getByRole('switch', { name: 'Color swatches' }).uncheck();
  await options.getByRole('switch', { name: 'JSONPath filter' }).uncheck();
  await expect(preview.locator('.cm-jv-swatch')).toHaveCount(0);
  await expect(preview.getByLabel('JSONPath filter')).toHaveCount(0);

  await options.getByLabel('Light mode above (MB)').fill('5');
  await options.getByLabel('Light mode above (MB)').press('Tab');
  await expect
    .poll(() => getStorage(context, 'sync', 'settings'))
    .toMatchObject({
      features: { jsonPath: false, colorSwatches: false, dateTooltips: true, imagePreview: true },
      viewer: { lightModeThresholdMB: 5 },
    });
});

test('the options preview shows a date tooltip', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator('.opt-preview .cm-line span', { hasText: '1728691200' }).hover();
  await expect(options.locator('.opt-preview .cm-jv-date')).toContainText('2024-10-12 00:00:00 UTC');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm build`, then `pnpm exec playwright test e2e/values.spec.ts -g "Features section|options preview"`
Expected: FAIL. There is no "Color swatches" switch yet, and the sample has no Unix time.

- [ ] **Step 3: Implement**

Create `src/options/sections/FeaturesSection.vue`:

```vue
<script setup lang="ts">
import NumberField from '../fields/NumberField.vue';
import ToggleField from '../fields/ToggleField.vue';
import { LIGHT_MODE_MAX_MB, LIGHT_MODE_MIN_MB, type Features, type ViewerOptions } from '@/viewer/options';

defineProps<{ features: Features; viewer: ViewerOptions }>();
</script>

<template>
  <section id="features" class="opt-section">
    <h2>Features</h2>
    <ToggleField v-model="features.jsonPath" label="JSONPath filter" hint="The filter box in the toolbar." />
    <ToggleField
      v-model="features.colorSwatches"
      label="Color swatches"
      hint="A small square next to values like #ff5500 or rgb(0, 128, 255)."
    />
    <ToggleField
      v-model="features.dateTooltips"
      label="Date tooltips"
      hint="Hover a Unix time or an ISO 8601 date to see it in local time and UTC."
    />
    <ToggleField
      v-model="features.imagePreview"
      label="Image previews"
      hint="Hover an image URL to see it. The image is loaded from its site."
    />
    <NumberField
      v-model="viewer.lightModeThresholdMB"
      label="Light mode above (MB)"
      :min="LIGHT_MODE_MIN_MB"
      :max="LIGHT_MODE_MAX_MB"
      hint="Bigger documents skip color swatches and date and image previews."
    />
  </section>
</template>
```

In `src/entrypoints/options/App.vue`:
- Add `import FeaturesSection from '@/options/sections/FeaturesSection.vue';` after the `BehaviorSection` import.
- Add `<a href="#features">Features</a>` to the nav after `<a href="#structure">Structure</a>`.
- Add `<FeaturesSection :features="settings.features" :viewer="settings.viewer" />` after `<StructureSection :viewer="settings.viewer" />`.

In `src/options/sample.ts`:
- Update the comment's first sentence to: "Shows every token kind plus what the options affect: clickable URLs, color swatches, dates and an image URL to hover, long lines to wrap, nesting to fold, …".
- Keep the rest of the comment.
- Change the line `'"releasedAt":"2026-10-12T09:30:00Z","accent":"#4493f8"',` to:

```ts
  '"releasedAt":"2026-10-12T09:30:00Z","createdAt":1728691200,"accent":"#4493f8"',
  '"logo":"https://api.iconify.design/vscode-icons:file-type-json.svg"',
```

- [ ] **Step 4: Run the e2e tests to verify they pass**

Run: `pnpm build`, then `pnpm exec playwright test e2e/values.spec.ts e2e/options.spec.ts e2e/navigation.spec.ts e2e/themes.spec.ts`
Expected: PASS. The other specs read the preview's sample (`"maintainers"`, `"roles"`, `"title"`), so they check that the new lines didn't break them.

- [ ] **Step 5: Full checks and commit**

Run: `pnpm test` and `pnpm compile`.

```bash
git add src/options/sections/FeaturesSection.vue src/entrypoints/options/App.vue src/options/sample.ts e2e/values.spec.ts
git commit -m "feat(options): add a Features section"
```

---

### Task 8: Shortcuts with focus on the page body

**Files:**
- Modify: `src/components/JsonViewer.vue`, `src/components/JsonViewer.test.ts`, `src/entrypoints/viewer.content/index.ts`, `e2e/navigation.spec.ts`

**Interfaces:**
- Consumes: `onShortcut(event)` and `onEscape(event)` (`JsonViewer.vue`, Phase 4).
- Produces:
  - `JsonViewer` prop `documentShortcuts?: boolean` (default `false`).
  - When true, a capture-phase `keydown` listener on `document` runs the same shortcut and Esc handling, but only for events whose `target` is `document.body` or `document.documentElement`. It is removed on unmount.
  - The content script passes `documentShortcuts: true`. `PreviewPane` doesn't pass it.

- [ ] **Step 1: Write the failing tests**

In `src/components/JsonViewer.test.ts`:
- Add `documentShortcuts?: boolean;` to the `Props` type.
- Add at the end of `describe('JsonViewer', …)`:

```ts
  it('catches shortcuts on the page itself when asked to', async () => {
    const host = mount({ documentShortcuts: true });
    const event = key(document.body, 'KeyR', { key: 'r', altKey: true });
    expect(event.defaultPrevented).toBe(true);
    await nextTick();
    expect(host.querySelector('.jv-raw')).not.toBeNull();
  });

  it('leaves other page keys alone', () => {
    mount({ documentShortcuts: true });
    const input = document.createElement('input');
    document.body.append(input);
    expect(key(input, 'KeyR', { key: 'r', altKey: true }).defaultPrevented).toBe(false);
  });

  it('only listens on the page when asked to, and stops when unmounted', () => {
    mount();
    expect(key(document.body, 'KeyR', { key: 'r', altKey: true }).defaultPrevented).toBe(false);
    app?.unmount();
    app = undefined;
    mount({ documentShortcuts: true });
    app?.unmount();
    app = undefined;
    expect(key(document.body, 'KeyR', { key: 'r', altKey: true }).defaultPrevented).toBe(false);
  });
```

In `e2e/navigation.spec.ts`, add:

```ts
test('keeps the shortcuts after a click on a non-focusable part of the viewer', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await page.locator(`${viewer} .jv-status-info`).click();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await page.keyboard.press('Alt+R');
  await expect(page.locator(`${viewer} .jv-raw`)).toBeVisible();
});
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `pnpm exec vitest run src/components/JsonViewer.test.ts`
Expected: FAIL. `catches shortcuts on the page itself when asked to` fails with `expected false to be true`.

- [ ] **Step 3: Implement**

In `src/components/JsonViewer.vue`:
- Change the vue import to `import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';`.
- Add to the props type after `features?: Features;`:

```ts
    /**
     * Also catch shortcuts while focus is on the page itself (after a click on a non-focusable part
     * of the viewer). Only for the content script, whose viewer is the whole page.
     */
    documentShortcuts?: boolean;
```

- Add `documentShortcuts: false,` to the defaults.
- Add after `onShortcut`:

```ts
/** Focus on <body> means key events never reach the root; catch those on the document instead. */
function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.target !== document.body && event.target !== document.documentElement) return;
  onShortcut(event);
  onEscape(event);
}

onMounted(() => {
  if (props.documentShortcuts) document.addEventListener('keydown', onDocumentKeydown, true);
});
onBeforeUnmount(() => document.removeEventListener('keydown', onDocumentKeydown, true));
```

In `src/entrypoints/viewer.content/index.ts`, add `documentShortcuts: true,` after `features: state.settings.features,` in the `h(JsonViewer, …)` props.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/components/JsonViewer.test.ts`
Expected: PASS.

Run: `pnpm build`, then `pnpm exec playwright test e2e/navigation.spec.ts`
Expected: PASS.

- [ ] **Step 5: Full checks and commit**

Run: `pnpm test` and `pnpm compile`.

```bash
git add src/components/JsonViewer.vue src/components/JsonViewer.test.ts src/entrypoints/viewer.content/index.ts e2e/navigation.spec.ts
git commit -m "fix(viewer): keep shortcuts working when focus falls to the page"
```

---

### Task 9: Cmd as Ctrl on a Mac

**Files:**
- Modify: `src/settings/shortcuts.ts`, `src/settings/shortcuts.test.ts`, `src/options/fields/ShortcutField.vue`, `src/options/fields/ShortcutField.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (in `src/settings/shortcuts.ts`):
  - `IS_MAC: boolean`, from `navigator.platform`. It is `false` where there is no `navigator`.
  - `comboFromEvent(event, mac = IS_MAC)`: on a Mac, Cmd and Ctrl both produce `Ctrl` and `Meta` never appears. Elsewhere it behaves as before.
  - `shortcutLabel(combo: string, mac = IS_MAC): string`: on a Mac, `Ctrl` reads `Cmd` and `Alt` reads `Option`; otherwise the combo is returned unchanged.
  - `modifierHint(mac = IS_MAC): string`: `"Use Ctrl, Alt or a function key (F1–F24)."`, or `"Use Cmd, Option or a function key (F1–F24)."` on a Mac.
  - `ShortcutField` prop `mac?: boolean` (default `IS_MAC`). It records with `comboFromEvent(event, mac)` and shows `shortcutLabel(value, mac)` and `modifierHint(mac)`.

Stored values keep the platform-neutral `Ctrl+…` form, so `JsonViewer`'s matching (`comboFromEvent(event)` against the stored string) needs no change.

- [ ] **Step 1: Write the failing tests**

In `src/settings/shortcuts.test.ts`:
- Add `modifierHint` and `shortcutLabel` to the import list.
- Add at the end of the file:

```ts
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
```

In `src/options/fields/ShortcutField.test.ts`:
- Change `mount` to accept and pass a `mac` flag:

```ts
function mount(initial = 'Alt+R', conflict?: string, mac = false) {
```

  and add `mac,` to the `h(ShortcutField, { … })` props after `conflict,`.
- Add inside `describe('ShortcutField', …)`:

```ts
  it('records Cmd as Ctrl and shows Cmd and Option on a Mac', async () => {
    const { host, button, value } = mount('Alt+R', undefined, true);
    expect(text(button)).toBe('Option+R');
    button.click();
    await nextTick();
    press(button, 'KeyK');
    await nextTick();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Use Cmd, Option or a function key');
    press(button, 'KeyK', { metaKey: true, shiftKey: true });
    await nextTick();
    expect(value.value).toBe('Ctrl+Shift+K');
    expect(text(button)).toBe('Cmd+Shift+K');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/settings/shortcuts.test.ts src/options/fields/ShortcutField.test.ts`
Expected: FAIL. `shortcutLabel` and `modifierHint` are not exported, and Cmd records as `Meta+Shift+K`.

- [ ] **Step 3: Implement**

In `src/settings/shortcuts.ts`:
- Add after `type KeyPress = …`:

```ts
/** On a Mac, Cmd plays Ctrl's role: a stored "Ctrl+F" means Cmd+F there, so settings sync across platforms. */
export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
```

- Replace `comboFromEvent` with:

```ts
/**
 * "Ctrl+Alt+Shift+Meta+Key" for a key press; null for modifier keys on their own and unknown keys.
 * On a Mac, Cmd and Ctrl both count as Ctrl, so Meta never appears.
 */
export function comboFromEvent(event: KeyPress, mac = IS_MAC): string | null {
  const key = keyFromCode(event.code);
  if (key === null) return null;
  const parts = [
    event.ctrlKey || (mac && event.metaKey) ? 'Ctrl' : '',
    event.altKey ? 'Alt' : '',
    event.shiftKey ? 'Shift' : '',
    event.metaKey && !mac ? 'Meta' : '',
    key,
  ];
  return parts.filter((part) => part !== '').join('+');
}

/** How a combination reads on this platform: "Cmd" and "Option" on a Mac. */
export function shortcutLabel(combo: string, mac = IS_MAC): string {
  if (!mac) return combo;
  return combo
    .split('+')
    .map((part) => (part === 'Ctrl' ? 'Cmd' : part === 'Alt' ? 'Option' : part))
    .join('+');
}

/** Why a key press can't be a shortcut, naming this platform's modifiers. */
export function modifierHint(mac = IS_MAC): string {
  return mac ? 'Use Cmd, Option or a function key (F1–F24).' : 'Use Ctrl, Alt or a function key (F1–F24).';
}
```

In `src/options/fields/ShortcutField.vue`:
- Replace the shortcuts import with `import { comboFromEvent, IS_MAC, isValidShortcut, modifierHint, shortcutLabel } from '@/settings/shortcuts';`.
- Replace `defineProps<{ label: string; defaultValue: string; conflict?: string }>();` with:

```ts
const props = withDefaults(
  defineProps<{ label: string; defaultValue: string; conflict?: string; /** Defaults to this platform. */ mac?: boolean }>(),
  { conflict: undefined, mac: IS_MAC },
);
```

- In `onKeydown`, change `const combo = comboFromEvent(event);` to `const combo = comboFromEvent(event, props.mac);`.
- In the template, replace `{{ recording ? 'Press keys…' : model || 'None' }}` with `{{ recording ? 'Press keys…' : model ? shortcutLabel(model, mac) : 'None' }}`, and the alert text `Use Ctrl, Alt or a function key (F1–F24).` with `{{ modifierHint(mac) }}`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/settings/shortcuts.test.ts src/options/fields/ShortcutField.test.ts`
Expected: PASS. happy-dom's `navigator.platform` is not a Mac, so the existing tests keep the Ctrl/Alt wording.

- [ ] **Step 5: Full checks and commit**

Run: `pnpm test` and `pnpm compile`. Then run `pnpm build` and `pnpm exec playwright test e2e/navigation.spec.ts`; the shortcut e2e tests run on Windows/Linux and must still pass.

```bash
git add src/settings/shortcuts.ts src/settings/shortcuts.test.ts src/options/fields/ShortcutField.vue src/options/fields/ShortcutField.test.ts
git commit -m "feat(shortcuts): treat Cmd as Ctrl on a Mac"
```

---

### Task 10: Shorter first folding pass

**Files:**
- Modify: `src/editor/foldLevel.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `foldFromLevel(view, level, budgetMs = INITIAL_PARSE_MS)` with `INITIAL_PARSE_MS = 100` (it was 1000).
  - `foldRangesFromLevel(state, level, budgetMs = PARSE_TIMEOUT_MS)` keeps its 1000 ms default for direct callers.
  - Both signatures are otherwise unchanged.

This is a tuning constant. A timing assertion would be flaky, so there is no new unit test. The existing tests pass explicit budgets. Decision 8 explains the choice, and the e2e tests on the 4 MB document (`folds a 4 MB document completely on open`, `folds and unfolds a 4 MB document`) cover the behavior.

- [ ] **Step 1: Implement**

In `src/editor/foldLevel.ts`, add after `const PARSE_TIMEOUT_MS = 1000;`:

```ts
/**
 * Parse time before the first folds. CodeMirror keeps a timed-out parse to itself until it finishes,
 * so a longer wait only helps when the whole document parses within it; bigger documents fold the
 * parsed part at once and the rest from the background continuation below.
 */
const INITIAL_PARSE_MS = 100;
```

Change the signature of `foldFromLevel` to:

```ts
export function foldFromLevel(view: EditorView, level: number, budgetMs = INITIAL_PARSE_MS): void {
```

- [ ] **Step 2: Run the fold tests and the big-document e2e tests**

Run: `pnpm exec vitest run src/editor/foldLevel.test.ts src/components/CodeView.test.ts src/components/JsonViewer.test.ts`
Expected: PASS.

Run: `pnpm build`, then `pnpm exec playwright test e2e/navigation.spec.ts -g "4 MB"`
Expected: PASS.

- [ ] **Step 3: Full checks and commit**

Run: `pnpm test` and `pnpm compile`.

```bash
git add src/editor/foldLevel.ts
git commit -m "perf(editor): spend 100 ms on the first folding pass instead of 1 s"
```

---

### Task 11: Documentation and full verification

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-10-11-json-viewer-design.md`, `docs/notes/pendientes-fase-4.md`, `docs/notes/pendientes-fase-0-1.md`
- Create: `docs/notes/pendientes-fase-5.md`

**Interfaces:**
- Consumes: everything above. Produces no code.

Docs are in Spanish, like the existing README and notes.

- [ ] **Step 1: README**

In `README.md`, in "## En el visor", add:

```markdown
- **Valores enriquecidos:** muestra de color junto a `#ff5500`, `rgb(…)` o `hsl(…)`; al pasar el ratón por una fecha
  Unix (segundos o milisegundos) o ISO 8601, su hora local y UTC; al pasarlo por la URL de una imagen, una miniatura.
  Por encima del umbral de **modo ligero** (20 MB por defecto) se desactivan y la barra inferior lo indica.
```

In "## Configuración", add after the "**Atajos:**" bullet:

```markdown
- **Funciones:** activar o desactivar el filtro JSONPath, las muestras de color y las vistas previas de fechas e
  imágenes, y el umbral del modo ligero.
```

In the "**Atajos:**" bullet, add at the end: "En Mac, Cmd hace de Ctrl."

- [ ] **Step 2: Spec**

In `docs/superpowers/specs/2026-10-11-json-viewer-design.md`, add after the §6.5 bullet list:

```markdown
Decisiones de la Fase 5:

- Colores: solo valores completos `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()/rgba()` y `hsl()/hsla()` (sintaxis con comas
  o con espacios); ni nombres (`red`) ni claves. La muestra va dentro de las comillas.
- Fechas: enteros (no fracciones) en segundos o milisegundos; ISO 8601 `YYYY-MM-DD[THH:mm[:ss[.fff]]][Z|±HH:mm]`, sin
  días imposibles. El tooltip muestra hora local con su desfase, UTC y, en números, la unidad.
- Imágenes: la petición sale solo al abrir el tooltip y sin referrer; si la CSP de la página la bloquea o falla, el
  tooltip lo dice.
- Modo ligero: `lightModeThresholdMB` (1–1000, en MiB) sobre el texto crudo; apaga colores, fechas e imágenes.
```

In §6.4, add at the end of the paragraph after the table: "En Mac, Cmd cuenta como Ctrl (al comparar y al grabar), así que los ajustes guardados sirven en todas las plataformas; opciones muestra Cmd y Option."

In §6.7, change the row `| \`maxJsonSize\` (400 KB) | \`lightModeThresholdMB\` (20) |` to `| \`maxJsonSize\` (400 KB) | \`lightModeThresholdMB\` (20; 1–1000 MiB) |`.

In §6.8, change "Funciones" to "Funciones (Features)" and add "Atajos (Shortcuts)" after it in the list.

- [ ] **Step 3: Pending notes**

In `docs/notes/pendientes-fase-4.md`, remove these resolved bullets:
- under "Rendimiento": the one about the initial synchronous budget of `foldFromLevel`, and "`byteLength` reserva un Uint8Array completo.";
- under "Visor (UX)": the Mac `Mod-f`/`Meta+F` bullet, and the one that starts "Los atajos dejan de funcionar cuando el foco cae en `body`".

In `docs/notes/pendientes-fase-0-1.md`, delete the "## Fase 5 (rendimiento)" section with its three bullets. They move to the new file below.

Create `docs/notes/pendientes-fase-5.md`:

```markdown
# Pendientes tras la Fase 5

## Limitaciones conocidas
- Un número entero entre 1990 y 2100 en segundos o milisegundos (p. ej. un id) también muestra tooltip de fecha;
  solo aparece al pasar el ratón.
- Las imágenes se piden desde la página: su CSP (`img-src`), el contenido mixto (http en una página https) o la falta
  de cookies pueden impedir la miniatura; el tooltip lo indica.
- Los colores con transparencia se muestran sobre el fondo del editor, sin damero.

## De fases anteriores, sin resolver
- La ruta con reviver (números largos) es ~10× más lenta; hoy solo se usa si hay números de más de 15 dígitos.
- `text/plain` se parsea entero en el detector, sin límite de tamaño (el detector no puede crecer).
- La vista Raw de documentos enormes no está virtualizada.
```

- [ ] **Step 4: Full verification**

Run, in order. Record each output in the report.
1. `pnpm test`: all pass.
2. `pnpm compile`: no output.
3. `pnpm build`: succeeds.
4. `pnpm test:e2e`: all pass. It takes several minutes, so use a long timeout.
5. Detector size: `wc -c .output/chrome-mv3/content-scripts/detector.js` → 4233.
6. Non-ASCII bytes in the bundles: `LC_ALL=C grep -c -P '[^\x00-\x7F]' .output/chrome-mv3/content-scripts/*.js`. Expect 0 for every file; grep prints `:0` per file.
7. Manifest permissions: `node -e "console.log(JSON.stringify(require('./.output/chrome-mv3/manifest.json').permissions))"` → `["storage","scripting"]`.

Manual checks in Edge (list them in the report as pending manual verification):
1. Hovering a date shows the right local time.
2. A swatch with transparency (`#ff000080`) looks right on light and dark themes.
3. Image tooltips on an https API page with real images.
4. A 25 MB document opens in light mode without freezing.
5. After clicking the status bar, Alt+R still toggles Raw.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/specs/2026-10-11-json-viewer-design.md docs/notes/pendientes-fase-4.md docs/notes/pendientes-fase-0-1.md docs/notes/pendientes-fase-5.md
git commit -m "docs: document rich values, light mode and the Features section"
```
