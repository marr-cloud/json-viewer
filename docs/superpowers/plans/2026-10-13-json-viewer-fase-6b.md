# JSON Viewer — Fase 6b (Exportar / importar e idiomas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let people move their configuration between browsers and use the extension in Spanish:
- **export / import** a settings file (settings, custom CSS, custom themes) from the options page, next to **Reset to defaults**;
- **English and Spanish** everywhere the extension speaks: viewer, options, scratchpad, context menu, toolbar tooltip and manifest;
- a **Language** setting (browser language / English / Español) that switches every open page live.

**Architecture:**
- **Backup (pure).** `src/settings/backup.ts` builds the export object and parses an imported file into validated settings, CSS and themes, with error codes instead of messages.
- **i18n core (`src/i18n/`).**
  - `translate.ts` is framework-free: dictionaries, `resolveLocale`, `translate`, `translateCount` (plurals through `Intl.PluralRules`) and `formatNumber`. The background imports only this.
  - `index.ts` holds the page's language in a Vue `shallowRef` and exposes `t`, `tc`, `n`, `setLocale`, `applyLocaleSetting` and `onLocaleChange`. Templates and computeds that call `t()` re-render when it changes.
  - `messages/en.ts` is the source of every key; `messages/es.ts` is typed `Record<MessageKey, string>`, so a missing key fails `pnpm compile`, and a test checks the placeholders.
  - `I18nText.vue` fills `{placeholders}` with slots, for messages with links or `<code>` inside.
- **Wiring.** The viewer session (content script, scratchpad) and the options page apply `settings.locale`; the background relabels the context menu and the toolbar tooltip from the same setting.

**Tech Stack:** WXT 0.21.4, Vue 3.5, CodeMirror 6, TypeScript, pnpm, Node 24, Vitest 5 (+ happy-dom, `wxt/testing/fake-browser`), Playwright 1.64. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-11-json-viewer-design.md`:
- §6.8 (export / import and reset at the foot of the options navigation);
- §6.7 (`locale: 'auto' | 'en' | 'es'`), §6.9 (Idiomas), §2 (stack);
- §10 Fase 6 (second half). Phase 6a (detection and input) is merged.

**How this plan was made:** every task's code was written and run on a scratch branch on 2026-10-12/13, one commit per task. The files and diffs below are taken from those commits. After each task, `pnpm compile` and `pnpm test` were green and the e2e specs named in the task passed. After the last code task: 531 unit tests and 105 e2e tests passed, and the detector was still 5444 bytes. Applying the patches in order reproduces that tree.

### Decisions that refine the spec (approved with this plan)

1. **Own dictionaries instead of `@wxt-dev/i18n`** (chosen by the user on 2026-10-12).
   - `@wxt-dev/i18n` wraps `browser.i18n`, which always follows the browser's language: the `locale` setting of §6.7 could not work with it.
   - So the UI uses typed TypeScript dictionaries (`src/i18n`), and the setting switches every page live.
   - Only the manifest's name, description and default toolbar title use `public/_locales` (`__MSG_extName__`, …). Those follow the browser's language; the background then sets the toolbar tooltip from the setting.
   - The spec's §2 and §6.9 are updated in Task 6.
2. **Message format.**
   - Flat keys (`'viewer.fold.all'`), `{name}` placeholders, plurals as `<key>.one` / `<key>.other` picked with `Intl.PluralRules`.
   - Numbers in placeholders are formatted for the language (`12,345` / `12.345`).
   - Messages that contain elements (links, `<code>`) use `<I18nText k="…">` with a slot per placeholder.
3. **Reactivity.**
   - One language per JavaScript context (options page, scratchpad, the content script's world), in a `shallowRef`.
   - Vue re-renders anything that called `t()`. Error messages built in computeds (parse errors, the filter) follow too.
   - DOM that CodeMirror builds: the search panel relabels itself through `onLocaleChange`; tooltips are built on each hover. Fold placeholders already drawn keep the old language until refolded (documented limitation).
4. **The background never loads Vue.**
   - It uses `translate(locale, …)` from `@/i18n/translate`, with the language from `backgroundLocale()` (settings, or `navigator.languages` on `auto`).
   - Modules the background imports must not import `@/i18n`:
     - `settings/shortcuts.ts` now exports message keys (`SHORTCUT_LABEL_KEYS`, `modifierHint()` returns a key);
     - `foldLevelLabel` moves from `viewer/options.ts` to `viewer/foldLevelLabel.ts`.
   - Both dictionaries make `background.js` grow from about 16 kB to about 45 kB (ASCII-escaped accents). It loads from disk once per service worker start.
5. **What stays in English.**
   - Theme validation errors and VS Code conversion warnings: technical diagnostics that quote JSON fields.
   - Engine messages: `JSON.parse` (the banner, and after "Línea N:" for NDJSON) and `jsonpath-plus`.
   - The color key names in the theme editor (`background`, `gutterForeground`, …).
6. **Settings file.**
   - Shape: `{ "format": "json-viewer-settings", "version": 1, "exportedAt", "settings", "customCss", "customThemes" }`, named `json-viewer-settings-YYYY-MM-DD.json`. Downloaded fonts are left out (§6.8); the settings keep the family name.
   - Import:
     - refuses files over 1 MB before reading them, text that is not JSON, JSON without the format marker, and versions newer than 1, each with its own message;
     - validates the settings with `validateSettings` (bad fields fall back to defaults, as for stored settings);
     - skips and counts invalid themes, themes with a built-in id and repeated ids;
     - asks for confirmation naming the file, then replaces the settings and the CSS and saves each theme (adding or overwriting by id);
     - counts themes that fail to save (storage.sync's quota) and says so in an alert.
   - Export uses what the page shows, including edits whose save is still debounced.
   - The status messages are stored as functions, so they switch language too: an imported file can change the language.
7. **Placement.** The Language select and the Export / Import / Reset buttons sit at the bottom of the options navigation, with a hint saying what the file holds. The select appears only once the settings have loaded: a choice made earlier would be overwritten by the load.
8. **Spanish wording.** Raw → "Texto", scratchpad → "Bloc de JSON", light mode → "Modo ligero", "View as JSON" → "Ver como JSON". The language names stay in their own language ("English", "Español").

## Global Constraints

- pnpm only: `pnpm test`, `pnpm compile` (`vue-tsc --noEmit`), `pnpm build`, `pnpm test:e2e`.
- The detector content script stays ≤ 8192 bytes (5444 today; this phase does not touch it).
- Keep rolldown's `asciiOnly` minify option and `chunkSizeWarningLimit: 800` in `wxt.config.ts`.
- Permissions stay `["storage", "scripting", "contextMenus"]`.
- Settings objects passed to the viewer are replaced, never mutated (its watchers are shallow).
- Code, identifiers, UI strings in `en.ts` and comments in English; Spanish only in `es.ts`, `public/_locales/es` and `docs/`. Conventional commits in English.
- The background, and every module it imports, imports `@/i18n/translate`, never `@/i18n` (which loads Vue).
- A test that depends on `auto` pins the language: the machine running it may be in any language (this one is `es-MX`).

## Review Focus

1. **A settings file whose themes overflow storage.sync's quota.** The settings and the themes that fit are saved, and an alert says how many failed. Pinned by `SettingsActions.test.ts` › "imports after confirming and reports what happened to the themes" (Task 2).
2. **Exporting right after an edit**, while the debounced save is pending: the file holds the edit. Pinned by `SettingsActions.test.ts` › "exports what is on screen, including edits not saved yet" (Task 2).
3. **A browser in a language we don't have** (French) on `auto`: English. Pinned by `translate.test.ts` › "falls back to English" (Task 2).
4. **Changing the language with the search panel open**: it relabels at once, count included. Pinned by `searchPanel.test.ts` › "relabels itself and its count when the page language changes" (Task 3).
5. **The service worker starting before the menus exist** (first install): the toolbar tooltip is still labeled and nothing throws. Pinned by `menus.test.ts` › "still labels the toolbar icon when the menus do not exist yet" (Task 5).

## File Structure

| File | Responsibility |
|---|---|
| `src/settings/backup.ts` | Export object, file name, parsing and validating an imported file (error codes, no UI text) |
| `src/i18n/translate.ts` | Locales, dictionaries, `resolveLocale`, `translate`, `translateCount`, `formatNumber` (no Vue) |
| `src/i18n/index.ts` | The page's language (Vue ref) and `t` / `tc` / `n` / `onLocaleChange` / `messageParts` |
| `src/i18n/I18nText.vue` | A message whose placeholders are filled with slots |
| `src/i18n/messages/en.ts`, `es.ts` | The dictionaries |
| `src/options/SettingsActions.vue` | Export, Import and Reset buttons with their messages |
| `src/background/locale.ts` | The background's language from the settings |
| `src/viewer/foldLevelLabel.ts` | "Show N levels", moved out of `viewer/options.ts` |
| `public/_locales/{en,es}/messages.json` | Manifest name, description and default toolbar title |
| `e2e/backup.spec.ts`, `e2e/i18n.spec.ts` | End-to-end tests for this phase |

---

### Task 1: Settings file format

**Files:**
- Create: `src/settings/backup.ts`, `src/settings/backup.test.ts`

**Interfaces:**
- Consumes: `validateSettings`, `Settings` (`src/settings/schema.ts`); `parseCompactTheme` (`src/themes/validate.ts`); `getBuiltinTheme` (`src/themes/builtin`); `isRecord` (`src/shared/guards.ts`). All unchanged.
- Produces (`src/settings/backup.ts`):
  - `BACKUP_FORMAT = 'json-viewer-settings'`, `BACKUP_VERSION = 1`, `MAX_BACKUP_BYTES = 1_000_000`;
  - `interface Backup { format; version; exportedAt: string; settings: Settings; customCss: string; customThemes: Theme[] }`;
  - `interface ImportedBackup { settings; customCss; customThemes; skippedThemes: number }`;
  - `type BackupError = 'too-large' | 'not-json' | 'not-a-backup' | 'newer-version'`;
  - `createBackup({ settings, customCss, customThemes, now }): Backup`;
  - `backupFileName(now: Date): string` (local date);
  - `parseBackup(text: string): { ok: true; backup: ImportedBackup } | { ok: false; error: BackupError }`.

- [ ] **Step 1: Write the failing test**

Create `src/settings/backup.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Theme } from '@/themes/types';
import { BACKUP_FORMAT, BACKUP_VERSION, backupFileName, createBackup, MAX_BACKUP_BYTES, parseBackup } from './backup';
import { defaultSettings, type Settings } from './schema';

const theme = (id: string): Theme => ({
  id,
  name: `Theme ${id}`,
  type: 'dark',
  source: 'custom',
  colors: { background: '#101010', foreground: '#eeeeee' },
});

const settings: Settings = { ...defaultSettings, darkThemeId: 'mine', excludedHosts: ['api.example.com'] };

describe('createBackup', () => {
  it('holds the settings, the custom CSS and the custom themes, tagged with format and version', () => {
    const backup = createBackup({
      settings,
      customCss: '.x{}',
      customThemes: [theme('mine')],
      now: new Date('2026-10-12T10:00:00Z'),
    });
    expect(backup).toEqual({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: '2026-10-12T10:00:00.000Z',
      settings,
      customCss: '.x{}',
      customThemes: [theme('mine')],
    });
  });
});

describe('backupFileName', () => {
  it('names the file after the local date', () => {
    expect(backupFileName(new Date(2026, 9, 2, 23, 59))).toBe('json-viewer-settings-2026-10-02.json');
  });
});

describe('parseBackup', () => {
  const exported = (overrides: Record<string, unknown> = {}) =>
    JSON.stringify({
      ...createBackup({ settings, customCss: '.x{}', customThemes: [theme('mine')], now: new Date(0) }),
      ...overrides,
    });

  it('reads back what createBackup wrote', () => {
    expect(parseBackup(exported())).toEqual({
      ok: true,
      backup: { settings, customCss: '.x{}', customThemes: [theme('mine')], skippedThemes: 0 },
    });
  });

  it('rejects text that is not JSON', () => {
    expect(parseBackup('{oops')).toEqual({ ok: false, error: 'not-json' });
  });

  it('rejects JSON that is not a JSON Viewer backup', () => {
    expect(parseBackup('{"theme": "x"}')).toEqual({ ok: false, error: 'not-a-backup' });
    expect(parseBackup('[1]')).toEqual({ ok: false, error: 'not-a-backup' });
    expect(parseBackup(exported({ version: 'one' }))).toEqual({ ok: false, error: 'not-a-backup' });
  });

  it('rejects a backup from a newer format version', () => {
    expect(parseBackup(exported({ version: BACKUP_VERSION + 1 }))).toEqual({ ok: false, error: 'newer-version' });
  });

  it('rejects files over the size limit before parsing them', () => {
    expect(parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1))).toEqual({ ok: false, error: 'too-large' });
  });

  it('fills invalid or missing settings with defaults, like stored settings', () => {
    const result = parseBackup(exported({ settings: { themeMode: 'sepia', viewer: { tabSize: 4 } } }));
    expect(result.ok && result.backup.settings).toEqual({
      ...defaultSettings,
      viewer: { ...defaultSettings.viewer, tabSize: 4 },
    });
  });

  it('treats a missing or non-string custom CSS as empty', () => {
    const result = parseBackup(exported({ customCss: 42 }));
    expect(result.ok && result.backup.customCss).toBe('');
  });

  it('skips invalid themes and themes that reuse a built-in id, and counts them', () => {
    const result = parseBackup(
      exported({ customThemes: [theme('mine'), { id: 'Bad Id' }, theme('dracula'), 'x', theme('other')] }),
    );
    expect(result.ok && result.backup.customThemes.map((t) => t.id)).toEqual(['mine', 'other']);
    expect(result.ok && result.backup.skippedThemes).toBe(3);
  });

  it('keeps only the first theme with a given id', () => {
    const result = parseBackup(exported({ customThemes: [theme('mine'), { ...theme('mine'), name: 'Twin' }] }));
    expect(result.ok && result.backup.customThemes).toEqual([theme('mine')]);
    expect(result.ok && result.backup.skippedThemes).toBe(1);
  });

  it('treats a missing theme list as empty', () => {
    const result = parseBackup(exported({ customThemes: undefined }));
    expect(result.ok && result.backup.customThemes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/settings/backup.test.ts`
Expected: FAIL with "Cannot find module './backup'".

- [ ] **Step 3: Implement**

Create `src/settings/backup.ts`:

```ts
import { isRecord } from '@/shared/guards';
import { getBuiltinTheme } from '@/themes/builtin';
import type { Theme } from '@/themes/types';
import { parseCompactTheme } from '@/themes/validate';
import { validateSettings, type Settings } from './schema';

export const BACKUP_FORMAT = 'json-viewer-settings';
export const BACKUP_VERSION = 1;
/** Settings, CSS and a few dozen themes are well under this; anything bigger is not a backup. */
export const MAX_BACKUP_BYTES = 1_000_000;

/** The exported file. Downloaded fonts are left out (spec 6.8): the settings keep the family name only. */
export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  settings: Settings;
  customCss: string;
  customThemes: Theme[];
}

export interface ImportedBackup {
  settings: Settings;
  customCss: string;
  customThemes: Theme[];
  /** Themes left out: invalid, a built-in id, or an id seen earlier in the file. */
  skippedThemes: number;
}

export type BackupError = 'too-large' | 'not-json' | 'not-a-backup' | 'newer-version';

export type BackupParse = { ok: true; backup: ImportedBackup } | { ok: false; error: BackupError };

export function createBackup(input: {
  settings: Settings;
  customCss: string;
  customThemes: Theme[];
  now: Date;
}): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: input.now.toISOString(),
    settings: input.settings,
    customCss: input.customCss,
    customThemes: input.customThemes,
  };
}

/** `json-viewer-settings-YYYY-MM-DD.json`, in local time. */
export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `json-viewer-settings-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

function readThemes(input: unknown): { themes: Theme[]; skipped: number } {
  const themes: Theme[] = [];
  let skipped = 0;
  for (const item of Array.isArray(input) ? input : []) {
    const result = parseCompactTheme(item);
    if (!result.ok || getBuiltinTheme(result.theme.id) || themes.some((t) => t.id === result.theme.id)) skipped++;
    else themes.push(result.theme);
  }
  return { themes, skipped };
}

/** Reads an exported file. Settings are validated like stored ones: bad fields fall back to their defaults. */
export function parseBackup(text: string): BackupParse {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: 'too-large' };
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not-json' };
  }
  if (!isRecord(input) || input.format !== BACKUP_FORMAT || !Number.isInteger(input.version)) {
    return { ok: false, error: 'not-a-backup' };
  }
  if ((input.version as number) > BACKUP_VERSION) return { ok: false, error: 'newer-version' };
  const { themes, skipped } = readThemes(input.customThemes);
  return {
    ok: true,
    backup: {
      settings: validateSettings(input.settings),
      customCss: typeof input.customCss === 'string' ? input.customCss : '',
      customThemes: themes,
      skippedThemes: skipped,
    },
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm exec vitest run src/settings/backup.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Full checks and commit**

Run: `pnpm compile` and `pnpm test`.
Expected: both green, 499 unit tests.

```bash
git add src/settings/backup.ts src/settings/backup.test.ts
git commit -m "feat(settings): add the settings file format for export and import"
```

---

### Task 2: i18n core, Language setting, export / import in the options page

**Files:**
- Create: `src/i18n/translate.ts`, `src/i18n/index.ts`, `src/i18n/I18nText.vue`, `src/i18n/messages/en.ts`, `src/i18n/messages/es.ts`, `src/i18n/translate.test.ts`, `src/i18n/index.test.ts`, `src/options/SettingsActions.vue`, `src/options/SettingsActions.test.ts`, `e2e/backup.spec.ts`, `e2e/i18n.spec.ts`
- Modify: `src/settings/schema.ts`, `src/settings/schema.test.ts`, `src/viewer/session.ts`, `src/viewer/session.test.ts`, `src/entrypoints/options/App.vue`, `src/options/sections/AboutSection.vue`, `src/options/options.css`, `e2e/themes.spec.ts`

**Interfaces:**
- Consumes: everything from Task 1; `SettingsModel` and `useSettings` (`src/options/useSettings.ts`, unchanged); `saveCustomTheme` (`src/themes/store.ts`); `downloadText` (`src/viewer/download.ts`).
- Produces:
  - `src/i18n/translate.ts`: `LOCALES = ['en', 'es']`, `type Locale`, `type LocaleSetting = 'auto' | Locale`, `type MessageKey = keyof typeof en`, `type Messages`, `type PluralKey`, `type Params`, `resolveLocale(setting, languages)`, `translate(locale, key, params?)`, `translateCount(locale, pluralKey, count, params?)`, `formatNumber(locale, value)`.
  - `src/i18n/index.ts`: `getLocale()`, `setLocale(locale)`, `onLocaleChange(callback): () => void`, `applyLocaleSetting(setting, languages = navigator.languages): Locale`, `t(key, params?)`, `tc(pluralKey, count, params?)`, `n(value)`, `messageParts(message)`, and re-exports of the types.
  - `src/i18n/I18nText.vue`: prop `k: MessageKey`; one named slot per placeholder.
  - `Settings.locale: LocaleSetting` (default `'auto'`).
  - `createViewerSession` now applies `settings.locale` to the page and follows it.
  - `src/options/SettingsActions.vue`: props `model: SettingsModel`, `customThemes: Theme[]`.
  - Later tasks add keys to both dictionaries; every key exists in both, with the same placeholders.

- [ ] **Step 1: Write the failing tests**

Create `src/i18n/translate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { en } from './messages/en';
import { es } from './messages/es';
import { formatNumber, resolveLocale, translate, translateCount } from './translate';

describe('resolveLocale', () => {
  it('uses the chosen language', () => {
    expect(resolveLocale('es', ['en-US'])).toBe('es');
    expect(resolveLocale('en', ['es-MX'])).toBe('en');
  });

  it('follows the browser on auto: the first supported language wins', () => {
    expect(resolveLocale('auto', ['es-419', 'en'])).toBe('es');
    expect(resolveLocale('auto', ['fr-FR', 'ES', 'en'])).toBe('es');
    expect(resolveLocale('auto', ['en-GB', 'es'])).toBe('en');
  });

  it('falls back to English', () => {
    expect(resolveLocale('auto', ['fr', 'de'])).toBe('en');
    expect(resolveLocale('auto', [])).toBe('en');
  });
});

describe('translate', () => {
  it('looks the key up in the language', () => {
    expect(translate('en', 'options.section.appearance')).toBe('Appearance');
    expect(translate('es', 'options.section.appearance')).toBe('Apariencia');
  });

  it('fills {placeholders}, leaving unknown ones as they are', () => {
    expect(translate('en', 'options.about.version', { version: '1.2.3' })).toBe('JSON Viewer 1.2.3');
    expect(translate('en', 'options.about.version')).toBe('JSON Viewer {version}');
  });
});

describe('translateCount', () => {
  it('picks the plural form and formats the count for the language', () => {
    expect(translateCount('en', 'options.backup.themesSkipped', 1)).toBe('1 theme in the file was left out.');
    expect(translateCount('en', 'options.backup.themesSkipped', 1200)).toBe(
      '1,200 themes in the file were left out.',
    );
    expect(translateCount('es', 'options.backup.themesSkipped', 1)).toBe('Se omitió 1 tema del archivo.');
    expect(translateCount('es', 'options.backup.themesSkipped', 12000)).toBe('Se omitieron 12.000 temas del archivo.');
  });
});

describe('formatNumber', () => {
  it('groups digits the way the language does', () => {
    expect(formatNumber('en', 1234567)).toBe('1,234,567');
    expect(formatNumber('es', 1234567)).toBe('1.234.567');
  });
});

describe('the dictionaries', () => {
  const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

  it('have the same keys', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  it('use the same placeholders in both languages', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(es[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it('give every plural an "other" form', () => {
    for (const key of Object.keys(en)) {
      if (key.endsWith('.one')) expect(Object.keys(en), key).toContain(`${key.slice(0, -4)}.other`);
    }
  });
});
```

Create `src/i18n/index.test.ts`:

```ts
// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { applyLocaleSetting, getLocale, messageParts, n, setLocale, t, tc } from '.';
import I18nText from './I18nText.vue';

let app: App | undefined;

afterEach(() => {
  app?.unmount();
  app = undefined;
  document.body.innerHTML = '';
  setLocale('en');
});

function mount(render: () => ReturnType<typeof h>): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  app = createApp({ render });
  app.mount(host);
  return host;
}

describe('the page language', () => {
  it('starts in English and translates in the language set', () => {
    expect(t('options.section.sites')).toBe('Sites');
    setLocale('es');
    expect(getLocale()).toBe('es');
    expect(t('options.section.sites')).toBe('Sitios');
    expect(tc('options.backup.themesSkipped', 2)).toBe('Se omitieron 2 temas del archivo.');
    expect(n(12345)).toBe('12.345');
  });

  it('applies the setting, following the browser on auto', () => {
    expect(applyLocaleSetting('auto', ['es-ES'])).toBe('es');
    expect(getLocale()).toBe('es');
    expect(applyLocaleSetting('en', ['es-ES'])).toBe('en');
    expect(getLocale()).toBe('en');
  });

  it('re-renders components when it changes', async () => {
    const host = mount(() => h('p', t('options.section.about')));
    expect(host.textContent).toBe('About');
    setLocale('es');
    await nextTick();
    expect(host.textContent).toBe('Acerca de');
  });
});

describe('messageParts', () => {
  it('splits a message at its placeholders', () => {
    expect(messageParts('Inspired by {link}.')).toEqual([{ text: 'Inspired by ' }, { slot: 'link' }, { text: '.' }]);
    expect(messageParts('{a}{b}')).toEqual([{ slot: 'a' }, { slot: 'b' }]);
    expect(messageParts('plain')).toEqual([{ text: 'plain' }]);
  });
});

describe('I18nText', () => {
  it('puts the slots in the placeholders, in the current language', async () => {
    const host = mount(() =>
      h(I18nText, { k: 'options.about.inspired' }, { link: () => h('a', { href: 'https://x.test' }, 'tulios') }),
    );
    expect(host.innerHTML).toBe('Inspired by <a href="https://x.test">tulios</a>.');
    setLocale('es');
    await nextTick();
    expect(host.innerHTML).toBe('Inspirado en <a href="https://x.test">tulios</a>.');
  });
});
```

Create `src/options/SettingsActions.test.ts`:

```ts
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref, type App } from 'vue';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { BACKUP_FORMAT, MAX_BACKUP_BYTES } from '@/settings/backup';
import { defaultSettings, type Settings } from '@/settings/schema';
import type { Theme } from '@/themes/types';
import SettingsActions from './SettingsActions.vue';
import type { SettingsModel } from './useSettings';

const saveCustomTheme = vi.hoisted(() => vi.fn());
// happy-dom has no window.confirm.
const confirm = vi.fn<(message?: string) => boolean>();
vi.mock('@/themes/store', async (original) => ({ ...(await original<object>()), saveCustomTheme }));

const theme = (id: string): Theme => ({
  id,
  name: id,
  type: 'dark',
  source: 'custom',
  colors: { background: '#101010', foreground: '#eeeeee' },
});

let app: App | undefined;

function mount(customThemes: Theme[] = []) {
  const model: SettingsModel = {
    settings: ref<Settings>(structuredClone(defaultSettings)),
    customCss: ref(''),
    loaded: ref(true),
    reset: vi.fn(),
  };
  const host = document.createElement('div');
  document.body.append(host);
  app = createApp({ render: () => h(SettingsActions, { model, customThemes }) });
  app.mount(host);
  return { host, model };
}

/** Picks `file` in the hidden input, as the Import button's file chooser would. */
async function pick(host: HTMLElement, file: File): Promise<void> {
  const input = host.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
  // file.text(), the confirm and the theme saves are all awaited in turn.
  await vi.waitFor(() => expect(host.querySelector('[role=status], [role=alert]')).not.toBeNull());
  await nextTick();
}

const backupFile = (content: unknown, name = 'backup.json') =>
  new File([typeof content === 'string' ? content : JSON.stringify(content)], name, { type: 'application/json' });

const texts = (host: HTMLElement, role: string) =>
  [...host.querySelectorAll(`[role=${role}]`)].map((element) => element.textContent);

beforeEach(() => {
  fakeBrowser.reset();
  saveCustomTheme.mockReset().mockResolvedValue(undefined);
  confirm.mockReset().mockReturnValue(true);
  vi.stubGlobal('confirm', confirm);
});

afterEach(() => {
  app?.unmount();
  app = undefined;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SettingsActions', () => {
  it('exports what is on screen, including edits not saved yet', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    let link: HTMLAnchorElement | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      link = this;
    });
    const blobs: Blob[] = [];
    const original = globalThis.Blob;
    vi.spyOn(globalThis, 'Blob').mockImplementation(function (parts?: BlobPart[], options?: BlobPropertyBag) {
      const blob = new original(parts, options);
      blobs.push(blob);
      return blob;
    } as never);
    const { host, model } = mount([theme('mine')]);
    model.settings.value.viewer.tabSize = 7;
    host.querySelector<HTMLButtonElement>('button')!.click();
    expect(link?.download).toMatch(/^json-viewer-settings-\d{4}-\d{2}-\d{2}\.json$/);
    return blobs[0]!.text().then((text) => {
      expect(JSON.parse(text)).toMatchObject({
        format: BACKUP_FORMAT,
        settings: { viewer: { tabSize: 7 } },
        customThemes: [theme('mine')],
      });
    });
  });

  it('imports after confirming and reports what happened to the themes', async () => {
    saveCustomTheme.mockImplementation(async (saved: Theme) => {
      if (saved.id === 'big') throw new Error('QUOTA_BYTES quota exceeded');
    });
    const { host, model } = mount();
    await pick(
      host,
      backupFile({
        format: BACKUP_FORMAT,
        version: 1,
        settings: { locale: 'es', viewer: { tabSize: 3 } },
        customCss: 'b{}',
        customThemes: [theme('mine'), theme('big'), { id: 'Bad' }],
      }),
    );
    expect(confirm).toHaveBeenCalledWith(
      'Replace your settings with the ones in “backup.json”? Custom themes in the file are added to yours.',
    );
    expect(model.settings.value.viewer.tabSize).toBe(3);
    expect(model.customCss.value).toBe('b{}');
    expect(saveCustomTheme.mock.calls.map(([saved]) => (saved as Theme).id)).toEqual(['mine', 'big']);
    expect(texts(host, 'status')).toEqual([
      'Settings imported from “backup.json”.',
      '1 custom theme added or updated.',
      '1 theme in the file was left out.',
    ]);
    expect(texts(host, 'alert')).toEqual(['1 theme could not be saved: storage is full.']);
  });

  it('changes nothing when the confirmation is declined', async () => {
    confirm.mockReturnValue(false);
    const { host, model } = mount();
    const input = host.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', { value: [backupFile({ format: BACKUP_FORMAT, version: 1, settings: { viewer: { tabSize: 3 } } })] });
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(confirm).toHaveBeenCalled());
    await nextTick();
    expect(model.settings.value.viewer.tabSize).toBe(defaultSettings.viewer.tabSize);
    expect(saveCustomTheme).not.toHaveBeenCalled();
  });

  it('refuses a file over the size limit without reading it', async () => {
    const { host } = mount();
    const file = backupFile('{}');
    Object.defineProperty(file, 'size', { value: MAX_BACKUP_BYTES + 1 });
    const read = vi.spyOn(file, 'text');
    await pick(host, file);
    expect(texts(host, 'alert')).toEqual(['That file is too big to be a JSON Viewer settings file.']);
    expect(read).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('resets after confirming', () => {
    const { host, model } = mount();
    [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Reset'))!.click();
    expect(model.reset).toHaveBeenCalledOnce();
  });
});
```

Apply to `src/settings/schema.test.ts`:

```diff
diff --git a/src/settings/schema.test.ts b/src/settings/schema.test.ts
index e2480f2..538cbe6 100644
--- a/src/settings/schema.test.ts
+++ b/src/settings/schema.test.ts
@@ -35,6 +35,7 @@ describe('validateSettings', () => {
       shortcuts: defaultShortcuts,
       features: defaultFeatures,
       excludedHosts: [],
+      locale: 'auto',
     });
   });
 
@@ -48,6 +49,7 @@ describe('validateSettings', () => {
       shortcuts: { ...defaultShortcuts, toggleRaw: 'Ctrl+Alt+R' },
       features: { ...defaultFeatures, imagePreview: false },
       excludedHosts: ['api.example.com', '*.internal.test'],
+      locale: 'es',
     };
     expect(validateSettings(input)).toEqual(input);
   });
@@ -69,6 +71,7 @@ describe('validateSettings', () => {
       shortcuts: defaultShortcuts,
       features: defaultFeatures,
       excludedHosts: [],
+      locale: 'auto',
     });
   });
 
@@ -77,6 +80,12 @@ describe('validateSettings', () => {
     expect(validateSettings({ excludedHosts: 'a.com' }).excludedHosts).toEqual([]);
   });
 
+  it('accepts auto, en and es as the language', () => {
+    expect(validateSettings({ locale: 'en' }).locale).toBe('en');
+    expect(validateSettings({ locale: 'fr' }).locale).toBe('auto');
+    expect(validateSettings({ locale: 1 }).locale).toBe('auto');
+  });
+
   it('validates the features one by one', () => {
     const result = validateSettings({ features: { colorSwatches: false, imagePreview: 'no', extra: true } });
     expect(result.features).toEqual({ ...defaultFeatures, colorSwatches: false });
```

Apply to `src/viewer/session.test.ts`:

```diff
diff --git a/src/viewer/session.test.ts b/src/viewer/session.test.ts
index cbf57ae..fe23134 100644
--- a/src/viewer/session.test.ts
+++ b/src/viewer/session.test.ts
@@ -1,6 +1,7 @@
 // @vitest-environment happy-dom
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
 import { fakeBrowser } from 'wxt/testing/fake-browser';
+import { getLocale, setLocale } from '@/i18n';
 import { createViewerSession, type ViewerSession } from './session';
 
 /** A MediaQueryList whose `matches` the test flips. */
@@ -25,6 +26,7 @@ describe('createViewerSession', () => {
   afterEach(() => {
     session?.stop();
     session = undefined;
+    setLocale('en');
   });
 
   const open = async (media = fakeMedia(false)) => {
@@ -59,6 +61,14 @@ describe('createViewerSession', () => {
     expect(session.kind.value).toBe('dark');
   });
 
+  it('sets the page language from the settings and follows changes', async () => {
+    await fakeBrowser.storage.sync.set({ settings: { locale: 'es' } });
+    await open();
+    expect(getLocale()).toBe('es');
+    await fakeBrowser.storage.sync.set({ settings: { locale: 'en' } });
+    await vi.waitFor(() => expect(getLocale()).toBe('en'));
+  });
+
   it('stops listening when stopped', async () => {
     const { session, media } = await open();
     expect(media.listeners.size).toBe(1);
```

Create `e2e/backup.spec.ts`:

```ts
import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { getStorage, setStorage } from './storage';

const theme = {
  id: 'my-night',
  name: 'My Night',
  type: 'dark',
  source: 'custom',
  colors: { background: '#101010', foreground: '#eeeeee' },
};

async function openOptions(page: Page, extensionId: string): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByRole('heading', { name: 'Behavior' })).toBeVisible();
}

/** Picks `files` in the file chooser that the Import settings button opens. */
async function importFile(page: Page, files: ReturnType<typeof file>): Promise<void> {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Import settings' }).click(),
  ]);
  await chooser.setFiles(files);
}

const file = (name: string, content: unknown) => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from(typeof content === 'string' ? content : JSON.stringify(content)),
});

test('exports the settings, custom CSS and custom themes to a file', async ({ context, extensionId }) => {
  await setStorage(context, 'sync', {
    settings: { viewer: { sortKeys: true } },
    customThemeIds: [theme.id],
    [`customTheme:${theme.id}`]: theme,
  });
  await setStorage(context, 'local', { customCss: '.cm-editor { color: red }' });
  const options = await context.newPage();
  await openOptions(options, extensionId);
  const [download] = await Promise.all([
    options.waitForEvent('download'),
    options.getByRole('button', { name: 'Export settings' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^json-viewer-settings-\d{4}-\d{2}-\d{2}\.json$/);
  const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(backup).toMatchObject({
    format: 'json-viewer-settings',
    version: 1,
    settings: { viewer: { sortKeys: true } },
    customCss: '.cm-editor { color: red }',
    customThemes: [theme],
  });
});

test('imports a settings file after confirming', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  options.once('dialog', (dialog) => void dialog.accept());
  await importFile(
    options,
    file('mine.json', {
      format: 'json-viewer-settings',
      version: 1,
      settings: { viewer: { tabSize: 4 }, darkThemeId: theme.id },
      customCss: 'body { margin: 0 }',
      customThemes: [theme, { id: 'Bad Id' }],
    }),
  );
  await expect(options.getByRole('status').first()).toHaveText('Settings imported from “mine.json”.');
  await expect(options.getByRole('status').nth(1)).toHaveText('1 custom theme added or updated.');
  await expect(options.getByRole('status').nth(2)).toHaveText('1 theme in the file was left out.');
  await expect(options.getByLabel('Indent size')).toHaveValue('4');
  await expect
    .poll(() => getStorage(context, 'sync', 'settings'))
    .toMatchObject({ viewer: { tabSize: 4 }, darkThemeId: theme.id });
  await expect.poll(() => getStorage(context, 'local', 'customCss')).toBe('body { margin: 0 }');
  expect(await getStorage(context, 'sync', `customTheme:${theme.id}`)).toEqual(theme);
});

test('says why a file cannot be imported and changes nothing', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await openOptions(options, extensionId);
  let asked = false;
  options.on('dialog', (dialog) => {
    asked = true;
    void dialog.dismiss();
  });
  await importFile(options, file('theme.json', theme));
  await expect(options.getByRole('alert')).toHaveText('That file is not a JSON Viewer settings file.');
  await importFile(options, file('broken.json', '{oops'));
  await expect(options.getByRole('alert')).toHaveText('That file is not valid JSON.');
  expect(asked).toBe(false);
  expect(await getStorage(context, 'sync', 'settings')).toBeUndefined();
});
```

Create `e2e/i18n.spec.ts`:

```ts
import { expect, test } from './fixtures';
import { getStorage } from './storage';

test('the options page switches language live and saves the choice', async ({ context, extensionId }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(options.getByRole('heading', { name: 'Appearance' })).toBeVisible();
  await options.getByLabel('Language').selectOption('es');
  await expect(options.getByRole('link', { name: 'Apariencia' })).toBeVisible();
  await expect(options.locator('html')).toHaveAttribute('lang', 'es');
  await expect(options).toHaveTitle('Configuración de JSON Viewer');
  await expect.poll(() => getStorage(context, 'sync', 'settings')).toMatchObject({ locale: 'es' });
  await options.getByLabel('Idioma').selectOption('auto');
  await expect(options.getByRole('link', { name: 'Appearance' })).toBeVisible();
});
```

The new **Import settings** button also matches `getByRole('button', { name: 'Import' })` in the theme tests, so they ask for the exact name. Apply to `e2e/themes.spec.ts`:

```diff
diff --git a/e2e/themes.spec.ts b/e2e/themes.spec.ts
index d1f4468..52ecd1b 100644
--- a/e2e/themes.spec.ts
+++ b/e2e/themes.spec.ts
@@ -28,7 +28,7 @@ test('imports a pasted VS Code theme and uses it', async ({ context, server, ext
   await openOptions(options, extensionId);
   await options.getByLabel('Theme mode').selectOption('dark');
   await options.getByLabel('VS Code theme JSON').fill(VSCODE_THEME);
-  await options.getByRole('button', { name: 'Import' }).click();
+  await options.getByRole('button', { name: 'Import', exact: true }).click();
   await expect(options.locator('p.opt-success')).toContainText('Imported “Test Night” as a dark theme.');
   await expect(options.getByLabel('Dark theme')).toHaveValue('test-night');
   await expect.poll(() => getStorage(context, 'sync', 'settings')).toMatchObject({ darkThemeId: 'test-night' });
@@ -42,7 +42,7 @@ test('reports invalid theme files', async ({ context, extensionId }) => {
   const options = await context.newPage();
   await openOptions(options, extensionId);
   await options.getByLabel('VS Code theme JSON').fill('{"colors": ');
-  await options.getByRole('button', { name: 'Import' }).click();
+  await options.getByRole('button', { name: 'Import', exact: true }).click();
   await expect(options.getByRole('alert')).toContainText('Invalid JSON');
 });
 
@@ -61,7 +61,7 @@ test('deletes a custom theme and falls back to the default', async ({ context, e
   const options = await context.newPage();
   await openOptions(options, extensionId);
   await options.getByLabel('VS Code theme JSON').fill(VSCODE_THEME);
-  await options.getByRole('button', { name: 'Import' }).click();
+  await options.getByRole('button', { name: 'Import', exact: true }).click();
   await expect(options.getByLabel('Dark theme')).toHaveValue('test-night');
   options.once('dialog', (dialog) => void dialog.accept());
   await options.getByRole('button', { name: 'Delete Test Night' }).click();
@@ -147,7 +147,7 @@ test('exports a custom theme as compact JSON', async ({ context, extensionId })
   const options = await context.newPage();
   await openOptions(options, extensionId);
   await options.getByLabel('VS Code theme JSON').fill(VSCODE_THEME);
-  await options.getByRole('button', { name: 'Import' }).click();
+  await options.getByRole('button', { name: 'Import', exact: true }).click();
   const [download] = await Promise.all([
     options.waitForEvent('download'),
     options.getByRole('button', { name: 'Export Test Night' }).click(),
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `pnpm exec vitest run src/i18n src/options/SettingsActions.test.ts src/settings/schema.test.ts src/viewer/session.test.ts`
Expected: FAIL. `./translate`, `.` (`src/i18n`) and `./SettingsActions.vue` cannot be resolved; the schema tests miss `locale`; the session test sees the language stay `en`.

- [ ] **Step 3: Implement**

Create `src/i18n/messages/en.ts`:

```ts
// English messages: the source of every key. es.ts must have the same keys and {placeholders}.
// Plurals use `.one` / `.other` suffixes (Intl.PluralRules); `{count}` is filled in for them.
export const en = {
  'options.title': 'JSON Viewer Settings',
  'options.nav.label': 'Sections',
  'options.section.appearance': 'Appearance',
  'options.section.fonts': 'Fonts',
  'options.section.behavior': 'Behavior',
  'options.section.structure': 'Structure',
  'options.section.features': 'Features',
  'options.section.shortcuts': 'Shortcuts',
  'options.section.sites': 'Sites',
  'options.section.advanced': 'Advanced',
  'options.section.about': 'About',
  'options.preview.label': 'Live preview',

  'options.language.label': 'Language',
  'options.language.auto': 'Browser language',

  'options.reset.button': 'Reset to defaults',
  'options.reset.confirm': 'Reset all settings to their defaults? Custom themes are kept.',

  'options.backup.export': 'Export settings',
  'options.backup.import': 'Import settings',
  'options.backup.confirm': 'Replace your settings with the ones in “{file}”? Custom themes in the file are added to yours.',
  'options.backup.imported': 'Settings imported from “{file}”.',
  'options.backup.themesSaved.one': '{count} custom theme added or updated.',
  'options.backup.themesSaved.other': '{count} custom themes added or updated.',
  'options.backup.themesSkipped.one': '{count} theme in the file was left out.',
  'options.backup.themesSkipped.other': '{count} themes in the file were left out.',
  'options.backup.themesFailed.one': '{count} theme could not be saved: storage is full.',
  'options.backup.themesFailed.other': '{count} themes could not be saved: storage is full.',
  'options.backup.error.tooLarge': 'That file is too big to be a JSON Viewer settings file.',
  'options.backup.error.notJson': 'That file is not valid JSON.',
  'options.backup.error.notABackup': 'That file is not a JSON Viewer settings file.',
  'options.backup.error.newerVersion':
    'That file comes from a newer version of JSON Viewer. Update the extension and try again.',
  'options.backup.error.unreadable': 'The file could not be read.',
  'options.backup.hint': 'The file holds your settings, custom CSS and custom themes. Downloaded fonts are not included.',

  'options.about.version': 'JSON Viewer {version}',
  'options.about.inspired': 'Inspired by {link}.',
  'options.about.licenses': 'Built-in themes are converted from VS Code themes via tm-themes; see their {link}.',
  'options.about.licensesLink': 'licenses',
} as const;
```

Create `src/i18n/messages/es.ts`:

```ts
import type { Messages } from '../translate';

export const es: Messages = {
  'options.title': 'Configuración de JSON Viewer',
  'options.nav.label': 'Secciones',
  'options.section.appearance': 'Apariencia',
  'options.section.fonts': 'Fuentes',
  'options.section.behavior': 'Comportamiento',
  'options.section.structure': 'Estructura',
  'options.section.features': 'Funciones',
  'options.section.shortcuts': 'Atajos',
  'options.section.sites': 'Sitios',
  'options.section.advanced': 'Avanzado',
  'options.section.about': 'Acerca de',
  'options.preview.label': 'Vista previa',

  'options.language.label': 'Idioma',
  'options.language.auto': 'Idioma del navegador',

  'options.reset.button': 'Restablecer valores',
  'options.reset.confirm': '¿Restablecer todos los ajustes a sus valores por defecto? Los temas personalizados se conservan.',

  'options.backup.export': 'Exportar configuración',
  'options.backup.import': 'Importar configuración',
  'options.backup.confirm':
    '¿Reemplazar tu configuración por la de «{file}»? Los temas personalizados del archivo se añaden a los tuyos.',
  'options.backup.imported': 'Configuración importada de «{file}».',
  'options.backup.themesSaved.one': 'Se añadió o actualizó {count} tema personalizado.',
  'options.backup.themesSaved.other': 'Se añadieron o actualizaron {count} temas personalizados.',
  'options.backup.themesSkipped.one': 'Se omitió {count} tema del archivo.',
  'options.backup.themesSkipped.other': 'Se omitieron {count} temas del archivo.',
  'options.backup.themesFailed.one': 'No se pudo guardar {count} tema: el almacenamiento está lleno.',
  'options.backup.themesFailed.other': 'No se pudieron guardar {count} temas: el almacenamiento está lleno.',
  'options.backup.error.tooLarge': 'Ese archivo es demasiado grande para ser una configuración de JSON Viewer.',
  'options.backup.error.notJson': 'Ese archivo no es JSON válido.',
  'options.backup.error.notABackup': 'Ese archivo no es una configuración de JSON Viewer.',
  'options.backup.error.newerVersion':
    'Ese archivo viene de una versión más nueva de JSON Viewer. Actualiza la extensión y vuelve a intentarlo.',
  'options.backup.error.unreadable': 'No se pudo leer el archivo.',
  'options.backup.hint':
    'El archivo guarda tus ajustes, el CSS propio y los temas personalizados. No incluye las fuentes descargadas.',

  'options.about.version': 'JSON Viewer {version}',
  'options.about.inspired': 'Inspirado en {link}.',
  'options.about.licenses': 'Los temas incluidos se convierten desde temas de VS Code con tm-themes; consulta sus {link}.',
  'options.about.licensesLink': 'licencias',
};
```

Create `src/i18n/translate.ts`:

```ts
import { en } from './messages/en';
import { es } from './messages/es';

export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export type LocaleSetting = 'auto' | Locale;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
/** Keys with plural forms (`<key>.one`, `<key>.other`), named without the form. */
export type PluralKey = { [K in MessageKey]: K extends `${infer Base}.other` ? Base : never }[MessageKey];
export type Params = Record<string, string | number>;

const dictionaries: Record<Locale, Messages> = { en, es };

/** The language to show: the chosen one, or on `auto` the first of the browser's languages we have. */
export function resolveLocale(setting: LocaleSetting, languages: readonly string[]): Locale {
  if (setting !== 'auto') return setting;
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0] ?? '';
    if ((LOCALES as readonly string[]).includes(base)) return base as Locale;
  }
  return 'en';
}

export function formatNumber(locale: Locale, value: number): string {
  return value.toLocaleString(locale);
}

function fill(locale: Locale, text: string, params: Params | undefined): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    if (value === undefined) return placeholder;
    return typeof value === 'number' ? formatNumber(locale, value) : value;
  });
}

export function translate(locale: Locale, key: MessageKey, params?: Params): string {
  return fill(locale, dictionaries[locale][key], params);
}

/** The plural form of `key` for `count`, with `{count}` filled in. */
export function translateCount(locale: Locale, key: PluralKey, count: number, params?: Params): string {
  const form = new Intl.PluralRules(locale).select(count);
  const messages = dictionaries[locale] as Record<string, string>;
  const text = messages[`${key}.${form}`] ?? messages[`${key}.other`] ?? key;
  return fill(locale, text, { ...params, count });
}
```

Create `src/i18n/index.ts`:

```ts
import { shallowRef } from 'vue';
import {
  formatNumber,
  resolveLocale,
  translate,
  translateCount,
  type Locale,
  type LocaleSetting,
  type MessageKey,
  type Params,
  type PluralKey,
} from './translate';

export type { Locale, LocaleSetting, MessageKey, PluralKey } from './translate';
export { LOCALES } from './translate';

// One language per page (options, scratchpad, the content script's world). A ref, so templates and computeds
// that call t() update when it changes.
const current = shallowRef<Locale>('en');

export function getLocale(): Locale {
  return current.value;
}

export function setLocale(locale: Locale): void {
  current.value = locale;
}

/** Sets the page's language from the setting (`auto` follows the browser) and returns it. */
export function applyLocaleSetting(setting: LocaleSetting, languages: readonly string[] = navigator.languages): Locale {
  const locale = resolveLocale(setting, languages);
  setLocale(locale);
  return locale;
}

export function t(key: MessageKey, params?: Params): string {
  return translate(current.value, key, params);
}

/** Plural message for `count` (see translateCount). */
export function tc(key: PluralKey, count: number, params?: Params): string {
  return translateCount(current.value, key, count, params);
}

export function n(value: number): string {
  return formatNumber(current.value, value);
}

export type MessagePart = { text: string } | { slot: string };

/** Splits a message at its {placeholders}, so a template can put elements (links) in them. */
export function messageParts(message: string): MessagePart[] {
  const parts: MessagePart[] = [];
  let last = 0;
  for (const match of message.matchAll(/\{(\w+)\}/g)) {
    if (match.index > last) parts.push({ text: message.slice(last, match.index) });
    parts.push({ slot: match[1] ?? '' });
    last = match.index + match[0].length;
  }
  if (last < message.length) parts.push({ text: message.slice(last) });
  return parts;
}
```

Create `src/i18n/I18nText.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { messageParts, t, type MessageKey } from '.';

// A message whose {placeholders} are filled with the named slots: <I18nText k="..."><template #link>…</template></I18nText>
const props = defineProps<{ k: MessageKey }>();
const parts = computed(() => messageParts(t(props.k)));
</script>

<template>
  <template v-for="(part, index) in parts" :key="index">
    <template v-if="'slot' in part"><slot :name="part.slot" /></template>
    <template v-else>{{ part.text }}</template>
  </template>
</template>
```

Apply to `src/settings/schema.ts`:

```diff
diff --git a/src/settings/schema.ts b/src/settings/schema.ts
index 6a658c9..946c790 100644
--- a/src/settings/schema.ts
+++ b/src/settings/schema.ts
@@ -1,6 +1,7 @@
 import { bool, intInRange, nonEmptyId, oneOf, validateFields, type ObjectValidators } from './fields';
 import { defaultFontSettings, validateFontSettings, type FontSettings } from './font';
 import { validateExcludedHosts } from './hosts';
+import type { LocaleSetting } from '@/i18n/translate';
 import { defaultShortcuts, validateShortcuts, type Shortcuts } from './shortcuts';
 import {
   defaultFeatures,
@@ -24,6 +25,8 @@ export interface Settings {
   features: Features;
   /** Host patterns where detected JSON is left alone (see hosts.ts). */
   excludedHosts: string[];
+  /** UI language; `auto` follows the browser. */
+  locale: LocaleSetting;
 }
 
 export const defaultSettings: Settings = {
@@ -35,6 +38,7 @@ export const defaultSettings: Settings = {
   shortcuts: defaultShortcuts,
   features: defaultFeatures,
   excludedHosts: [],
+  locale: 'auto',
 };
 
 export const TAB_SIZE_MIN = 1;
@@ -73,6 +77,7 @@ const settingsValidators: ObjectValidators<Settings> = {
   shortcuts: (value) => validateShortcuts(value),
   features: (value) => validateFields(value, defaultFeatures, featureValidators),
   excludedHosts: validateExcludedHosts,
+  locale: oneOf<LocaleSetting>(['auto', 'en', 'es']),
 };
 
 /** Returns complete settings; every missing or invalid field falls back to its default. */
```

Apply to `src/viewer/session.ts`:

```diff
diff --git a/src/viewer/session.ts b/src/viewer/session.ts
index 8eaf3f5..04ddd28 100644
--- a/src/viewer/session.ts
+++ b/src/viewer/session.ts
@@ -1,6 +1,7 @@
-import { computed, reactive, type ComputedRef } from 'vue';
+import { computed, reactive, watchEffect, type ComputedRef } from 'vue';
 import { createFontLoader, type FontFaceTarget } from '@/fonts/loader';
 import { trackStoredFont } from '@/fonts/track';
+import { applyLocaleSetting } from '@/i18n';
 import type { Settings } from '@/settings/schema';
 import { customCssItem, loadSettings, watchSettings } from '@/settings/storage';
 import { activeTheme, pickThemeKind, toggledKind, type ThemeKind } from '@/themes/active';
@@ -28,7 +29,7 @@ export interface ViewerSession {
 
 /**
  * Loads what a full-page viewer needs (settings, custom CSS and themes, the downloaded font) and keeps it in sync
- * with storage and the system color scheme. Used by the content script and the scratchpad.
+ * with storage and the system color scheme. It also sets the page's language from the settings. Used by the content script and the scratchpad.
  */
 export async function createViewerSession(
   fonts: FontFaceTarget,
@@ -54,6 +55,7 @@ export async function createViewerSession(
   };
   media.addEventListener('change', onMediaChange);
   const stops = [
+    watchEffect(() => applyLocaleSetting(state.settings.locale)),
     watchSettings((value) => {
       state.settings = value;
     }),
```

Create `src/options/SettingsActions.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { t, tc, type MessageKey } from '@/i18n';
import { backupFileName, createBackup, MAX_BACKUP_BYTES, parseBackup, type BackupError } from '@/settings/backup';
import { saveCustomTheme } from '@/themes/store';
import type { Theme } from '@/themes/types';
import { downloadText } from '@/viewer/download';
import type { SettingsModel } from './useSettings';

const props = defineProps<{ model: SettingsModel; customThemes: Theme[] }>();

const ERROR_KEYS: Record<BackupError, MessageKey> = {
  'too-large': 'options.backup.error.tooLarge',
  'not-json': 'options.backup.error.notJson',
  'not-a-backup': 'options.backup.error.notABackup',
  'newer-version': 'options.backup.error.newerVersion',
};

const fileInput = ref<HTMLInputElement>();
// Functions, so the messages follow a language change (an imported file can change the language).
const notes = ref<(() => string)[]>([]);
const error = ref<(() => string) | null>(null);

function exportSettings(): void {
  const now = new Date();
  const backup = createBackup({
    settings: props.model.settings.value,
    customCss: props.model.customCss.value,
    customThemes: props.customThemes,
    now,
  });
  downloadText(`${JSON.stringify(backup, null, 2)}\n`, backupFileName(now));
}

function fail(key: MessageKey): void {
  notes.value = [];
  error.value = () => t(key);
}

async function importSettings(): Promise<void> {
  const file = fileInput.value?.files?.[0];
  if (fileInput.value) fileInput.value.value = '';
  if (!file) return;
  if (file.size > MAX_BACKUP_BYTES) return fail(ERROR_KEYS['too-large']);
  let text: string;
  try {
    text = await file.text();
  } catch {
    return fail('options.backup.error.unreadable');
  }
  const result = parseBackup(text);
  if (!result.ok) return fail(ERROR_KEYS[result.error]);
  if (!window.confirm(t('options.backup.confirm', { file: file.name }))) return;

  const { settings, customCss, customThemes, skippedThemes } = result.backup;
  props.model.settings.value = settings;
  props.model.customCss.value = customCss;
  let failed = 0;
  for (const theme of customThemes) {
    try {
      await saveCustomTheme(theme);
    } catch {
      // storage.sync's quota (100 KB) is the only expected failure for a theme that already validated.
      failed++;
    }
  }
  const saved = customThemes.length - failed;
  error.value = null;
  notes.value = [
    () => t('options.backup.imported', { file: file.name }),
    ...(saved > 0 ? [() => tc('options.backup.themesSaved', saved)] : []),
    ...(skippedThemes > 0 ? [() => tc('options.backup.themesSkipped', skippedThemes)] : []),
  ];
  if (failed > 0) error.value = () => tc('options.backup.themesFailed', failed);
}

function reset(): void {
  if (window.confirm(t('options.reset.confirm'))) props.model.reset();
}
</script>

<template>
  <div class="opt-actions">
    <button type="button" :disabled="!model.loaded.value" @click="exportSettings">{{ t('options.backup.export') }}</button>
    <button type="button" :disabled="!model.loaded.value" @click="fileInput?.click()">
      {{ t('options.backup.import') }}
    </button>
    <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="importSettings" />
    <button type="button" :disabled="!model.loaded.value" @click="reset">{{ t('options.reset.button') }}</button>
    <small class="opt-hint">{{ t('options.backup.hint') }}</small>
    <p v-for="(note, index) in notes" :key="index" class="opt-hint" role="status">{{ note() }}</p>
    <p v-if="error" class="opt-hint opt-errors" role="alert">{{ error() }}</p>
  </div>
</template>
```

Apply to `src/entrypoints/options/App.vue`:

```diff
diff --git a/src/entrypoints/options/App.vue b/src/entrypoints/options/App.vue
index 6fd5acd..ca976f1 100644
--- a/src/entrypoints/options/App.vue
+++ b/src/entrypoints/options/App.vue
@@ -1,6 +1,9 @@
 <script setup lang="ts">
-import { computed, ref } from 'vue';
+import { computed, ref, watchEffect } from 'vue';
 import iconUrl from '@/assets/icon.svg';
+import { applyLocaleSetting, t } from '@/i18n';
+import SelectField from '@/options/fields/SelectField.vue';
+import SettingsActions from '@/options/SettingsActions.vue';
 import AppearanceSection from '@/options/sections/AppearanceSection.vue';
 import FontsSection from '@/options/sections/FontsSection.vue';
 import AboutSection from '@/options/sections/AboutSection.vue';
@@ -15,12 +18,25 @@ import { useCustomThemes } from '@/options/useCustomThemes';
 import { useSettings } from '@/options/useSettings';
 import ThemeEditor from '@/options/ThemeEditor.vue';
 import { builtinThemes } from '@/themes/builtin';
-import type { ThemeSlot } from '@/options/types';
+import type { SelectOption, ThemeSlot } from '@/options/types';
 import type { Theme } from '@/themes/types';
 
-const { settings, customCss, loaded, reset } = useSettings();
+const model = useSettings();
+const { settings, customCss, loaded } = model;
 const { customThemes } = useCustomThemes();
 
+watchEffect(() => {
+  document.documentElement.lang = applyLocaleSetting(settings.value.locale);
+  document.title = t('options.title');
+});
+
+// Each language is named in itself, so it can be found whatever the current one.
+const languageOptions = computed<SelectOption[]>(() => [
+  { value: 'auto', label: t('options.language.auto') },
+  { value: 'en', label: 'English' },
+  { value: 'es', label: 'Español' },
+]);
+
 const editing = ref<{ theme: Theme; isNew: boolean; slot: ThemeSlot } | null>(null);
 const previewTheme = ref<Theme | null>(null);
 const takenIds = computed(() => [...builtinThemes, ...customThemes.value].map((t) => t.id));
@@ -41,28 +57,26 @@ function onSaved(theme: Theme): void {
   else settings.value.lightThemeId = theme.id;
   stopEditing();
 }
-
-function onReset(): void {
-  if (window.confirm('Reset all settings to their defaults? Custom themes are kept.')) reset();
-}
 </script>
 
 <template>
   <div class="opt-app">
     <aside class="opt-nav">
       <h1 class="opt-title"><img :src="iconUrl" alt="" width="24" height="24" /> JSON Viewer</h1>
-      <nav aria-label="Sections">
-        <a href="#appearance">Appearance</a>
-        <a href="#fonts">Fonts</a>
-        <a href="#behavior">Behavior</a>
-        <a href="#structure">Structure</a>
-        <a href="#features">Features</a>
-        <a href="#shortcuts">Shortcuts</a>
-        <a href="#sites">Sites</a>
-        <a href="#advanced">Advanced</a>
-        <a href="#about">About</a>
+      <nav :aria-label="t('options.nav.label')">
+        <a href="#appearance">{{ t('options.section.appearance') }}</a>
+        <a href="#fonts">{{ t('options.section.fonts') }}</a>
+        <a href="#behavior">{{ t('options.section.behavior') }}</a>
+        <a href="#structure">{{ t('options.section.structure') }}</a>
+        <a href="#features">{{ t('options.section.features') }}</a>
+        <a href="#shortcuts">{{ t('options.section.shortcuts') }}</a>
+        <a href="#sites">{{ t('options.section.sites') }}</a>
+        <a href="#advanced">{{ t('options.section.advanced') }}</a>
+        <a href="#about">{{ t('options.section.about') }}</a>
       </nav>
-      <button type="button" class="opt-reset" @click="onReset">Reset to defaults</button>
+      <!-- Only once loaded: a choice made earlier would be overwritten by the stored settings. -->
+      <SelectField v-if="loaded" v-model="settings.locale" :label="t('options.language.label')" :options="languageOptions" />
+      <SettingsActions :model="model" :custom-themes="customThemes" />
     </aside>
     <main v-if="loaded" class="opt-main">
       <AppearanceSection :settings="settings" :custom-themes="customThemes" :editing="editing !== null" @edit="startEditing" />
@@ -85,7 +99,7 @@ function onReset(): void {
       <AdvancedSection v-model:custom-css="customCss" />
       <AboutSection />
     </main>
-    <section class="opt-preview" aria-label="Live preview">
+    <section class="opt-preview" :aria-label="t('options.preview.label')">
       <PreviewPane :settings="settings" :custom-css="customCss" :custom-themes="customThemes" :theme-override="previewTheme" />
     </section>
   </div>
```

Replace `src/options/sections/AboutSection.vue` with:

```vue
<script setup lang="ts">
import { browser } from 'wxt/browser';
import { t } from '@/i18n';
import I18nText from '@/i18n/I18nText.vue';

const version = browser.runtime.getManifest().version;
</script>

<template>
  <section id="about" class="opt-section">
    <h2>{{ t('options.section.about') }}</h2>
    <p>
      {{ t('options.about.version', { version }) }} ·
      <a href="https://github.com/marr-cloud/json-viewer" target="_blank" rel="noopener">marr-cloud/json-viewer</a>
    </p>
    <p class="opt-hint">
      <I18nText k="options.about.inspired">
        <template #link>
          <a href="https://github.com/tulios/json-viewer" target="_blank" rel="noopener">tulios/json-viewer</a>
        </template>
      </I18nText>
    </p>
    <p class="opt-hint">
      <I18nText k="options.about.licenses">
        <template #link>
          <a href="/THEME-LICENSES.md" target="_blank" rel="noopener">{{ t('options.about.licensesLink') }}</a>
        </template>
      </I18nText>
    </p>
  </section>
</template>
```

Apply to `src/options/options.css`:

```diff
diff --git a/src/options/options.css b/src/options/options.css
index cbe8259..912a3ca 100644
--- a/src/options/options.css
+++ b/src/options/options.css
@@ -77,10 +77,17 @@ body {
   background: var(--opt-border);
 }
 
-.opt-reset {
+.opt-actions {
+  display: flex;
+  flex-direction: column;
+  gap: 8px;
   margin-top: auto;
 }
 
+.opt-actions p {
+  margin: 0;
+}
+
 .opt-main {
   overflow: auto;
   padding: 8px 24px 48px;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/i18n src/options/SettingsActions.test.ts src/settings/schema.test.ts src/viewer/session.test.ts`
Expected: PASS.

Run: `pnpm build`, then `pnpm exec playwright test e2e/backup.spec.ts e2e/i18n.spec.ts e2e/themes.spec.ts e2e/options.spec.ts`
Expected: PASS (26 tests).

- [ ] **Step 5: Full checks and commit**

Run: `pnpm compile` and `pnpm test`.
Expected: both green, 521 unit tests.

```bash
git add src/i18n src/options/SettingsActions.vue src/options/SettingsActions.test.ts src/settings/schema.ts src/settings/schema.test.ts src/viewer/session.ts src/viewer/session.test.ts src/entrypoints/options/App.vue src/options/sections/AboutSection.vue src/options/options.css e2e/backup.spec.ts e2e/i18n.spec.ts e2e/themes.spec.ts
git commit -m "feat(i18n): add English and Spanish, the Language setting and settings export/import"
```

---

### Task 3: Translate the viewer

**Files:**
- Create: `src/viewer/foldLevelLabel.ts`, `src/viewer/foldLevelLabel.test.ts`
- Modify: `src/components/ViewerToolbar.vue`, `src/components/ViewerStatusBar.vue`, `src/components/JsonPathFilter.vue`, `src/components/JsonViewer.vue`, `src/components/JsonViewer.test.ts`, `src/editor/searchPanel.ts`, `src/editor/searchPanel.test.ts`, `src/editor/dateTooltips.ts`, `src/editor/dateTooltips.test.ts`, `src/editor/foldSummary.ts`, `src/editor/foldSummary.test.ts`, `src/editor/imagePreview.ts`, `src/parse/formats.ts`, `src/parse/formats.test.ts`, `src/viewer/prepare.ts`, `src/viewer/jsonPath.ts`, `src/viewer/options.ts`, `src/viewer/stats.ts`, `src/viewer/stats.test.ts`, `src/options/sections/StructureSection.vue`, `src/i18n/index.ts`, `src/i18n/messages/en.ts`, `src/i18n/messages/es.ts`, `e2e/i18n.spec.ts`

**Interfaces:**
- Consumes: `t`, `tc`, `n`, `getLocale`, `setLocale`, `onLocaleChange`, `MessageKey` (Task 2).
- Produces:
  - `src/i18n/index.ts` gains `onLocaleChange(callback): () => void` (runs synchronously after each change, for DOM built outside Vue).
  - `foldLevelLabel(level)` moves to `src/viewer/foldLevelLabel.ts` (it now needs `@/i18n`, which `viewer/options.ts` must not import: the background loads that module through the settings schema).
  - `formatCount` is removed from `src/viewer/stats.ts`: counts are plural messages now.
  - `describeCount`, `describeDate`, `formatFoldSummary`, `foldLevelLabel` and the parse errors speak the page language.

- [ ] **Step 1: Write the failing tests**

Create `src/viewer/foldLevelLabel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { setLocale } from '@/i18n';
import { foldLevelLabel } from './foldLevelLabel';

describe('foldLevelLabel', () => {
  it('counts the levels left open, in the page language', () => {
    expect(foldLevelLabel(2)).toBe('Show 1 level');
    expect(foldLevelLabel(4)).toBe('Show 3 levels');
    setLocale('es');
    try {
      expect(foldLevelLabel(2)).toBe('Mostrar 1 nivel');
      expect(foldLevelLabel(4)).toBe('Mostrar 3 niveles');
    } finally {
      setLocale('en');
    }
  });
});
```

Apply to `src/editor/searchPanel.test.ts`:

```diff
diff --git a/src/editor/searchPanel.test.ts b/src/editor/searchPanel.test.ts
index 9bcb8b5..f814ffa 100644
--- a/src/editor/searchPanel.test.ts
+++ b/src/editor/searchPanel.test.ts
@@ -3,6 +3,7 @@ import { getSearchQuery, openSearchPanel, search, SearchQuery, searchPanelOpen,
 import { EditorState } from '@codemirror/state';
 import { EditorView } from '@codemirror/view';
 import { afterEach, describe, expect, it } from 'vitest';
+import { setLocale } from '@/i18n';
 import { COUNT_DOC_LIMIT, countMatches, createSearchPanel, describeCount, MAX_COUNTED_MATCHES } from './searchPanel';
 
 const DOC = '{"a": "x", "b": "X", "c": "xx"}';
@@ -45,6 +46,18 @@ describe('describeCount', () => {
     expect(describeCount({ current: 0, total: 1000, more: true })).toBe('1000+ matches');
     expect(describeCount({ current: 7, total: 1000, more: true })).toBe('7 of 1000+');
   });
+
+  it('speaks the page language', () => {
+    setLocale('es');
+    try {
+      expect(describeCount({ current: 0, total: 0, more: false })).toBe('Sin resultados');
+      expect(describeCount({ current: 0, total: 1, more: false })).toBe('1 resultado');
+      expect(describeCount({ current: 2, total: 3, more: false })).toBe('2 de 3');
+      expect(describeCount({ current: 0, total: 1000, more: true })).toBe('1000+ resultados');
+    } finally {
+      setLocale('en');
+    }
+  });
 });
 
 describe('createSearchPanel', () => {
@@ -79,6 +92,20 @@ describe('createSearchPanel', () => {
     return { view, panel, input, count, button, type, press };
   };
 
+  it('relabels itself and its count when the page language changes', () => {
+    const { input, count, button, type } = mount();
+    type('zzz');
+    expect(count.textContent).toBe('No results');
+    setLocale('es');
+    try {
+      expect(input.placeholder).toBe('Buscar');
+      expect(button('Cerrar')).not.toBeNull();
+      expect(count.textContent).toBe('Sin resultados');
+    } finally {
+      setLocale('en');
+    }
+  });
+
   it('replaces the default panel, keeps its class and focuses the field', () => {
     const { panel, input } = mount();
     expect(panel.classList.contains('cm-jv-search')).toBe(true);
```

Apply to `src/editor/dateTooltips.test.ts`:

```diff
diff --git a/src/editor/dateTooltips.test.ts b/src/editor/dateTooltips.test.ts
index 632210e..adfceca 100644
--- a/src/editor/dateTooltips.test.ts
+++ b/src/editor/dateTooltips.test.ts
@@ -4,6 +4,7 @@ import { ensureSyntaxTree } from '@codemirror/language';
 import { EditorState } from '@codemirror/state';
 import { EditorView } from '@codemirror/view';
 import { afterEach, describe, expect, it } from 'vitest';
+import { setLocale } from '@/i18n';
 import { dateTooltipAt, describeDate, epochDate, isoDate } from './dateTooltips';
 
 describe('epochDate', () => {
@@ -54,6 +55,21 @@ describe('describeDate', () => {
       expect(describeDate(date, offset)).toEqual(['2024-10-12 (Saturday)', 'Calendar date, no time zone']);
     }
   });
+
+  it('speaks the page language', () => {
+    setLocale('es');
+    try {
+      expect(describeDate({ ms: Date.UTC(2024, 9, 12), source: 'date' }, 0)).toEqual([
+        '2024-10-12 (sábado)',
+        'Fecha de calendario, sin zona horaria',
+      ]);
+      expect(describeDate({ ms: Date.UTC(2024, 9, 12), source: 'milliseconds' }, 0)[2]).toBe(
+        'Tiempo Unix en milisegundos',
+      );
+    } finally {
+      setLocale('en');
+    }
+  });
 });
 
 describe('dateTooltipAt', () => {
```

Apply to `src/editor/foldSummary.test.ts`:

```diff
diff --git a/src/editor/foldSummary.test.ts b/src/editor/foldSummary.test.ts
index 1ff2535..c7240a4 100644
--- a/src/editor/foldSummary.test.ts
+++ b/src/editor/foldSummary.test.ts
@@ -4,6 +4,7 @@ import { ensureSyntaxTree, foldAll, foldEffect } from '@codemirror/language';
 import { EditorState } from '@codemirror/state';
 import { EditorView } from '@codemirror/view';
 import { afterEach, describe, expect, it } from 'vitest';
+import { setLocale } from '@/i18n';
 import { foldSummaries, formatFoldSummary, summarizeFold } from './foldSummary';
 
 // Offsets: "{" 0, "[" 9, inner "{" 16, outer "c" value "{" 37
@@ -33,6 +34,16 @@ describe('formatFoldSummary', () => {
     expect(formatFoldSummary({ type: 'object', count: 1 })).toBe('1 key');
     expect(formatFoldSummary({ type: 'object', count: 2 })).toBe('2 keys');
   });
+
+  it('speaks the page language', () => {
+    setLocale('es');
+    try {
+      expect(formatFoldSummary({ type: 'array', count: 1 })).toBe('1 elemento');
+      expect(formatFoldSummary({ type: 'object', count: 2 })).toBe('2 claves');
+    } finally {
+      setLocale('en');
+    }
+  });
 });
 
 describe('foldSummaries in a mounted view', () => {
```

Apply to `src/parse/formats.test.ts`:

```diff
diff --git a/src/parse/formats.test.ts b/src/parse/formats.test.ts
index 2855d68..c0c6fad 100644
--- a/src/parse/formats.test.ts
+++ b/src/parse/formats.test.ts
@@ -1,4 +1,5 @@
 import { describe, expect, it } from 'vitest';
+import { setLocale } from '@/i18n';
 import { parseDocument, parseJsonp, parseNdjson } from './formats';
 
 const BOM = String.fromCharCode(0xfeff);
@@ -45,6 +46,17 @@ describe('parseNdjson', () => {
   it('fails on an empty document', () => {
     expect(parseNdjson(' \n\n')).toMatchObject({ ok: false, error: { message: 'No JSON values found' } });
   });
+
+  it('words its own errors in the page language', () => {
+    setLocale('es');
+    try {
+      expect(parseNdjson(' \n\n')).toMatchObject({ ok: false, error: { message: 'No se encontró ningún valor JSON' } });
+      const result = parseNdjson('{"a":1}\n{"b":}');
+      expect(!result.ok && result.error.message).toMatch(/^Línea 2: /);
+    } finally {
+      setLocale('en');
+    }
+  });
 });
 
 describe('parseDocument', () => {
```

Apply to `src/viewer/stats.test.ts` (the `formatCount` tests go; plural messages replace it):

```diff
diff --git a/src/viewer/stats.test.ts b/src/viewer/stats.test.ts
index e5b7a12..7516284 100644
--- a/src/viewer/stats.test.ts
+++ b/src/viewer/stats.test.ts
@@ -1,5 +1,5 @@
 import { describe, expect, it } from 'vitest';
-import { byteLength, countLines, formatBytes, formatCount, isLightMode } from './stats';
+import { byteLength, countLines, formatBytes, isLightMode } from './stats';
 
 describe('byteLength', () => {
   it('counts UTF-8 bytes', () => {
@@ -56,12 +56,3 @@ describe('countLines', () => {
   });
 });
 
-describe('formatCount', () => {
-  it('pluralizes and groups digits', () => {
-    expect(formatCount(1, 'line')).toBe('1 line');
-    expect(formatCount(0, 'line')).toBe('0 lines');
-    expect(formatCount(450_002, 'line')).toBe('450,002 lines');
-    expect(formatCount(3, 'match', 'matches')).toBe('3 matches');
-    expect(formatCount(1, 'match', 'matches')).toBe('1 match');
-  });
-});
```

Apply to `src/components/JsonViewer.test.ts`:

```diff
diff --git a/src/components/JsonViewer.test.ts b/src/components/JsonViewer.test.ts
index 7009c28..280d701 100644
--- a/src/components/JsonViewer.test.ts
+++ b/src/components/JsonViewer.test.ts
@@ -4,6 +4,7 @@ import { EditorView } from '@codemirror/view';
 import { afterEach, describe, expect, it, vi } from 'vitest';
 import { createApp, h, nextTick, reactive, type App } from 'vue';
 import type { JsonKind } from '@/detect/detect';
+import { setLocale } from '@/i18n';
 import { defaultLightTheme, defaultTheme } from '@/themes/builtin';
 import type { Theme } from '@/themes/types';
 import { defaultFontSettings, type FontSettings } from '@/settings/font';
@@ -52,6 +53,7 @@ afterEach(() => {
   app?.unmount();
   document.body.innerHTML = '';
   vi.restoreAllMocks();
+  setLocale('en');
 });
 
 describe('JsonViewer', () => {
@@ -189,6 +191,18 @@ describe('JsonViewer', () => {
     expect(host.querySelector<HTMLElement>('.cm-url')?.dataset.url).toBe('https://api.test/breads');
   });
 
+  it('speaks the page language and follows a change live', async () => {
+    setLocale('es');
+    const host = mount({ raw: '{"a":}' });
+    expect(host.querySelector('[aria-label="Plegar todo"]')).not.toBeNull();
+    expect(host.querySelector('.jv-status')?.textContent).toContain('1 línea');
+    expect(host.querySelector('.jv-error')?.textContent).toContain('línea 1, columna');
+    setLocale('en');
+    await nextTick();
+    expect(host.querySelector('[aria-label="Fold all"]')).not.toBeNull();
+    expect(host.querySelector('.jv-status')?.textContent).toContain('1 line');
+  });
+
   it('folds all, unfolds all and folds to a level', async () => {
     const host = mount({ raw: '{"a":{"b":{"c":[1]}}}' });
     const folds = () => foldedRanges(editorOf(host).state).size;
```

Apply to `e2e/i18n.spec.ts`:

```diff
diff --git a/e2e/i18n.spec.ts b/e2e/i18n.spec.ts
index c8eb72b..216049d 100644
--- a/e2e/i18n.spec.ts
+++ b/e2e/i18n.spec.ts
@@ -1,5 +1,5 @@
 import { expect, test } from './fixtures';
-import { getStorage } from './storage';
+import { getStorage, setStorage } from './storage';
 
 test('the options page switches language live and saves the choice', async ({ context, extensionId }) => {
   const options = await context.newPage();
@@ -13,3 +13,15 @@ test('the options page switches language live and saves the choice', async ({ co
   await options.getByLabel('Idioma').selectOption('auto');
   await expect(options.getByRole('link', { name: 'Appearance' })).toBeVisible();
 });
+
+test('the viewer speaks the chosen language and follows a change live', async ({ context, server }) => {
+  await setStorage(context, 'sync', { settings: { locale: 'es' } });
+  const page = await context.newPage();
+  await page.goto(server.url('/data.json'));
+  const viewer = page.locator('json-viewer-app');
+  await expect(viewer.getByRole('button', { name: 'Plegar todo', exact: true })).toBeVisible();
+  await expect(viewer.locator('.jv-status')).toContainText('líneas');
+  await setStorage(context, 'sync', { settings: { locale: 'en' } });
+  await expect(viewer.getByRole('button', { name: 'Fold all', exact: true })).toBeVisible();
+  await expect(viewer.locator('.jv-status')).toContainText('lines');
+});
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `pnpm exec vitest run src/editor src/parse src/viewer src/components/JsonViewer.test.ts`
Expected: FAIL. `./foldLevelLabel` cannot be resolved, and the new Spanish tests ("speaks the page language", "words its own errors in the page language", "relabels itself and its count…", "speaks the page language and follows a change live") get English text.

- [ ] **Step 3: Implement**

Apply to `src/i18n/messages/en.ts`:

```diff
diff --git a/src/i18n/messages/en.ts b/src/i18n/messages/en.ts
index 1cd810e..393e6e8 100644
--- a/src/i18n/messages/en.ts
+++ b/src/i18n/messages/en.ts
@@ -42,4 +42,72 @@ export const en = {
   'options.about.inspired': 'Inspired by {link}.',
   'options.about.licenses': 'Built-in themes are converted from VS Code themes via tm-themes; see their {link}.',
   'options.about.licensesLink': 'licenses',
+
+  'viewer.mode.code': 'Code',
+  'viewer.mode.raw': 'Raw',
+  'viewer.fold.group': 'Folding',
+  'viewer.fold.all': 'Fold all',
+  'viewer.fold.none': 'Unfold all',
+  'viewer.fold.toLevel': 'Fold to level',
+  'viewer.fold.levels': 'Levels',
+  'viewer.fold.unfold': 'Unfold',
+  'viewer.foldLevel.one': 'Show {count} level',
+  'viewer.foldLevel.other': 'Show {count} levels',
+  'viewer.foldSummary.items.one': '{count} item',
+  'viewer.foldSummary.items.other': '{count} items',
+  'viewer.foldSummary.keys.one': '{count} key',
+  'viewer.foldSummary.keys.other': '{count} keys',
+  'viewer.export.group': 'Export',
+  'viewer.copy.formatted': 'Copy formatted JSON',
+  'viewer.copy.minified': 'Copy minified JSON',
+  'viewer.copied.path': 'Copied path',
+  'viewer.copied.formatted': 'Copied formatted JSON',
+  'viewer.copied.minified': 'Copied minified JSON',
+  'viewer.copyFailed': 'Copy failed',
+  'viewer.download': 'Download JSON',
+  'viewer.sort.label': 'Sort keys',
+  'viewer.sort.title': 'Sort keys (this tab only)',
+  'viewer.theme.toggle': 'Toggle light/dark theme',
+  'viewer.theme.toLight': 'Switch to a light theme',
+  'viewer.theme.toDark': 'Switch to a dark theme',
+  'viewer.settings.label': 'Open settings',
+  'viewer.settings.title': 'Settings',
+  'viewer.error.at': ' — line {line}, column {column}',
+  'viewer.status.copyPath': 'Copy path',
+  'viewer.status.copyPathOf': 'Copy path {path}',
+  'viewer.status.lightMode': 'Light mode',
+  'viewer.status.lightModeHint': 'Over {mb} MB: color swatches and date and image previews are off.',
+  'viewer.status.lines.one': '{count} line',
+  'viewer.status.lines.other': '{count} lines',
+  'viewer.status.matches.one': '{count} match',
+  'viewer.status.matches.other': '{count} matches',
+  'viewer.filter.label': 'JSONPath filter',
+  'viewer.filter.title': 'JSONPath filter: Enter applies, Esc clears',
+  'viewer.filter.disabled': 'Fix the JSON error to filter',
+  'viewer.filter.clear': 'Clear filter',
+  'viewer.filter.clearTitle': 'Clear filter (Esc)',
+  'viewer.filter.tooDeep': 'The result is nested too deeply to format',
+
+  'search.find': 'Find',
+  'search.matchCase': 'Match case',
+  'search.wholeWord': 'Match whole word',
+  'search.regexp': 'Use regular expression',
+  'search.previous': 'Previous match',
+  'search.next': 'Next match',
+  'search.selectAll': 'Select all matches',
+  'search.close': 'Close',
+  'search.none': 'No results',
+  'search.position': '{current} of {total}',
+  'search.manyMatches': '{total} matches',
+
+  'values.date.unixSeconds': 'Unix time in seconds',
+  'values.date.unixMilliseconds': 'Unix time in milliseconds',
+  'values.date.calendar': 'Calendar date, no time zone',
+  'values.image.loading': 'Loading…',
+  'values.image.failed': 'The image could not be loaded.',
+
+  'parse.notJsonp': 'Not a JSONP response: expected callback(...)',
+  'parse.ndjsonLine': 'Line {line}: {message}',
+  'parse.noValues': 'No JSON values found',
+  'parse.tooDeep': 'Document is nested too deeply to format',
 } as const;
```

Apply to `src/i18n/messages/es.ts`:

```diff
diff --git a/src/i18n/messages/es.ts b/src/i18n/messages/es.ts
index a50883c..be289eb 100644
--- a/src/i18n/messages/es.ts
+++ b/src/i18n/messages/es.ts
@@ -44,4 +44,72 @@ export const es: Messages = {
   'options.about.inspired': 'Inspirado en {link}.',
   'options.about.licenses': 'Los temas incluidos se convierten desde temas de VS Code con tm-themes; consulta sus {link}.',
   'options.about.licensesLink': 'licencias',
+
+  'viewer.mode.code': 'Código',
+  'viewer.mode.raw': 'Texto',
+  'viewer.fold.group': 'Plegado',
+  'viewer.fold.all': 'Plegar todo',
+  'viewer.fold.none': 'Desplegar todo',
+  'viewer.fold.toLevel': 'Plegar por nivel',
+  'viewer.fold.levels': 'Niveles',
+  'viewer.fold.unfold': 'Desplegar',
+  'viewer.foldLevel.one': 'Mostrar {count} nivel',
+  'viewer.foldLevel.other': 'Mostrar {count} niveles',
+  'viewer.foldSummary.items.one': '{count} elemento',
+  'viewer.foldSummary.items.other': '{count} elementos',
+  'viewer.foldSummary.keys.one': '{count} clave',
+  'viewer.foldSummary.keys.other': '{count} claves',
+  'viewer.export.group': 'Exportar',
+  'viewer.copy.formatted': 'Copiar JSON formateado',
+  'viewer.copy.minified': 'Copiar JSON minificado',
+  'viewer.copied.path': 'Ruta copiada',
+  'viewer.copied.formatted': 'JSON formateado copiado',
+  'viewer.copied.minified': 'JSON minificado copiado',
+  'viewer.copyFailed': 'No se pudo copiar',
+  'viewer.download': 'Descargar JSON',
+  'viewer.sort.label': 'Ordenar claves',
+  'viewer.sort.title': 'Ordenar claves (solo en esta pestaña)',
+  'viewer.theme.toggle': 'Alternar tema claro/oscuro',
+  'viewer.theme.toLight': 'Cambiar a un tema claro',
+  'viewer.theme.toDark': 'Cambiar a un tema oscuro',
+  'viewer.settings.label': 'Abrir la configuración',
+  'viewer.settings.title': 'Configuración',
+  'viewer.error.at': ' — línea {line}, columna {column}',
+  'viewer.status.copyPath': 'Copiar ruta',
+  'viewer.status.copyPathOf': 'Copiar la ruta {path}',
+  'viewer.status.lightMode': 'Modo ligero',
+  'viewer.status.lightModeHint': 'Más de {mb} MB: sin muestras de color ni vistas previas de fechas e imágenes.',
+  'viewer.status.lines.one': '{count} línea',
+  'viewer.status.lines.other': '{count} líneas',
+  'viewer.status.matches.one': '{count} resultado',
+  'viewer.status.matches.other': '{count} resultados',
+  'viewer.filter.label': 'Filtro JSONPath',
+  'viewer.filter.title': 'Filtro JSONPath: Enter lo aplica, Esc lo quita',
+  'viewer.filter.disabled': 'Corrige el error del JSON para filtrar',
+  'viewer.filter.clear': 'Quitar el filtro',
+  'viewer.filter.clearTitle': 'Quitar el filtro (Esc)',
+  'viewer.filter.tooDeep': 'El resultado tiene demasiados niveles para formatearlo',
+
+  'search.find': 'Buscar',
+  'search.matchCase': 'Distinguir mayúsculas y minúsculas',
+  'search.wholeWord': 'Solo palabras completas',
+  'search.regexp': 'Usar expresión regular',
+  'search.previous': 'Resultado anterior',
+  'search.next': 'Resultado siguiente',
+  'search.selectAll': 'Seleccionar todos los resultados',
+  'search.close': 'Cerrar',
+  'search.none': 'Sin resultados',
+  'search.position': '{current} de {total}',
+  'search.manyMatches': '{total} resultados',
+
+  'values.date.unixSeconds': 'Tiempo Unix en segundos',
+  'values.date.unixMilliseconds': 'Tiempo Unix en milisegundos',
+  'values.date.calendar': 'Fecha de calendario, sin zona horaria',
+  'values.image.loading': 'Cargando…',
+  'values.image.failed': 'No se pudo cargar la imagen.',
+
+  'parse.notJsonp': 'No es una respuesta JSONP: se esperaba callback(...)',
+  'parse.ndjsonLine': 'Línea {line}: {message}',
+  'parse.noValues': 'No se encontró ningún valor JSON',
+  'parse.tooDeep': 'El documento tiene demasiados niveles para formatearlo',
 };
```

Apply to `src/i18n/index.ts`:

```diff
diff --git a/src/i18n/index.ts b/src/i18n/index.ts
index 79c3c4c..efa9d3a 100644
--- a/src/i18n/index.ts
+++ b/src/i18n/index.ts
@@ -1,4 +1,4 @@
-import { shallowRef } from 'vue';
+import { shallowRef, watch } from 'vue';
 import {
   formatNumber,
   resolveLocale,
@@ -26,6 +26,11 @@ export function setLocale(locale: Locale): void {
   current.value = locale;
 }
 
+/** Calls `callback` right after each language change, for DOM built outside Vue. Returns a stop function. */
+export function onLocaleChange(callback: (locale: Locale) => void): () => void {
+  return watch(current, callback, { flush: 'sync' });
+}
+
 /** Sets the page's language from the setting (`auto` follows the browser) and returns it. */
 export function applyLocaleSetting(setting: LocaleSetting, languages: readonly string[] = navigator.languages): Locale {
   const locale = resolveLocale(setting, languages);
```

Create `src/viewer/foldLevelLabel.ts`:

```ts
import { tc } from '@/i18n';

/** How a fold level reads in the UI: level 2 shows one level of the document. */
export function foldLevelLabel(level: number): string {
  return tc('viewer.foldLevel', level - 1);
}
```

Apply to `src/viewer/options.ts`:

```diff
diff --git a/src/viewer/options.ts b/src/viewer/options.ts
index 59dd315..78595eb 100644
--- a/src/viewer/options.ts
+++ b/src/viewer/options.ts
@@ -41,11 +41,6 @@ export const FOLD_LEVELS = [2, 3, 4, 5, 6] as const;
 /** "Fold all" keeps the top-level value open and folds everything inside it. */
 export const FOLD_ALL_LEVEL = 2;
 
-/** How a fold level reads in the UI: level 2 shows one level of the document. */
-export function foldLevelLabel(level: number): string {
-  const shown = level - 1;
-  return `Show ${shown} level${shown === 1 ? '' : 's'}`;
-}
 
 export const LIGHT_MODE_MIN_MB = 1;
 export const LIGHT_MODE_MAX_MB = 1000;
```

Apply to `src/viewer/stats.ts`:

```diff
diff --git a/src/viewer/stats.ts b/src/viewer/stats.ts
index 58402ac..535323c 100644
--- a/src/viewer/stats.ts
+++ b/src/viewer/stats.ts
@@ -40,10 +40,6 @@ export function countLines(text: string): number {
   return lines;
 }
 
-export function formatCount(count: number, singular: string, plural = `${singular}s`): string {
-  return `${count.toLocaleString('en-US')} ${count === 1 ? singular : plural}`;
-}
-
 /** Light mode: the document is bigger than the threshold (in MiB, like the status bar). */
 export function isLightMode(bytes: number, thresholdMB: number): boolean {
   return bytes > thresholdMB * MB;
```

Apply to `src/editor/searchPanel.ts`:

```diff
diff --git a/src/editor/searchPanel.ts b/src/editor/searchPanel.ts
index 3e72d10..8210a72 100644
--- a/src/editor/searchPanel.ts
+++ b/src/editor/searchPanel.ts
@@ -9,6 +9,7 @@ import {
 } from '@codemirror/search';
 import type { EditorState } from '@codemirror/state';
 import { runScopeHandlers, type EditorView, type Panel, type ViewUpdate } from '@codemirror/view';
+import { onLocaleChange, t, tc, type MessageKey } from '@/i18n';
 
 /** Counting stops here; the panel then shows "1000+". */
 export const MAX_COUNTED_MATCHES = 1000;
@@ -41,21 +42,27 @@ export function countMatches(state: EditorState, query: SearchQuery): MatchCount
 /** "2 of 12", "12 matches", "No results"; empty when there is no count. */
 export function describeCount(count: MatchCount | null): string {
   if (count === null) return '';
-  if (count.total === 0) return 'No results';
+  if (count.total === 0) return t('search.none');
   const total = count.more ? `${count.total}+` : String(count.total);
-  if (count.current > 0) return `${count.current} of ${total}`;
-  return count.total === 1 && !count.more ? '1 match' : `${total} matches`;
+  if (count.current > 0) return t('search.position', { current: String(count.current), total });
+  return count.more ? t('search.manyMatches', { total }) : tc('viewer.status.matches', count.total);
 }
 
 type ToggleKey = 'caseSensitive' | 'regexp' | 'wholeWord';
 
-function button(label: string, text: string, onClick: () => void, className = 'cm-jv-search-button'): HTMLButtonElement {
+/** Gives an element its label (title and aria-label) in the current language. */
+function label(element: HTMLElement, key: MessageKey): void {
+  element.title = t(key);
+  element.setAttribute('aria-label', t(key));
+}
+
+function button(key: MessageKey, text: string, onClick: () => void, className = 'cm-jv-search-button'): HTMLButtonElement {
   const element = document.createElement('button');
   element.type = 'button';
   element.className = className;
   element.textContent = text;
-  element.title = label;
-  element.setAttribute('aria-label', label);
+  element.dataset.label = key;
+  label(element, key);
   // Keep focus in the input, as VS Code does.
   element.addEventListener('mousedown', (event) => event.preventDefault());
   element.addEventListener('click', onClick);
@@ -73,16 +80,15 @@ export function createSearchPanel(view: EditorView): Panel {
   field.className = 'cm-jv-search-field';
   const input = document.createElement('input');
   input.className = 'cm-jv-search-input';
-  input.placeholder = 'Find';
-  input.setAttribute('aria-label', 'Find');
+
   // openSearchPanel focuses and selects the element with this attribute.
   input.setAttribute('main-field', 'true');
   input.spellcheck = false;
 
   const toggles: Record<ToggleKey, HTMLButtonElement> = {
-    caseSensitive: button('Match case', 'Aa', () => toggle('caseSensitive'), 'cm-jv-search-toggle'),
-    wholeWord: button('Match whole word', 'ab', () => toggle('wholeWord'), 'cm-jv-search-toggle'),
-    regexp: button('Use regular expression', '.*', () => toggle('regexp'), 'cm-jv-search-toggle'),
+    caseSensitive: button('search.matchCase', 'Aa', () => toggle('caseSensitive'), 'cm-jv-search-toggle'),
+    wholeWord: button('search.wholeWord', 'ab', () => toggle('wholeWord'), 'cm-jv-search-toggle'),
+    regexp: button('search.regexp', '.*', () => toggle('regexp'), 'cm-jv-search-toggle'),
   };
   toggles.wholeWord.classList.add('cm-jv-search-word');
   field.append(input, toggles.caseSensitive, toggles.wholeWord, toggles.regexp);
@@ -94,12 +100,26 @@ export function createSearchPanel(view: EditorView): Panel {
   dom.append(
     field,
     count,
-    button('Previous match', '↑', () => findPrevious(view)),
-    button('Next match', '↓', () => findNext(view)),
-    button('Select all matches', '≡', () => selectMatches(view)),
-    button('Close', '×', () => close()),
+    button('search.previous', '↑', () => findPrevious(view)),
+    button('search.next', '↓', () => findNext(view)),
+    button('search.selectAll', '≡', () => selectMatches(view)),
+    button('search.close', '×', () => close()),
   );
 
+  /** Puts the labels in the current language; runs again when the language changes. */
+  function relabel(): void {
+    input.placeholder = t('search.find');
+    input.setAttribute('aria-label', t('search.find'));
+    for (const element of dom.querySelectorAll<HTMLElement>('[data-label]')) {
+      label(element, element.dataset.label as MessageKey);
+    }
+  }
+  relabel();
+  const stopRelabel = onLocaleChange(() => {
+    relabel();
+    refreshCount(view.state);
+  });
+
   function show(): void {
     if (input.value !== query.search) input.value = query.search;
     for (const key of Object.keys(toggles) as ToggleKey[]) {
@@ -172,6 +192,9 @@ export function createSearchPanel(view: EditorView): Panel {
       input.focus();
       input.select();
     },
+    destroy() {
+      stopRelabel();
+    },
     update(update: ViewUpdate) {
       let changed = false;
       for (const tr of update.transactions) {
```

Apply to `src/editor/dateTooltips.ts`:

```diff
diff --git a/src/editor/dateTooltips.ts b/src/editor/dateTooltips.ts
index 169fd2a..1b596a6 100644
--- a/src/editor/dateTooltips.ts
+++ b/src/editor/dateTooltips.ts
@@ -1,5 +1,6 @@
 import type { Extension } from '@codemirror/state';
 import { hoverTooltip, type EditorView, type Tooltip } from '@codemirror/view';
+import { getLocale, t, type MessageKey } from '@/i18n';
 import { valueTokenAt } from './jsonToken';
 
 const MIN_MS = Date.UTC(1990, 0, 1);
@@ -47,14 +48,16 @@ function formatOffset(minutes: number): string {
   return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
 }
 
-const SOURCE_LABELS: Record<DetectedDate['source'], string | null> = {
-  seconds: 'Unix time in seconds',
-  milliseconds: 'Unix time in milliseconds',
+const SOURCE_LABELS: Record<DetectedDate['source'], MessageKey | null> = {
+  seconds: 'values.date.unixSeconds',
+  milliseconds: 'values.date.unixMilliseconds',
   iso: null,
-  date: 'Calendar date, no time zone',
+  date: 'values.date.calendar',
 };
 
-const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
+function weekday(ms: number): string {
+  return new Date(ms).toLocaleDateString(getLocale(), { weekday: 'long', timeZone: 'UTC' });
+}
 
 /**
  * The tooltip lines for a date: local time (with its UTC offset), UTC, and how a number was read.
@@ -63,14 +66,14 @@ const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Frida
 export function describeDate(date: DetectedDate, offsetMinutes: number): string[] {
   if (date.source === 'date') {
     const day = new Date(date.ms);
-    return [`${day.toISOString().slice(0, 10)} (${WEEKDAYS[day.getUTCDay()]})`, SOURCE_LABELS.date!];
+    return [`${day.toISOString().slice(0, 10)} (${weekday(date.ms)})`, t('values.date.calendar')];
   }
   const lines = [
     `${formatClock(date.ms + offsetMinutes * 60_000)} (${formatOffset(offsetMinutes)})`,
     `${formatClock(date.ms)} UTC`,
   ];
   const label = SOURCE_LABELS[date.source];
-  return label === null ? lines : [...lines, label];
+  return label === null ? lines : [...lines, t(label)];
 }
 
 /** The date tooltip for the value at `pos`, if it is one. */
```

Apply to `src/editor/foldSummary.ts`:

```diff
diff --git a/src/editor/foldSummary.ts b/src/editor/foldSummary.ts
index d651704..5670223 100644
--- a/src/editor/foldSummary.ts
+++ b/src/editor/foldSummary.ts
@@ -1,5 +1,6 @@
 import { codeFolding, syntaxTree } from '@codemirror/language';
 import type { EditorState, Extension } from '@codemirror/state';
+import { t, tc } from '@/i18n';
 
 export interface FoldSummary {
   type: 'object' | 'array';
@@ -24,8 +25,7 @@ export function summarizeFold(state: EditorState, from: number): FoldSummary | n
 }
 
 export function formatFoldSummary({ type, count }: FoldSummary): string {
-  const noun = type === 'array' ? 'item' : 'key';
-  return `${count} ${noun}${count === 1 ? '' : 's'}`;
+  return tc(type === 'array' ? 'viewer.foldSummary.items' : 'viewer.foldSummary.keys', count);
 }
 
 /** Fold placeholders that show how many items/keys are hidden ("… 3 items"). */
@@ -36,7 +36,7 @@ export function foldSummaries(): Extension {
       const el = document.createElement('span');
       el.className = 'cm-foldPlaceholder';
       el.textContent = prepared ? `… ${formatFoldSummary(prepared)}` : '…';
-      el.title = 'Unfold';
+      el.title = t('viewer.fold.unfold');
       el.onclick = onclick;
       return el;
     },
```

Apply to `src/editor/imagePreview.ts`:

```diff
diff --git a/src/editor/imagePreview.ts b/src/editor/imagePreview.ts
index 82d9365..d0a5140 100644
--- a/src/editor/imagePreview.ts
+++ b/src/editor/imagePreview.ts
@@ -1,5 +1,6 @@
 import type { Extension } from '@codemirror/state';
 import { hoverTooltip, type EditorView, type Tooltip } from '@codemirror/view';
+import { t } from '@/i18n';
 import { valueTokenAt } from './jsonToken';
 
 const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'];
@@ -22,7 +23,7 @@ function imageTooltipDom(src: string): HTMLElement {
   dom.className = 'cm-jv-image';
   const info = document.createElement('div');
   info.className = 'cm-jv-image-info';
-  info.textContent = 'Loading…';
+  info.textContent = t('values.image.loading');
   const img = document.createElement('img');
   img.alt = '';
   // The image is only requested when the tooltip opens, and without the page as referrer.
@@ -32,7 +33,7 @@ function imageTooltipDom(src: string): HTMLElement {
   });
   img.addEventListener('error', () => {
     img.remove();
-    info.textContent = 'The image could not be loaded.';
+    info.textContent = t('values.image.failed');
   });
   img.src = src;
   dom.append(img, info);
```

Apply to `src/parse/formats.ts`:

```diff
diff --git a/src/parse/formats.ts b/src/parse/formats.ts
index 7a664a8..0b1930a 100644
--- a/src/parse/formats.ts
+++ b/src/parse/formats.ts
@@ -1,5 +1,6 @@
 import type { JsonKind } from '@/detect/detect';
 import { jsonpBounds } from '@/detect/jsonp';
+import { t } from '@/i18n';
 import { offsetToLineColumn, parseJson, stripBom, type ParseError, type ParseResult } from './parse';
 
 /** Parses a response of the given kind. Error offsets, lines and columns refer to the BOM-stripped text. */
@@ -14,7 +15,7 @@ export function parseJsonp(text: string): ParseResult {
   const source = stripBom(text);
   const bounds = jsonpBounds(source);
   if (bounds === null) {
-    return { ok: false, error: { message: 'Not a JSONP response: expected callback(...)', line: 1, column: 1, offset: 0 } };
+    return { ok: false, error: { message: t('parse.notJsonp'), line: 1, column: 1, offset: 0 } };
   }
   const inner = parseJson(source.slice(bounds.from, bounds.to));
   if (inner.ok) return inner;
@@ -36,7 +37,7 @@ export function parseNdjson(text: string): ParseResult {
       const result = parseJson(lineText);
       if (!result.ok) {
         const error = shift(result.error, source, start);
-        return { ok: false, error: { ...error, message: `Line ${line}: ${result.error.message}` } };
+        return { ok: false, error: { ...error, message: t('parse.ndjsonLine', { line, message: result.error.message }) } };
       }
       values.push(result.value);
     }
@@ -44,7 +45,7 @@ export function parseNdjson(text: string): ParseResult {
     line++;
   }
   if (values.length === 0) {
-    return { ok: false, error: { message: 'No JSON values found', line: null, column: null, offset: null } };
+    return { ok: false, error: { message: t('parse.noValues'), line: null, column: null, offset: null } };
   }
   return { ok: true, value: values };
 }
```

Apply to `src/viewer/prepare.ts`:

```diff
diff --git a/src/viewer/prepare.ts b/src/viewer/prepare.ts
index 267c192..33474a6 100644
--- a/src/viewer/prepare.ts
+++ b/src/viewer/prepare.ts
@@ -2,6 +2,7 @@ import { isNdjson, type JsonKind } from '@/detect/detect';
 import { formatJson } from '@/parse/format';
 import { parseDocument } from '@/parse/formats';
 import { stripBom, type ParseError } from '@/parse/parse';
+import { t } from '@/i18n';
 import type { ViewerOptions } from './options';
 
 /** `kind` is the format actually shown, which can differ from the one asked for (see prepareDocument). */
@@ -10,8 +11,6 @@ export type PreparedDocument = (
   | { ok: false; text: string; error: ParseError }
 ) & { kind: JsonKind };
 
-const TOO_DEEP = 'Document is nested too deeply to format';
-
 /**
  * Parses and formats the raw response. Never throws: failures carry the raw text.
  * JSON that doesn't parse but is valid NDJSON (some APIs send NDJSON as application/json) is shown as NDJSON.
@@ -37,7 +36,7 @@ export function prepareDocument(
     });
     return { ok: true, text, value: parsed.value, kind: shown };
   } catch (e) {
-    const message = e instanceof RangeError ? TOO_DEEP : String(e);
+    const message = e instanceof RangeError ? t('parse.tooDeep') : String(e);
     return { ok: false, text: stripBom(raw), error: { message, line: null, column: null, offset: null }, kind: shown };
   }
 }
```

Apply to `src/viewer/jsonPath.ts`:

```diff
diff --git a/src/viewer/jsonPath.ts b/src/viewer/jsonPath.ts
index be3f3a6..2f0b110 100644
--- a/src/viewer/jsonPath.ts
+++ b/src/viewer/jsonPath.ts
@@ -1,4 +1,5 @@
 import { JSONPath } from 'jsonpath-plus';
+import { t } from '@/i18n';
 import { formatJson, type FormatOptions } from '@/parse/format';
 
 export type FilterResult =
@@ -18,6 +19,6 @@ export function filterDocument(value: unknown, path: string, format: FormatOptio
   try {
     return { ok: true, text: formatJson(list, format), value: list, count: list.length };
   } catch (e) {
-    return { ok: false, message: e instanceof RangeError ? 'The result is nested too deeply to format' : String(e) };
+    return { ok: false, message: e instanceof RangeError ? t('viewer.filter.tooDeep') : String(e) };
   }
 }
```

Apply to `src/components/ViewerToolbar.vue`:

```diff
diff --git a/src/components/ViewerToolbar.vue b/src/components/ViewerToolbar.vue
index de62905..82f09e7 100644
--- a/src/components/ViewerToolbar.vue
+++ b/src/components/ViewerToolbar.vue
@@ -1,5 +1,7 @@
 <script setup lang="ts">
-import { FOLD_LEVELS, foldLevelLabel } from '@/viewer/options';
+import { getLocale, t } from '@/i18n';
+import { foldLevelLabel } from '@/viewer/foldLevelLabel';
+import { FOLD_LEVELS } from '@/viewer/options';
 
 withDefaults(
   defineProps<{
@@ -10,7 +12,7 @@ withDefaults(
     canFold: boolean;
     canMinify: boolean;
   }>(),
-  { source: undefined, toggleLabel: 'Toggle light/dark theme' },
+  { source: undefined, toggleLabel: undefined },
 );
 const emit = defineEmits<{
   toggleTheme: [];
@@ -36,40 +38,53 @@ function onFoldLevel(event: Event): void {
 <template>
   <header class="jv-toolbar">
     <div class="jv-modes" role="tablist">
-      <button type="button" role="tab" :aria-selected="mode === 'code'" @click="mode = 'code'">Code</button>
-      <button type="button" role="tab" :aria-selected="mode === 'raw'" @click="mode = 'raw'">Raw</button>
+      <button type="button" role="tab" :aria-selected="mode === 'code'" @click="mode = 'code'">{{ t('viewer.mode.code') }}</button>
+      <button type="button" role="tab" :aria-selected="mode === 'raw'" @click="mode = 'raw'">{{ t('viewer.mode.raw') }}</button>
     </div>
     <slot name="filter" />
     <div v-if="source" class="jv-source" :title="source.url">
       <span class="jv-url">{{ source.url }}</span>
-      <time :datetime="source.loadedAt.toISOString()">{{ source.loadedAt.toLocaleString() }}</time>
+      <time :datetime="source.loadedAt.toISOString()">{{ source.loadedAt.toLocaleString(getLocale()) }}</time>
     </div>
     <div class="jv-actions">
-      <div class="jv-group" role="group" aria-label="Folding">
-        <button type="button" class="jv-icon-button" aria-label="Fold all" title="Fold all" :disabled="!canFold" @click="emit('foldAll')">
+      <div class="jv-group" role="group" :aria-label="t('viewer.fold.group')">
+        <button
+          type="button"
+          class="jv-icon-button"
+          :aria-label="t('viewer.fold.all')"
+          :title="t('viewer.fold.all')"
+          :disabled="!canFold"
+          @click="emit('foldAll')"
+        >
           ⊟
         </button>
         <button
           type="button"
           class="jv-icon-button"
-          aria-label="Unfold all"
-          title="Unfold all"
+          :aria-label="t('viewer.fold.none')"
+          :title="t('viewer.fold.none')"
           :disabled="!canFold"
           @click="emit('unfoldAll')"
         >
           ⊞
         </button>
-        <select class="jv-fold-level" aria-label="Fold to level" title="Fold to level" :disabled="!canFold" @change="onFoldLevel">
-          <option value="">Levels</option>
+        <select
+          class="jv-fold-level"
+          :aria-label="t('viewer.fold.toLevel')"
+          :title="t('viewer.fold.toLevel')"
+          :disabled="!canFold"
+          @change="onFoldLevel"
+        >
+          <option value="">{{ t('viewer.fold.levels') }}</option>
           <option v-for="level in FOLD_LEVELS" :key="level" :value="String(level)">{{ foldLevelLabel(level) }}</option>
         </select>
       </div>
-      <div class="jv-group" role="group" aria-label="Export">
+      <div class="jv-group" role="group" :aria-label="t('viewer.export.group')">
         <button
           type="button"
           class="jv-icon-button"
-          aria-label="Copy formatted JSON"
-          title="Copy formatted JSON"
+          :aria-label="t('viewer.copy.formatted')"
+          :title="t('viewer.copy.formatted')"
           @click="emit('copy', 'formatted')"
         >
           ⧉
@@ -77,22 +92,28 @@ function onFoldLevel(event: Event): void {
         <button
           type="button"
           class="jv-icon-button jv-wide"
-          aria-label="Copy minified JSON"
-          title="Copy minified JSON"
+          :aria-label="t('viewer.copy.minified')"
+          :title="t('viewer.copy.minified')"
           :disabled="!canMinify"
           @click="emit('copy', 'minified')"
         >
           ⧉<small>min</small>
         </button>
-        <button type="button" class="jv-icon-button" aria-label="Download JSON" title="Download JSON" @click="emit('download')">
+        <button
+          type="button"
+          class="jv-icon-button"
+          :aria-label="t('viewer.download')"
+          :title="t('viewer.download')"
+          @click="emit('download')"
+        >
           ⬇
         </button>
       </div>
       <button
         type="button"
         class="jv-icon-button"
-        aria-label="Sort keys"
-        title="Sort keys (this tab only)"
+        :aria-label="t('viewer.sort.label')"
+        :title="t('viewer.sort.title')"
         :aria-pressed="sorted"
         @click="emit('toggleSort')"
       >
@@ -101,13 +122,19 @@ function onFoldLevel(event: Event): void {
       <button
         type="button"
         class="jv-icon-button"
-        :aria-label="toggleLabel"
-        :title="kind === 'dark' ? 'Switch to a light theme' : 'Switch to a dark theme'"
+        :aria-label="toggleLabel ?? t('viewer.theme.toggle')"
+        :title="kind === 'dark' ? t('viewer.theme.toLight') : t('viewer.theme.toDark')"
         @click="emit('toggleTheme')"
       >
         {{ kind === 'dark' ? '☀' : '☾' }}
       </button>
-      <button type="button" class="jv-icon-button" aria-label="Open settings" title="Settings" @click="emit('openSettings')">
+      <button
+        type="button"
+        class="jv-icon-button"
+        :aria-label="t('viewer.settings.label')"
+        :title="t('viewer.settings.title')"
+        @click="emit('openSettings')"
+      >
         ⚙
       </button>
     </div>
```

Apply to `src/components/ViewerStatusBar.vue`:

```diff
diff --git a/src/components/ViewerStatusBar.vue b/src/components/ViewerStatusBar.vue
index 9a07c84..4ca986f 100644
--- a/src/components/ViewerStatusBar.vue
+++ b/src/components/ViewerStatusBar.vue
@@ -1,4 +1,6 @@
 <script setup lang="ts">
+import { n, t } from '@/i18n';
+
 withDefaults(
   defineProps<{
     path: string | null;
@@ -21,8 +23,8 @@ const emit = defineEmits<{ copyPath: [] }>();
       v-if="path !== null"
       type="button"
       class="jv-path"
-      :aria-label="`Copy path ${path}`"
-      title="Copy path"
+      :aria-label="t('viewer.status.copyPathOf', { path })"
+      :title="t('viewer.status.copyPath')"
       @click="emit('copyPath')"
     >
       {{ path }}
@@ -32,8 +34,8 @@ const emit = defineEmits<{ copyPath: [] }>();
       <span
         v-if="lightMode !== null"
         class="jv-light-mode"
-        :title="`Over ${lightMode} MB: color swatches and date and image previews are off.`"
-        >Light mode</span
+        :title="t('viewer.status.lightModeHint', { mb: n(lightMode) })"
+        >{{ t('viewer.status.lightMode') }}</span
       >
       <span v-if="note">{{ note }}</span>
       <span>{{ size }}</span>
```

Apply to `src/components/JsonPathFilter.vue`:

```diff
diff --git a/src/components/JsonPathFilter.vue b/src/components/JsonPathFilter.vue
index 07e9eaa..973325c 100644
--- a/src/components/JsonPathFilter.vue
+++ b/src/components/JsonPathFilter.vue
@@ -1,5 +1,6 @@
 <script setup lang="ts">
 import { ref } from 'vue';
+import { t } from '@/i18n';
 
 defineProps<{ active: boolean; error: string | null; disabled: boolean }>();
 const emit = defineEmits<{ apply: [path: string]; clear: [] }>();
@@ -39,14 +40,21 @@ defineExpose({
       type="text"
       spellcheck="false"
       autocomplete="off"
-      aria-label="JSONPath filter"
+      :aria-label="t('viewer.filter.label')"
       placeholder="$.items[*].id"
-      :title="disabled ? 'Fix the JSON error to filter' : 'JSONPath filter: Enter applies, Esc clears'"
+      :title="disabled ? t('viewer.filter.disabled') : t('viewer.filter.title')"
       :disabled="disabled"
       :aria-invalid="error !== null"
       @keydown="onKeydown"
     />
-    <button v-if="active" type="button" class="jv-icon-button" aria-label="Clear filter" title="Clear filter (Esc)" @click="clearAndFocus">
+    <button
+      v-if="active"
+      type="button"
+      class="jv-icon-button"
+      :aria-label="t('viewer.filter.clear')"
+      :title="t('viewer.filter.clearTitle')"
+      @click="clearAndFocus"
+    >
       ×
     </button>
     <p v-if="error" class="jv-filter-error" role="alert">{{ error }}</p>
```

Apply to `src/components/JsonViewer.vue`:

```diff
diff --git a/src/components/JsonViewer.vue b/src/components/JsonViewer.vue
index 81c8545..6335511 100644
--- a/src/components/JsonViewer.vue
+++ b/src/components/JsonViewer.vue
@@ -5,6 +5,7 @@ import JsonPathFilter from './JsonPathFilter.vue';
 import ViewerStatusBar from './ViewerStatusBar.vue';
 import ViewerToolbar from './ViewerToolbar.vue';
 import { fontCssVars } from '@/fonts/css';
+import { getLocale, t, tc, type MessageKey } from '@/i18n';
 import type { FontSettings } from '@/settings/font';
 import { actionFor, comboFromEvent, defaultShortcuts, type ShortcutAction, type Shortcuts } from '@/settings/shortcuts';
 import { toCssVars } from '@/themes/css';
@@ -17,7 +18,7 @@ import { downloadName, downloadText } from '@/viewer/download';
 import { defaultFeatures, FOLD_ALL_LEVEL, richValues, type Features, type ViewerOptions } from '@/viewer/options';
 import { filterDocument } from '@/viewer/jsonPath';
 import { prepareDocument } from '@/viewer/prepare';
-import { byteLength, countLines, formatBytes, formatCount, isLightMode } from '@/viewer/stats';
+import { byteLength, countLines, formatBytes, isLightMode } from '@/viewer/stats';
 
 const props = withDefaults(
   defineProps<{
@@ -94,7 +95,7 @@ const shown = computed<{ text: string; value: unknown; valid: boolean; error: Pa
 });
 // Filter results open unfolded, whatever "Fold on open" says.
 const codeOptions = computed(() => (filtered.value?.ok ? { ...props.options, foldFromLevel: 0 } : props.options));
-const matches = computed(() => (filtered.value?.ok ? formatCount(filtered.value.count, 'match', 'matches') : undefined));
+const matches = computed(() => (filtered.value?.ok ? tc('viewer.status.matches', filtered.value.count) : undefined));
 const cssVars = computed(() => ({
   ...toCssVars(resolveColors(props.theme)),
   ...(props.font ? fontCssVars(props.font) : {}),
@@ -109,7 +110,7 @@ const size = computed(() => formatBytes(bytes.value));
 /** Huge documents skip the value decorations; the status bar says so. */
 const lightMode = computed(() => isLightMode(bytes.value, props.options.lightModeThresholdMB));
 const rich = computed(() => richValues(props.features, lightMode.value));
-const lines = computed(() => formatCount(countLines(mode.value === 'code' ? shown.value.text : props.raw), 'line'));
+const lines = computed(() => tc('viewer.status.lines', countLines(mode.value === 'code' ? shown.value.text : props.raw)));
 
 const message = ref('');
 let flashTimer: ReturnType<typeof setTimeout> | undefined;
@@ -122,13 +123,13 @@ function flash(text: string): void {
 }
 onBeforeUnmount(() => clearTimeout(flashTimer));
 
-async function copy(text: string | null, what: string): Promise<void> {
+async function copy(text: string | null, done: MessageKey): Promise<void> {
   if (text === null || !root.value) return;
-  flash((await copyText(text, root.value)) ? `Copied ${what}` : 'Copy failed');
+  flash(t((await copyText(text, root.value)) ? done : 'viewer.copyFailed'));
 }
 
 function copyPath(): void {
-  void copy(cursorPath.value, 'path');
+  void copy(cursorPath.value, 'viewer.copied.path');
 }
 
 const codeView = ref<InstanceType<typeof CodeView>>();
@@ -151,7 +152,9 @@ function minified(): string | null {
 }
 
 function onCopy(variant: 'formatted' | 'minified'): void {
-  void (variant === 'formatted' ? copy(shown.value.text, 'formatted JSON') : copy(minified(), 'minified JSON'));
+  void (variant === 'formatted'
+    ? copy(shown.value.text, 'viewer.copied.formatted')
+    : copy(minified(), 'viewer.copied.minified'));
 }
 
 function onDownload(): void {
@@ -254,7 +257,15 @@ onBeforeUnmount(() => document.removeEventListener('keydown', onDocumentKeydown,
 </script>
 
 <template>
-  <div ref="root" class="jv-root" :class="`jv-${theme.type}`" :style="cssVars" @keydown.capture="onShortcut" @keydown="onEscape">
+  <div
+    ref="root"
+    class="jv-root"
+    :class="`jv-${theme.type}`"
+    :style="cssVars"
+    :lang="getLocale()"
+    @keydown.capture="onShortcut"
+    @keydown="onEscape"
+  >
     <component :is="'style'" v-if="customCss">{{ customCss }}</component>
     <ViewerToolbar
       v-model:mode="mode"
@@ -288,9 +299,9 @@ onBeforeUnmount(() => document.removeEventListener('keydown', onDocumentKeydown,
     </ViewerToolbar>
     <div v-if="!prepared.ok" class="jv-error" role="alert">
       {{ prepared.error.message
-      }}<template v-if="prepared.error.line !== null">
-        — line {{ prepared.error.line }}, column {{ prepared.error.column }}</template
-      >
+      }}<template v-if="prepared.error.line !== null">{{
+        t('viewer.error.at', { line: prepared.error.line, column: prepared.error.column ?? '' })
+      }}</template>
     </div>
     <CodeView
       v-if="mode === 'code'"
```

Apply to `src/options/sections/StructureSection.vue` (import path only):

```diff
diff --git a/src/options/sections/StructureSection.vue b/src/options/sections/StructureSection.vue
index a64f0b1..365d884 100644
--- a/src/options/sections/StructureSection.vue
+++ b/src/options/sections/StructureSection.vue
@@ -5,7 +5,8 @@ import SelectField from '../fields/SelectField.vue';
 import ToggleField from '../fields/ToggleField.vue';
 import type { SelectOption } from '../types';
 import { TAB_SIZE_MAX, TAB_SIZE_MIN } from '@/settings/schema';
-import { FOLD_LEVELS, foldLevelLabel, type ViewerOptions } from '@/viewer/options';
+import { foldLevelLabel } from '@/viewer/foldLevelLabel';
+import { FOLD_LEVELS, type ViewerOptions } from '@/viewer/options';
 
 const props = defineProps<{ viewer: ViewerOptions }>();
 
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/editor src/parse src/viewer src/components`
Expected: PASS.

Run: `pnpm build`, then `pnpm exec playwright test e2e/i18n.spec.ts e2e/viewer.spec.ts e2e/values.spec.ts e2e/input.spec.ts`
Expected: PASS (37 tests). The English e2e tests keep their selectors: the default language is English in Playwright's pages.

- [ ] **Step 5: Full checks and commit**

Run: `pnpm compile` and `pnpm test`.
Expected: both green, 527 unit tests.

```bash
git add src/components src/editor src/parse src/viewer src/i18n src/options/sections/StructureSection.vue e2e/i18n.spec.ts
git commit -m "feat(i18n): translate the viewer"
```

---

### Task 4: Translate the options page

**Files:**
- Modify: `src/options/sections/AppearanceSection.vue`, `FontsSection.vue`, `BehaviorSection.vue` (rewrite), `StructureSection.vue` (rewrite), `FeaturesSection.vue` (rewrite), `ShortcutsSection.vue` (rewrite), `SitesSection.vue`, `AdvancedSection.vue` (rewrite); `src/options/fields/ShortcutField.vue`, `src/options/ThemeEditor.vue`, `src/options/ThemeImport.vue`, `src/options/PreviewPane.vue`, `src/options/useFonts.ts`, `src/fonts/download.ts`, `src/settings/shortcuts.ts`, `src/settings/shortcuts.test.ts`, `src/i18n/messages/en.ts`, `src/i18n/messages/es.ts`, `e2e/i18n.spec.ts`

**Interfaces:**
- Consumes: `t`, `MessageKey`, `I18nText` (Task 2); `foldLevelLabel` (Task 3).
- Produces:
  - `src/settings/shortcuts.ts`: `SHORTCUT_LABELS` becomes `SHORTCUT_LABEL_KEYS: Record<ShortcutAction, MessageKey>` and `modifierHint(mac?)` returns a `MessageKey`. The module imports only the `MessageKey` type, so the background still loads no Vue.
  - Font download errors (`FontDownloadError` messages) are translated where they are thrown; the English texts are unchanged.
  - The "Duplicate & edit" buttons keep their accessible names ("Duplicate & edit dark theme") through a screen-reader-only span, not `aria-label`: `getByLabel('Dark theme')` must still find only the select.

- [ ] **Step 1: Write the failing tests**

Apply to `src/settings/shortcuts.test.ts`:

```diff
diff --git a/src/settings/shortcuts.test.ts b/src/settings/shortcuts.test.ts
index d3da4d5..e45befd 100644
--- a/src/settings/shortcuts.test.ts
+++ b/src/settings/shortcuts.test.ts
@@ -140,7 +140,7 @@ describe('on a Mac', () => {
   });
 
   it('names the modifiers in the hint', () => {
-    expect(modifierHint(true)).toBe('Use Cmd, Option or a function key (F1–F24).');
-    expect(modifierHint(false)).toBe('Use Ctrl, Alt or a function key (F1–F24).');
+    expect(modifierHint(true)).toBe('options.shortcuts.modifiersMac');
+    expect(modifierHint(false)).toBe('options.shortcuts.modifiers');
   });
 });
```

Apply to `e2e/i18n.spec.ts`:

```diff
diff --git a/e2e/i18n.spec.ts b/e2e/i18n.spec.ts
index 216049d..65cfbeb 100644
--- a/e2e/i18n.spec.ts
+++ b/e2e/i18n.spec.ts
@@ -9,6 +9,9 @@ test('the options page switches language live and saves the choice', async ({ co
   await expect(options.getByRole('link', { name: 'Apariencia' })).toBeVisible();
   await expect(options.locator('html')).toHaveAttribute('lang', 'es');
   await expect(options).toHaveTitle('Configuración de JSON Viewer');
+  await expect(options.getByRole('heading', { name: 'Comportamiento' })).toBeVisible();
+  await expect(options.getByRole('switch', { name: 'Ordenar las claves de los objetos' })).toBeVisible();
+  await expect(options.getByRole('button', { name: 'Exportar configuración' })).toBeVisible();
   await expect.poll(() => getStorage(context, 'sync', 'settings')).toMatchObject({ locale: 'es' });
   await options.getByLabel('Idioma').selectOption('auto');
   await expect(options.getByRole('link', { name: 'Appearance' })).toBeVisible();
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run: `pnpm exec vitest run src/settings/shortcuts.test.ts`
Expected: FAIL: `modifierHint` still returns the English sentence.

- [ ] **Step 3: Implement**

Apply to `src/i18n/messages/en.ts`:

```diff
diff --git a/src/i18n/messages/en.ts b/src/i18n/messages/en.ts
index 393e6e8..c17641e 100644
--- a/src/i18n/messages/en.ts
+++ b/src/i18n/messages/en.ts
@@ -43,6 +43,155 @@ export const en = {
   'options.about.licenses': 'Built-in themes are converted from VS Code themes via tm-themes; see their {link}.',
   'options.about.licensesLink': 'licenses',
 
+  'options.preview.toggle': 'Preview: switch between light and dark',
+
+  'options.appearance.mode': 'Theme mode',
+  'options.appearance.mode.auto': 'Follow the system',
+  'options.appearance.mode.light': 'Always light',
+  'options.appearance.mode.dark': 'Always dark',
+  'options.appearance.lightTheme': 'Light theme',
+  'options.appearance.darkTheme': 'Dark theme',
+  'options.appearance.group.light': 'Light themes',
+  'options.appearance.group.dark': 'Dark themes',
+  'options.appearance.group.custom': 'Custom',
+  'options.appearance.customOption': '{name} ({type})',
+  'options.appearance.missing': 'Missing theme ({id}) — using {fallback}',
+  'options.appearance.duplicate': 'Duplicate & edit',
+  'options.appearance.duplicateLight': 'Duplicate & edit light theme',
+  'options.appearance.duplicateDark': 'Duplicate & edit dark theme',
+  'options.appearance.customThemes': 'Custom themes',
+  'options.appearance.edit': 'Edit',
+  'options.appearance.editTheme': 'Edit {name}',
+  'options.appearance.export': 'Export',
+  'options.appearance.exportTheme': 'Export {name}',
+  'options.appearance.delete': 'Delete',
+  'options.appearance.deleteTheme': 'Delete {name}',
+  'options.appearance.confirmDelete': 'Delete “{name}”?',
+  'options.theme.typeDark': 'dark',
+  'options.theme.typeLight': 'light',
+
+  'options.import.title': 'Import a VS Code theme',
+  'options.import.hint':
+    "Paste a color theme's JSON (the {file} file of a VS Code theme extension) or choose the file.",
+  'options.import.json': 'VS Code theme JSON',
+  'options.import.button': 'Import',
+  'options.import.chooseFile': 'Choose file…',
+  'options.import.done': 'Imported “{name}” as a {type} theme.',
+
+  'options.editor.label': 'Theme editor',
+  'options.editor.new': 'New theme',
+  'options.editor.edit': 'Edit theme',
+  'options.editor.copyName': '{name} (copy)',
+  'options.editor.name': 'Theme name',
+  'options.editor.type': 'Type',
+  'options.editor.dark': 'Dark',
+  'options.editor.light': 'Light',
+  'options.editor.picker': '{key} picker',
+  'options.editor.hex': '{key} hex',
+  'options.editor.derived': 'derived',
+  'options.editor.json': 'Theme JSON',
+  'options.editor.invalidColor': 'Invalid color for {key}: use #rgb, #rgba, #rrggbb or #rrggbbaa',
+  'options.editor.invalidJson': 'Invalid JSON: {reason}',
+  'options.editor.save': 'Save theme',
+  'options.editor.cancel': 'Cancel',
+
+  'options.fonts.source': 'Font source',
+  'options.fonts.source.system': 'Installed on this computer',
+  'options.fonts.source.google': 'Google Fonts (downloaded once, then works offline)',
+  'options.fonts.family': 'Font family',
+  'options.fonts.family.googlePlaceholder': 'e.g. JetBrains Mono',
+  'options.fonts.family.systemPlaceholder': 'Default monospace font',
+  'options.fonts.family.googleHint': 'Pick a suggestion or type any Google Fonts family.',
+  'options.fonts.family.systemHint': 'A font installed on this computer, e.g. Cascadia Code. Leave empty for the default.',
+  'options.fonts.family.invalid': 'Use letters, numbers, spaces, dots, dashes or underscores.',
+  'options.fonts.subsets': 'Character sets to download',
+  'options.fonts.download': 'Download',
+  'options.fonts.downloading': 'Downloading…',
+  'options.fonts.downloadAgain': 'Download again',
+  'options.fonts.downloaded': 'Downloaded ({size})',
+  'options.fonts.notDownloaded': 'Not downloaded yet',
+  'options.fonts.size': 'Font size (px)',
+  'options.fonts.lineHeight': 'Line height',
+  'options.fonts.weight': 'Font weight',
+  'options.fonts.weight.300': 'Light',
+  'options.fonts.weight.400': 'Regular',
+  'options.fonts.weight.500': 'Medium',
+  'options.fonts.weight.600': 'Semibold',
+  'options.fonts.weightOption': '{name} ({weight})',
+  'options.fonts.ligatures': 'Font ligatures',
+  'options.fonts.ligaturesHint': 'Joins character pairs such as => in fonts that have them.',
+  'options.fonts.downloadedList': 'Downloaded fonts',
+  'options.fonts.none': 'None yet.',
+  'options.fonts.delete': 'Delete',
+  'options.fonts.deleteFamily': 'Delete {family}',
+  'options.fonts.confirmDelete': 'Delete the downloaded font "{family}"?',
+  'options.fonts.saveFailed': 'Could not save the font: {reason}',
+  'options.fonts.deleteFailed': 'Could not delete the font: {reason}',
+  'options.fonts.error.offline': 'Could not reach Google Fonts. Check your connection.',
+  'options.fonts.error.unknownFamily':
+    '"{family}" is not a Google Fonts family. Names are case-sensitive, e.g. "JetBrains Mono".',
+  'options.fonts.error.status': 'Google Fonts answered {status}.',
+  'options.fonts.error.noFiles': '"{family}" has no files for the selected character sets.',
+  'options.fonts.error.fileStatus': 'Font file download failed ({status}).',
+  'options.fonts.error.tooLarge': '"{family}" is larger than 2 MB; choose fewer character sets.',
+
+  'options.behavior.showHeader': 'Show URL and load time in the toolbar',
+  'options.behavior.autoHighlight': 'Format JSON automatically',
+  'options.behavior.autoHighlightHint': 'When off, pages open on the Raw tab.',
+  'options.behavior.sortKeys': 'Sort object keys',
+  'options.behavior.clickableUrls': 'Make URLs clickable',
+  'options.behavior.anchors': 'Render URLs as real links',
+  'options.behavior.anchorsHint': 'Enables right-click › Copy link address.',
+  'options.behavior.newTab': 'Open links in a new tab',
+
+  'options.structure.tabSize': 'Indent size (spaces)',
+  'options.structure.lineNumbers': 'Show line numbers',
+  'options.structure.lineWrapping': 'Wrap long lines',
+  'options.structure.foldGutter': 'Show fold arrows',
+  'options.structure.foldOnOpen': 'Fold on open',
+  'options.structure.foldOff': 'Off',
+  'options.structure.foldHint': '“Show 1 level” is the original extension’s “alwaysFold”.',
+  'options.structure.arraySize': 'Show item counts on folded blocks',
+  'options.structure.cStyle': 'C-style braces',
+  'options.structure.cStyleHint': 'Opening braces on their own line.',
+
+  'options.features.jsonPath': 'JSONPath filter',
+  'options.features.jsonPathHint': 'The filter box in the toolbar.',
+  'options.features.colorSwatches': 'Color swatches',
+  'options.features.colorSwatchesHint': 'A small square next to values like #ff5500 or rgb(0, 128, 255).',
+  'options.features.dateTooltips': 'Date tooltips',
+  'options.features.dateTooltipsHint': 'Hover a Unix time or an ISO 8601 date to see it in local time and UTC.',
+  'options.features.imagePreview': 'Image previews',
+  'options.features.imagePreviewHint': 'Hover an image URL to see it. The image is loaded from its site.',
+  'options.features.lightMode': 'Light mode above (MB)',
+  'options.features.lightModeHint': 'Bigger documents skip color swatches and date and image previews.',
+
+  'options.shortcuts.hint':
+    'Click a shortcut and press the new keys. Backspace removes it, Esc cancels. Search, folding and the cursor path work on the Code tab.',
+  'options.shortcuts.action.search': 'Search',
+  'options.shortcuts.action.filter': 'JSONPath filter',
+  'options.shortcuts.action.toggleRaw': 'Toggle Raw',
+  'options.shortcuts.action.foldAll': 'Fold all',
+  'options.shortcuts.action.unfoldAll': 'Unfold all',
+  'options.shortcuts.action.copyPath': 'Copy cursor path',
+  'options.shortcuts.keyLabel': '{action} shortcut',
+  'options.shortcuts.reset': 'Reset',
+  'options.shortcuts.resetLabel': 'Reset {action} shortcut',
+  'options.shortcuts.recording': 'Press keys…',
+  'options.shortcuts.none': 'None',
+  'options.shortcuts.conflict': 'Also assigned to {action}.',
+  'options.shortcuts.modifiers': 'Use Ctrl, Alt or a function key (F1–F24).',
+  'options.shortcuts.modifiersMac': 'Use Cmd, Option or a function key (F1–F24).',
+
+  'options.sites.label': "Don't open the viewer on",
+  'options.sites.hint':
+    'One host per line. *.example.com also matches example.com, and * matches anything. Right-click a page and choose View as JSON to open it there anyway.',
+  'options.sites.invalid': 'Not a host, left out: {hosts}',
+  'options.sites.dropped': 'Only the first {max} hosts are kept.',
+
+  'options.advanced.hint':
+    'Custom CSS for the viewer. Useful selectors: {selectors}. Variables: {variables}… Font variables ({fontVariables}…) come from the Fonts section; add {important} to override them here.',
+
   'viewer.mode.code': 'Code',
   'viewer.mode.raw': 'Raw',
   'viewer.fold.group': 'Folding',
```

Apply to `src/i18n/messages/es.ts`:

```diff
diff --git a/src/i18n/messages/es.ts b/src/i18n/messages/es.ts
index be289eb..c46270d 100644
--- a/src/i18n/messages/es.ts
+++ b/src/i18n/messages/es.ts
@@ -45,6 +45,156 @@ export const es: Messages = {
   'options.about.licenses': 'Los temas incluidos se convierten desde temas de VS Code con tm-themes; consulta sus {link}.',
   'options.about.licensesLink': 'licencias',
 
+  'options.preview.toggle': 'Vista previa: alternar entre claro y oscuro',
+
+  'options.appearance.mode': 'Modo del tema',
+  'options.appearance.mode.auto': 'Seguir al sistema',
+  'options.appearance.mode.light': 'Siempre claro',
+  'options.appearance.mode.dark': 'Siempre oscuro',
+  'options.appearance.lightTheme': 'Tema claro',
+  'options.appearance.darkTheme': 'Tema oscuro',
+  'options.appearance.group.light': 'Temas claros',
+  'options.appearance.group.dark': 'Temas oscuros',
+  'options.appearance.group.custom': 'Personalizados',
+  'options.appearance.customOption': '{name} ({type})',
+  'options.appearance.missing': 'Tema que falta ({id}): se usa {fallback}',
+  'options.appearance.duplicate': 'Duplicar y editar',
+  'options.appearance.duplicateLight': 'Duplicar y editar el tema claro',
+  'options.appearance.duplicateDark': 'Duplicar y editar el tema oscuro',
+  'options.appearance.customThemes': 'Temas personalizados',
+  'options.appearance.edit': 'Editar',
+  'options.appearance.editTheme': 'Editar {name}',
+  'options.appearance.export': 'Exportar',
+  'options.appearance.exportTheme': 'Exportar {name}',
+  'options.appearance.delete': 'Eliminar',
+  'options.appearance.deleteTheme': 'Eliminar {name}',
+  'options.appearance.confirmDelete': '¿Eliminar «{name}»?',
+  'options.theme.typeDark': 'oscuro',
+  'options.theme.typeLight': 'claro',
+
+  'options.import.title': 'Importar un tema de VS Code',
+  'options.import.hint':
+    'Pega el JSON de un tema de color (el archivo {file} de una extensión de temas de VS Code) o elige el archivo.',
+  'options.import.json': 'JSON del tema de VS Code',
+  'options.import.button': 'Importar',
+  'options.import.chooseFile': 'Elegir archivo…',
+  'options.import.done': 'Se importó «{name}» como tema {type}.',
+
+  'options.editor.label': 'Editor de temas',
+  'options.editor.new': 'Tema nuevo',
+  'options.editor.edit': 'Editar tema',
+  'options.editor.copyName': '{name} (copia)',
+  'options.editor.name': 'Nombre del tema',
+  'options.editor.type': 'Tipo',
+  'options.editor.dark': 'Oscuro',
+  'options.editor.light': 'Claro',
+  'options.editor.picker': 'Selector de {key}',
+  'options.editor.hex': '{key} en hexadecimal',
+  'options.editor.derived': 'derivado',
+  'options.editor.json': 'JSON del tema',
+  'options.editor.invalidColor': 'Color no válido para {key}: usa #rgb, #rgba, #rrggbb o #rrggbbaa',
+  'options.editor.invalidJson': 'JSON no válido: {reason}',
+  'options.editor.save': 'Guardar tema',
+  'options.editor.cancel': 'Cancelar',
+
+  'options.fonts.source': 'Origen de la fuente',
+  'options.fonts.source.system': 'Instalada en este equipo',
+  'options.fonts.source.google': 'Google Fonts (se descarga una vez y luego funciona sin conexión)',
+  'options.fonts.family': 'Familia',
+  'options.fonts.family.googlePlaceholder': 'p. ej. JetBrains Mono',
+  'options.fonts.family.systemPlaceholder': 'Fuente monoespaciada por defecto',
+  'options.fonts.family.googleHint': 'Elige una sugerencia o escribe cualquier familia de Google Fonts.',
+  'options.fonts.family.systemHint':
+    'Una fuente instalada en este equipo, p. ej. Cascadia Code. Déjalo vacío para usar la de por defecto.',
+  'options.fonts.family.invalid': 'Usa letras, números, espacios, puntos, guiones o guiones bajos.',
+  'options.fonts.subsets': 'Juegos de caracteres a descargar',
+  'options.fonts.download': 'Descargar',
+  'options.fonts.downloading': 'Descargando…',
+  'options.fonts.downloadAgain': 'Volver a descargar',
+  'options.fonts.downloaded': 'Descargada ({size})',
+  'options.fonts.notDownloaded': 'Aún no se ha descargado',
+  'options.fonts.size': 'Tamaño de la fuente (px)',
+  'options.fonts.lineHeight': 'Interlineado',
+  'options.fonts.weight': 'Grosor',
+  'options.fonts.weight.300': 'Fina',
+  'options.fonts.weight.400': 'Normal',
+  'options.fonts.weight.500': 'Media',
+  'options.fonts.weight.600': 'Seminegrita',
+  'options.fonts.weightOption': '{name} ({weight})',
+  'options.fonts.ligatures': 'Ligaduras',
+  'options.fonts.ligaturesHint': 'Une pares de caracteres como => en las fuentes que las tienen.',
+  'options.fonts.downloadedList': 'Fuentes descargadas',
+  'options.fonts.none': 'Ninguna todavía.',
+  'options.fonts.delete': 'Eliminar',
+  'options.fonts.deleteFamily': 'Eliminar {family}',
+  'options.fonts.confirmDelete': '¿Eliminar la fuente descargada «{family}»?',
+  'options.fonts.saveFailed': 'No se pudo guardar la fuente: {reason}',
+  'options.fonts.deleteFailed': 'No se pudo eliminar la fuente: {reason}',
+  'options.fonts.error.offline': 'No se pudo conectar con Google Fonts. Revisa tu conexión.',
+  'options.fonts.error.unknownFamily':
+    '«{family}» no es una familia de Google Fonts. Los nombres distinguen mayúsculas, p. ej. «JetBrains Mono».',
+  'options.fonts.error.status': 'Google Fonts respondió {status}.',
+  'options.fonts.error.noFiles': '«{family}» no tiene archivos para los juegos de caracteres elegidos.',
+  'options.fonts.error.fileStatus': 'Falló la descarga de un archivo de la fuente ({status}).',
+  'options.fonts.error.tooLarge': '«{family}» ocupa más de 2 MB; elige menos juegos de caracteres.',
+
+  'options.behavior.showHeader': 'Mostrar la URL y la hora de carga en la barra',
+  'options.behavior.autoHighlight': 'Formatear el JSON automáticamente',
+  'options.behavior.autoHighlightHint': 'Si está desactivado, las páginas se abren en la pestaña Texto.',
+  'options.behavior.sortKeys': 'Ordenar las claves de los objetos',
+  'options.behavior.clickableUrls': 'URLs clicables',
+  'options.behavior.anchors': 'Mostrar las URLs como enlaces de verdad',
+  'options.behavior.anchorsHint': 'Permite clic derecho › Copiar dirección del enlace.',
+  'options.behavior.newTab': 'Abrir los enlaces en una pestaña nueva',
+
+  'options.structure.tabSize': 'Sangría (espacios)',
+  'options.structure.lineNumbers': 'Mostrar números de línea',
+  'options.structure.lineWrapping': 'Ajustar las líneas largas',
+  'options.structure.foldGutter': 'Mostrar flechas de plegado',
+  'options.structure.foldOnOpen': 'Plegar al abrir',
+  'options.structure.foldOff': 'No',
+  'options.structure.foldHint': '«Mostrar 1 nivel» es el «alwaysFold» de la extensión original.',
+  'options.structure.arraySize': 'Mostrar el número de elementos en los bloques plegados',
+  'options.structure.cStyle': 'Llaves al estilo C',
+  'options.structure.cStyleHint': 'Las llaves de apertura van en su propia línea.',
+
+  'options.features.jsonPath': 'Filtro JSONPath',
+  'options.features.jsonPathHint': 'El cuadro de filtro de la barra superior.',
+  'options.features.colorSwatches': 'Muestras de color',
+  'options.features.colorSwatchesHint': 'Un cuadrito junto a valores como #ff5500 o rgb(0, 128, 255).',
+  'options.features.dateTooltips': 'Información de fechas',
+  'options.features.dateTooltipsHint': 'Pasa el ratón por un tiempo Unix o una fecha ISO 8601 para verla en hora local y UTC.',
+  'options.features.imagePreview': 'Vista previa de imágenes',
+  'options.features.imagePreviewHint': 'Pasa el ratón por la URL de una imagen para verla. La imagen se carga desde su sitio.',
+  'options.features.lightMode': 'Modo ligero a partir de (MB)',
+  'options.features.lightModeHint': 'Los documentos más grandes no muestran muestras de color ni vistas previas de fechas e imágenes.',
+
+  'options.shortcuts.hint':
+    'Haz clic en un atajo y pulsa las teclas nuevas. Retroceso lo quita y Esc cancela. La búsqueda, el plegado y la ruta del cursor funcionan en la pestaña Código.',
+  'options.shortcuts.action.search': 'Buscar',
+  'options.shortcuts.action.filter': 'Filtro JSONPath',
+  'options.shortcuts.action.toggleRaw': 'Alternar Texto',
+  'options.shortcuts.action.foldAll': 'Plegar todo',
+  'options.shortcuts.action.unfoldAll': 'Desplegar todo',
+  'options.shortcuts.action.copyPath': 'Copiar la ruta del cursor',
+  'options.shortcuts.keyLabel': 'Atajo de {action}',
+  'options.shortcuts.reset': 'Restablecer',
+  'options.shortcuts.resetLabel': 'Restablecer el atajo de {action}',
+  'options.shortcuts.recording': 'Pulsa las teclas…',
+  'options.shortcuts.none': 'Ninguno',
+  'options.shortcuts.conflict': 'También asignado a {action}.',
+  'options.shortcuts.modifiers': 'Usa Ctrl, Alt o una tecla de función (F1–F24).',
+  'options.shortcuts.modifiersMac': 'Usa Cmd, Opción o una tecla de función (F1–F24).',
+
+  'options.sites.label': 'No abrir el visor en',
+  'options.sites.hint':
+    'Un host por línea. *.example.com incluye example.com y * vale para cualquier cosa. Haz clic derecho en una página y elige Ver como JSON para abrirlo ahí de todos modos.',
+  'options.sites.invalid': 'No son hosts y se omiten: {hosts}',
+  'options.sites.dropped': 'Solo se guardan los primeros {max} hosts.',
+
+  'options.advanced.hint':
+    'CSS propio para el visor. Selectores útiles: {selectors}. Variables: {variables}… Las variables de fuente ({fontVariables}…) vienen de la sección Fuentes; añade {important} para cambiarlas aquí.',
+
   'viewer.mode.code': 'Código',
   'viewer.mode.raw': 'Texto',
   'viewer.fold.group': 'Plegado',
```

Apply to `src/settings/shortcuts.ts`:

```diff
diff --git a/src/settings/shortcuts.ts b/src/settings/shortcuts.ts
index daffeae..6df1749 100644
--- a/src/settings/shortcuts.ts
+++ b/src/settings/shortcuts.ts
@@ -1,3 +1,4 @@
+import type { MessageKey } from '@/i18n/translate';
 import { validateFields, type FieldValidator, type ObjectValidators } from './fields';
 
 export const SHORTCUT_ACTIONS = ['search', 'filter', 'toggleRaw', 'foldAll', 'unfoldAll', 'copyPath'] as const;
@@ -15,13 +16,14 @@ export const defaultShortcuts: Shortcuts = {
   copyPath: 'Ctrl+Shift+C',
 };
 
-export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
-  search: 'Search',
-  filter: 'JSONPath filter',
-  toggleRaw: 'Toggle Raw',
-  foldAll: 'Fold all',
-  unfoldAll: 'Unfold all',
-  copyPath: 'Copy cursor path',
+/** Message keys (src/i18n) naming each action; this module stays free of the UI's translation runtime. */
+export const SHORTCUT_LABEL_KEYS: Record<ShortcutAction, MessageKey> = {
+  search: 'options.shortcuts.action.search',
+  filter: 'options.shortcuts.action.filter',
+  toggleRaw: 'options.shortcuts.action.toggleRaw',
+  foldAll: 'options.shortcuts.action.foldAll',
+  unfoldAll: 'options.shortcuts.action.unfoldAll',
+  copyPath: 'options.shortcuts.action.copyPath',
 };
 
 const PUNCTUATION_KEYS: Record<string, string> = {
@@ -113,9 +115,9 @@ export function shortcutLabel(combo: string, mac = IS_MAC): string {
     .join('+');
 }
 
-/** Why a key press can't be a shortcut, naming this platform's modifiers. */
-export function modifierHint(mac = IS_MAC): string {
-  return mac ? 'Use Cmd, Option or a function key (F1–F24).' : 'Use Ctrl, Alt or a function key (F1–F24).';
+/** The message key saying why a key press can't be a shortcut, naming this platform's modifiers. */
+export function modifierHint(mac = IS_MAC): MessageKey {
+  return mac ? 'options.shortcuts.modifiersMac' : 'options.shortcuts.modifiers';
 }
 
 const COMBO = /^(Ctrl\+)?(Alt\+)?(Shift\+)?(Meta\+)?(.+)$/;
```

Replace `src/options/sections/ShortcutsSection.vue` with:

```vue
<script setup lang="ts">
import ShortcutField from '../fields/ShortcutField.vue';
import { t } from '@/i18n';
import {
  conflictWith,
  defaultShortcuts,
  SHORTCUT_ACTIONS,
  SHORTCUT_LABEL_KEYS,
  type ShortcutAction,
  type Shortcuts,
} from '@/settings/shortcuts';

const props = defineProps<{ shortcuts: Shortcuts }>();

function conflict(action: ShortcutAction): string | undefined {
  const other = conflictWith(props.shortcuts, action);
  return other === null ? undefined : t(SHORTCUT_LABEL_KEYS[other]);
}
</script>

<template>
  <section id="shortcuts" class="opt-section">
    <h2>{{ t('options.section.shortcuts') }}</h2>
    <p class="opt-hint">{{ t('options.shortcuts.hint') }}</p>
    <ShortcutField
      v-for="action in SHORTCUT_ACTIONS"
      :key="action"
      v-model="shortcuts[action]"
      :label="t(SHORTCUT_LABEL_KEYS[action])"
      :default-value="defaultShortcuts[action]"
      :conflict="conflict(action)"
    />
  </section>
</template>
```

Apply to `src/options/fields/ShortcutField.vue`:

```diff
diff --git a/src/options/fields/ShortcutField.vue b/src/options/fields/ShortcutField.vue
index 93d57a6..72467e6 100644
--- a/src/options/fields/ShortcutField.vue
+++ b/src/options/fields/ShortcutField.vue
@@ -1,5 +1,6 @@
 <script setup lang="ts">
 import { ref } from 'vue';
+import { t } from '@/i18n';
 import { comboFromEvent, IS_MAC, isValidShortcut, modifierHint, shortcutLabel } from '@/settings/shortcuts';
 
 const props = withDefaults(
@@ -59,20 +60,25 @@ function onKeyup(event: KeyboardEvent): void {
         type="button"
         class="opt-shortcut-key"
         :class="{ 'opt-recording': recording }"
-        :aria-label="`${label} shortcut`"
+        :aria-label="t('options.shortcuts.keyLabel', { action: label })"
         :aria-pressed="recording"
         @click="toggle"
         @keydown="onKeydown"
         @keyup="onKeyup"
         @blur="recording = false"
       >
-        {{ recording ? 'Press keys…' : model ? shortcutLabel(model, mac) : 'None' }}
+        {{ recording ? t('options.shortcuts.recording') : model ? shortcutLabel(model, mac) : t('options.shortcuts.none') }}
       </button>
-      <button v-if="model !== defaultValue" type="button" :aria-label="`Reset ${label} shortcut`" @click="model = defaultValue">
-        Reset
+      <button
+        v-if="model !== defaultValue"
+        type="button"
+        :aria-label="t('options.shortcuts.resetLabel', { action: label })"
+        @click="model = defaultValue"
+      >
+        {{ t('options.shortcuts.reset') }}
       </button>
     </div>
-    <small v-if="invalid" class="opt-hint opt-errors" role="alert">{{ modifierHint(mac) }}</small>
-    <small v-else-if="conflict" class="opt-hint opt-errors">Also assigned to {{ conflict }}.</small>
+    <small v-if="invalid" class="opt-hint opt-errors" role="alert">{{ t(modifierHint(mac)) }}</small>
+    <small v-else-if="conflict" class="opt-hint opt-errors">{{ t('options.shortcuts.conflict', { action: conflict }) }}</small>
   </div>
 </template>
```

Replace `src/options/sections/BehaviorSection.vue` with:

```vue
<script setup lang="ts">
import ToggleField from '../fields/ToggleField.vue';
import { t } from '@/i18n';
import type { ViewerOptions } from '@/viewer/options';

defineProps<{ viewer: ViewerOptions }>();
</script>

<template>
  <section id="behavior" class="opt-section">
    <h2>{{ t('options.section.behavior') }}</h2>
    <ToggleField v-model="viewer.showHeader" :label="t('options.behavior.showHeader')" />
    <ToggleField
      v-model="viewer.autoHighlight"
      :label="t('options.behavior.autoHighlight')"
      :hint="t('options.behavior.autoHighlightHint')"
    />
    <ToggleField v-model="viewer.sortKeys" :label="t('options.behavior.sortKeys')" />
    <ToggleField v-model="viewer.clickableUrls" :label="t('options.behavior.clickableUrls')" />
    <ToggleField
      v-model="viewer.wrapLinkWithAnchorTag"
      :label="t('options.behavior.anchors')"
      :hint="t('options.behavior.anchorsHint')"
    />
    <ToggleField v-model="viewer.openLinksInNewWindow" :label="t('options.behavior.newTab')" />
  </section>
</template>
```

Replace `src/options/sections/StructureSection.vue` with:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import NumberField from '../fields/NumberField.vue';
import SelectField from '../fields/SelectField.vue';
import ToggleField from '../fields/ToggleField.vue';
import type { SelectOption } from '../types';
import { t } from '@/i18n';
import { TAB_SIZE_MAX, TAB_SIZE_MIN } from '@/settings/schema';
import { foldLevelLabel } from '@/viewer/foldLevelLabel';
import { FOLD_LEVELS, type ViewerOptions } from '@/viewer/options';

const props = defineProps<{ viewer: ViewerOptions }>();

const foldOptions = computed<SelectOption[]>(() => [
  { value: '0', label: t('options.structure.foldOff') },
  ...FOLD_LEVELS.map((level) => ({ value: String(level), label: foldLevelLabel(level) })),
]);
const foldFromLevel = computed({
  get: () => String(props.viewer.foldFromLevel),
  set: (value: string) => {
    props.viewer.foldFromLevel = Number(value);
  },
});
</script>

<template>
  <section id="structure" class="opt-section">
    <h2>{{ t('options.section.structure') }}</h2>
    <NumberField v-model="viewer.tabSize" :label="t('options.structure.tabSize')" :min="TAB_SIZE_MIN" :max="TAB_SIZE_MAX" />
    <ToggleField v-model="viewer.lineNumbers" :label="t('options.structure.lineNumbers')" />
    <ToggleField v-model="viewer.lineWrapping" :label="t('options.structure.lineWrapping')" />
    <ToggleField v-model="viewer.foldGutter" :label="t('options.structure.foldGutter')" />
    <SelectField
      v-model="foldFromLevel"
      :label="t('options.structure.foldOnOpen')"
      :options="foldOptions"
      :hint="t('options.structure.foldHint')"
    />
    <ToggleField v-model="viewer.showArraySize" :label="t('options.structure.arraySize')" />
    <ToggleField v-model="viewer.indentCStyle" :label="t('options.structure.cStyle')" :hint="t('options.structure.cStyleHint')" />
  </section>
</template>
```

Replace `src/options/sections/FeaturesSection.vue` with:

```vue
<script setup lang="ts">
import NumberField from '../fields/NumberField.vue';
import ToggleField from '../fields/ToggleField.vue';
import { t } from '@/i18n';
import { LIGHT_MODE_MAX_MB, LIGHT_MODE_MIN_MB, type Features, type ViewerOptions } from '@/viewer/options';

defineProps<{ features: Features; viewer: ViewerOptions }>();
</script>

<template>
  <section id="features" class="opt-section">
    <h2>{{ t('options.section.features') }}</h2>
    <ToggleField v-model="features.jsonPath" :label="t('options.features.jsonPath')" :hint="t('options.features.jsonPathHint')" />
    <ToggleField
      v-model="features.colorSwatches"
      :label="t('options.features.colorSwatches')"
      :hint="t('options.features.colorSwatchesHint')"
    />
    <ToggleField
      v-model="features.dateTooltips"
      :label="t('options.features.dateTooltips')"
      :hint="t('options.features.dateTooltipsHint')"
    />
    <ToggleField
      v-model="features.imagePreview"
      :label="t('options.features.imagePreview')"
      :hint="t('options.features.imagePreviewHint')"
    />
    <NumberField
      v-model="viewer.lightModeThresholdMB"
      :label="t('options.features.lightMode')"
      :min="LIGHT_MODE_MIN_MB"
      :max="LIGHT_MODE_MAX_MB"
      :hint="t('options.features.lightModeHint')"
    />
  </section>
</template>
```

Replace `src/options/sections/AdvancedSection.vue` with:

```vue
<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { t } from '@/i18n';
import I18nText from '@/i18n/I18nText.vue';

// Split out with @codemirror/lang-css so the options entry chunk stays small.
const CssEditor = defineAsyncComponent(() => import('../CssEditor.vue'));

const customCss = defineModel<string>('customCss', { required: true });
</script>

<template>
  <section id="advanced" class="opt-section">
    <h2>{{ t('options.section.advanced') }}</h2>
    <p class="opt-hint">
      <I18nText k="options.advanced.hint">
        <template #selectors>
          <code>.jv-root</code>, <code>.jv-toolbar</code>, <code>.cm-editor</code>, <code>.cm-content</code>,
          <code>.cm-line</code>
        </template>
        <template #variables><code>--jv-key</code>, <code>--jv-string</code>, <code>--jv-background</code></template>
        <template #fontVariables><code>--jv-font-family</code>, <code>--jv-font-size</code></template>
        <template #important><code>!important</code></template>
      </I18nText>
    </p>
    <CssEditor v-model="customCss" />
  </section>
</template>
```

Apply to `src/options/sections/SitesSection.vue`:

```diff
diff --git a/src/options/sections/SitesSection.vue b/src/options/sections/SitesSection.vue
index e8c4ed5..cb49ea8 100644
--- a/src/options/sections/SitesSection.vue
+++ b/src/options/sections/SitesSection.vue
@@ -1,5 +1,6 @@
 <script setup lang="ts">
 import { ref, watch } from 'vue';
+import { t } from '@/i18n';
 import { MAX_EXCLUDED_HOSTS, parseHostList } from '@/settings/hosts';
 
 const hosts = defineModel<string[]>('hosts', { required: true });
@@ -31,9 +32,9 @@ function onChange(): void {
 
 <template>
   <section id="sites" class="opt-section">
-    <h2>Sites</h2>
+    <h2>{{ t('options.section.sites') }}</h2>
     <label class="opt-field">
-      <span class="opt-label">Don't open the viewer on</span>
+      <span class="opt-label">{{ t('options.sites.label') }}</span>
       <textarea
         v-model="text"
         rows="5"
@@ -42,14 +43,13 @@ function onChange(): void {
         @input="onInput"
         @change="onChange"
       />
-      <small class="opt-hint">
-        One host per line. *.example.com also matches example.com, and * matches anything. Right-click a page and
-        choose View as JSON to open it there anyway.
-      </small>
+      <small class="opt-hint">{{ t('options.sites.hint') }}</small>
     </label>
     <p v-if="invalid.length > 0" class="opt-hint opt-errors" role="alert">
-      Not a host, left out: {{ invalid.join(', ') }}
+      {{ t('options.sites.invalid', { hosts: invalid.join(', ') }) }}
+    </p>
+    <p v-if="dropped > 0" class="opt-hint opt-errors" role="alert">
+      {{ t('options.sites.dropped', { max: MAX_EXCLUDED_HOSTS }) }}
     </p>
-    <p v-if="dropped > 0" class="opt-hint opt-errors" role="alert">Only the first {{ MAX_EXCLUDED_HOSTS }} hosts are kept.</p>
   </section>
 </template>
```

Apply to `src/options/sections/AppearanceSection.vue`:

```diff
diff --git a/src/options/sections/AppearanceSection.vue b/src/options/sections/AppearanceSection.vue
index a883538..63445a1 100644
--- a/src/options/sections/AppearanceSection.vue
+++ b/src/options/sections/AppearanceSection.vue
@@ -1,5 +1,6 @@
 <script setup lang="ts">
 import { computed } from 'vue';
+import { t } from '@/i18n';
 import SelectField from '../fields/SelectField.vue';
 import ThemeImport from '../ThemeImport.vue';
 import ThemeSwatch from '../ThemeSwatch.vue';
@@ -13,23 +14,33 @@ import type { Theme } from '@/themes/types';
 const props = defineProps<{ settings: Settings; customThemes: Theme[]; editing?: boolean }>();
 const emit = defineEmits<{ edit: [theme: Theme, isNew: boolean, slot: ThemeSlot | null] }>();
 
-const modeOptions: SelectOption[] = [
-  { value: 'auto', label: 'Follow the system' },
-  { value: 'light', label: 'Always light' },
-  { value: 'dark', label: 'Always dark' },
-];
+const modeOptions = computed<SelectOption[]>(() => [
+  { value: 'auto', label: t('options.appearance.mode.auto') },
+  { value: 'light', label: t('options.appearance.mode.light') },
+  { value: 'dark', label: t('options.appearance.mode.dark') },
+]);
+
+const typeName = (theme: Theme) => t(theme.type === 'dark' ? 'options.theme.typeDark' : 'options.theme.typeLight');
 
 const themeOptions = computed<SelectOption[]>(() => [
-  ...builtinThemes.filter((t) => t.type === 'light').map((t) => ({ value: t.id, label: t.name, group: 'Light themes' })),
-  ...builtinThemes.filter((t) => t.type === 'dark').map((t) => ({ value: t.id, label: t.name, group: 'Dark themes' })),
-  ...props.customThemes.map((t) => ({ value: t.id, label: `${t.name} (${t.type})`, group: 'Custom' })),
+  ...builtinThemes
+    .filter((theme) => theme.type === 'light')
+    .map((theme) => ({ value: theme.id, label: theme.name, group: t('options.appearance.group.light') })),
+  ...builtinThemes
+    .filter((theme) => theme.type === 'dark')
+    .map((theme) => ({ value: theme.id, label: theme.name, group: t('options.appearance.group.dark') })),
+  ...props.customThemes.map((theme) => ({
+    value: theme.id,
+    label: t('options.appearance.customOption', { name: theme.name, type: typeName(theme) }),
+    group: t('options.appearance.group.custom'),
+  })),
 ]);
 
 const known = (id: string) => builtinThemes.some((t) => t.id === id) || props.customThemes.some((t) => t.id === id);
 /** A stored id that no longer exists would leave the <select> blank, so list it as a disabled "missing" option. */
 function withMissing(id: string, fallback: string): SelectOption[] {
   if (known(id)) return themeOptions.value;
-  return [{ value: id, label: `Missing theme (${id}) — using ${fallback}`, disabled: true }, ...themeOptions.value];
+  return [{ value: id, label: t('options.appearance.missing', { id, fallback }), disabled: true }, ...themeOptions.value];
 }
 const lightOptions = computed(() => withMissing(props.settings.lightThemeId, 'Light+'));
 const darkOptions = computed(() => withMissing(props.settings.darkThemeId, 'Dark+'));
@@ -54,7 +65,7 @@ function exportTheme(theme: Theme): void {
 }
 
 async function remove(theme: Theme): Promise<void> {
-  if (!window.confirm(`Delete “${theme.name}”?`)) return;
+  if (!window.confirm(t('options.appearance.confirmDelete', { name: theme.name }))) return;
   await deleteCustomTheme(theme.id);
   if (props.settings.lightThemeId === theme.id) props.settings.lightThemeId = defaultSettings.lightThemeId;
   if (props.settings.darkThemeId === theme.id) props.settings.darkThemeId = defaultSettings.darkThemeId;
@@ -63,28 +74,45 @@ async function remove(theme: Theme): Promise<void> {
 
 <template>
   <section id="appearance" class="opt-section">
-    <h2>Appearance</h2>
-    <SelectField v-model="settings.themeMode" label="Theme mode" :options="modeOptions" />
+    <h2>{{ t('options.section.appearance') }}</h2>
+    <SelectField v-model="settings.themeMode" :label="t('options.appearance.mode')" :options="modeOptions" />
     <div class="opt-theme-row">
-      <SelectField v-model="settings.lightThemeId" label="Light theme" :options="lightOptions" />
+      <SelectField v-model="settings.lightThemeId" :label="t('options.appearance.lightTheme')" :options="lightOptions" />
       <ThemeSwatch :theme="lightTheme" />
-      <button type="button" @click="emit('edit', lightTheme, true, 'light')">Duplicate &amp; edit<span class="opt-sr-only"> light theme</span></button>
+      <!-- The accessible name comes from text, not aria-label: getByLabel('Light theme') must find only the select. -->
+      <button type="button" @click="emit('edit', lightTheme, true, 'light')">
+        <span aria-hidden="true">{{ t('options.appearance.duplicate') }}</span>
+        <span class="opt-sr-only">{{ t('options.appearance.duplicateLight') }}</span>
+      </button>
     </div>
     <div class="opt-theme-row">
-      <SelectField v-model="settings.darkThemeId" label="Dark theme" :options="darkOptions" />
+      <SelectField v-model="settings.darkThemeId" :label="t('options.appearance.darkTheme')" :options="darkOptions" />
       <ThemeSwatch :theme="darkTheme" />
-      <button type="button" @click="emit('edit', darkTheme, true, 'dark')">Duplicate &amp; edit<span class="opt-sr-only"> dark theme</span></button>
+      <button type="button" @click="emit('edit', darkTheme, true, 'dark')">
+        <span aria-hidden="true">{{ t('options.appearance.duplicate') }}</span>
+        <span class="opt-sr-only">{{ t('options.appearance.duplicateDark') }}</span>
+      </button>
     </div>
     <ThemeImport v-if="!editing" :taken-ids="takenIds" @imported="onImported" />
     <div v-if="customThemes.length" class="opt-custom-list">
-      <h3>Custom themes</h3>
+      <h3>{{ t('options.appearance.customThemes') }}</h3>
       <ul>
         <li v-for="theme in customThemes" :key="theme.id" class="opt-row">
           <ThemeSwatch :theme="theme" />
           <span>{{ theme.name }}</span>
-          <button type="button" :aria-label="`Edit ${theme.name}`" @click="emit('edit', theme, false, null)">Edit</button>
-          <button type="button" :aria-label="`Export ${theme.name}`" @click="exportTheme(theme)">Export</button>
-          <button type="button" :aria-label="`Delete ${theme.name}`" @click="remove(theme)">Delete</button>
+          <button
+            type="button"
+            :aria-label="t('options.appearance.editTheme', { name: theme.name })"
+            @click="emit('edit', theme, false, null)"
+          >
+            {{ t('options.appearance.edit') }}
+          </button>
+          <button type="button" :aria-label="t('options.appearance.exportTheme', { name: theme.name })" @click="exportTheme(theme)">
+            {{ t('options.appearance.export') }}
+          </button>
+          <button type="button" :aria-label="t('options.appearance.deleteTheme', { name: theme.name })" @click="remove(theme)">
+            {{ t('options.appearance.delete') }}
+          </button>
         </li>
       </ul>
     </div>
```

Apply to `src/options/ThemeImport.vue`:

```diff
diff --git a/src/options/ThemeImport.vue b/src/options/ThemeImport.vue
index 4e4702c..bb4a6b1 100644
--- a/src/options/ThemeImport.vue
+++ b/src/options/ThemeImport.vue
@@ -1,5 +1,7 @@
 <script setup lang="ts">
 import { ref } from 'vue';
+import { t } from '@/i18n';
+import I18nText from '@/i18n/I18nText.vue';
 import { saveCustomTheme, uniqueThemeId } from '@/themes/store';
 import type { Theme } from '@/themes/types';
 
@@ -27,7 +29,10 @@ async function importTheme(input: string | File): Promise<void> {
     const theme: Theme = { ...result.theme, id: uniqueThemeId(result.theme.name, props.takenIds) };
     await saveCustomTheme(theme);
     warnings.value = result.warnings;
-    message.value = `Imported “${theme.name}” as a ${theme.type} theme.`;
+    message.value = t('options.import.done', {
+      name: theme.name,
+      type: t(theme.type === 'dark' ? 'options.theme.typeDark' : 'options.theme.typeLight'),
+    });
     text.value = '';
     emit('imported', theme);
   } catch (error) {
@@ -47,18 +52,22 @@ async function onFile(event: Event): Promise<void> {
 
 <template>
   <div class="opt-import">
-    <h3>Import a VS Code theme</h3>
+    <h3>{{ t('options.import.title') }}</h3>
     <p class="opt-hint">
-      Paste a color theme's JSON (the <code>themes/*.json</code> file of a VS Code theme extension) or choose the file.
+      <I18nText k="options.import.hint">
+        <template #file><code>themes/*.json</code></template>
+      </I18nText>
     </p>
     <label class="opt-field">
-      <span class="opt-label">VS Code theme JSON</span>
+      <span class="opt-label">{{ t('options.import.json') }}</span>
       <textarea v-model="text" rows="6" spellcheck="false" />
     </label>
     <div class="opt-row">
-      <button type="button" :disabled="!text.trim() || importing" @click="importTheme(text)">Import</button>
+      <button type="button" :disabled="!text.trim() || importing" @click="importTheme(text)">
+        {{ t('options.import.button') }}
+      </button>
       <label class="opt-file">
-        Choose file…
+        {{ t('options.import.chooseFile') }}
         <input type="file" accept=".json,.jsonc,application/json" @change="onFile" />
       </label>
     </div>
```

Apply to `src/options/ThemeEditor.vue`:

```diff
diff --git a/src/options/ThemeEditor.vue b/src/options/ThemeEditor.vue
index 435bfd2..09e8ef1 100644
--- a/src/options/ThemeEditor.vue
+++ b/src/options/ThemeEditor.vue
@@ -1,5 +1,6 @@
 <script setup lang="ts">
 import { computed, ref, watch } from 'vue';
+import { t } from '@/i18n';
 import { parseHex, toHex } from '@/themes/color';
 import { resolveColors } from '@/themes/resolve';
 import { saveCustomTheme, uniqueThemeId } from '@/themes/store';
@@ -13,7 +14,7 @@ const clone = (theme: Theme): Theme => JSON.parse(JSON.stringify(theme)) as Them
 const start = clone(props.initial);
 const draft = ref<Theme>({
   ...start,
-  name: props.isNew ? `${start.name} (copy)` : start.name,
+  name: props.isNew ? t('options.editor.copyName', { name: start.name }) : start.name,
   source: 'custom',
 });
 
@@ -58,7 +59,7 @@ function setColor(key: ThemeColorKey, input: HTMLInputElement): void {
   if (hex === null) {
     // Vue won't repatch an unchanged :value, so restore the field by hand.
     input.value = draft.value.colors[key] ?? '';
-    colorError.value = `Invalid color for ${key}: use #rgb, #rgba, #rrggbb or #rrggbbaa`;
+    colorError.value = t('options.editor.invalidColor', { key });
     return;
   }
   colorError.value = '';
@@ -70,7 +71,7 @@ function onJsonInput(): void {
   try {
     parsed = JSON.parse(jsonText.value);
   } catch (error) {
-    jsonErrors.value = [`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`];
+    jsonErrors.value = [t('options.editor.invalidJson', { reason: error instanceof Error ? error.message : String(error) })];
     return;
   }
   const result = parseCompactTheme({ ...(parsed as object), id: draft.value.id, source: 'custom' });
@@ -101,17 +102,17 @@ async function save(): Promise<void> {
 </script>
 
 <template>
-  <section class="opt-editor" aria-label="Theme editor">
-    <h3>{{ isNew ? 'New theme' : 'Edit theme' }}</h3>
+  <section class="opt-editor" :aria-label="t('options.editor.label')">
+    <h3>{{ isNew ? t('options.editor.new') : t('options.editor.edit') }}</h3>
     <label class="opt-field">
-      <span class="opt-label">Theme name</span>
+      <span class="opt-label">{{ t('options.editor.name') }}</span>
       <input v-model="draft.name" type="text" />
     </label>
     <label class="opt-field">
-      <span class="opt-label">Type</span>
+      <span class="opt-label">{{ t('options.editor.type') }}</span>
       <select v-model="draft.type">
-        <option value="dark">Dark</option>
-        <option value="light">Light</option>
+        <option value="dark">{{ t('options.editor.dark') }}</option>
+        <option value="light">{{ t('options.editor.light') }}</option>
       </select>
     </label>
     <div class="opt-color-grid">
@@ -119,23 +120,23 @@ async function save(): Promise<void> {
         <span class="opt-color-name">{{ key }}</span>
         <input
           type="color"
-          :aria-label="`${key} picker`"
+          :aria-label="t('options.editor.picker', { key })"
           :value="resolved[key].slice(0, 7)"
           @input="setColor(key, $event.target as HTMLInputElement)"
         />
         <input
           type="text"
-          :aria-label="`${key} hex`"
+          :aria-label="t('options.editor.hex', { key })"
           :value="draft.colors[key] ?? ''"
           :placeholder="resolved[key]"
           spellcheck="false"
           @change="setColor(key, $event.target as HTMLInputElement)"
         />
-        <small v-if="!draft.colors[key]" class="opt-hint">derived</small>
+        <small v-if="!draft.colors[key]" class="opt-hint">{{ t('options.editor.derived') }}</small>
       </div>
     </div>
     <label class="opt-field">
-      <span class="opt-label">Theme JSON</span>
+      <span class="opt-label">{{ t('options.editor.json') }}</span>
       <textarea v-model="jsonText" rows="12" spellcheck="false" @input="onJsonInput" />
     </label>
     <ul v-if="jsonErrors.length" class="opt-errors" role="alert">
@@ -144,8 +145,8 @@ async function save(): Promise<void> {
     <p v-if="colorError" class="opt-errors" role="alert">{{ colorError }}</p>
     <p v-if="saveError" class="opt-errors" role="alert">{{ saveError }}</p>
     <div class="opt-row">
-      <button type="button" :disabled="!canSave" @click="save">Save theme</button>
-      <button type="button" @click="emit('cancel')">Cancel</button>
+      <button type="button" :disabled="!canSave" @click="save">{{ t('options.editor.save') }}</button>
+      <button type="button" @click="emit('cancel')">{{ t('options.editor.cancel') }}</button>
     </div>
   </section>
 </template>
```

Apply to `src/options/PreviewPane.vue`:

```diff
diff --git a/src/options/PreviewPane.vue b/src/options/PreviewPane.vue
index 522e765..2cab73d 100644
--- a/src/options/PreviewPane.vue
+++ b/src/options/PreviewPane.vue
@@ -2,6 +2,7 @@
 import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
 import { SAMPLE_JSON, SAMPLE_URL } from './sample';
 import JsonViewer from '@/components/JsonViewer.vue';
+import { t } from '@/i18n';
 import ViewerShadowRoot from '@/components/ViewerShadowRoot.vue';
 import { createFontLoader } from '@/fonts/loader';
 import { trackStoredFont } from '@/fonts/track';
@@ -65,7 +66,7 @@ function toggleTheme(): void {
         :kind="kind"
         :custom-css="customCss"
         :source="source"
-        toggle-label="Preview: switch between light and dark"
+        :toggle-label="t('options.preview.toggle')"
         @toggle-theme="toggleTheme"
       />
     </ViewerShadowRoot>
```

Apply to `src/options/sections/FontsSection.vue`:

```diff
diff --git a/src/options/sections/FontsSection.vue b/src/options/sections/FontsSection.vue
index 2ddded7..9b9aa33 100644
--- a/src/options/sections/FontsSection.vue
+++ b/src/options/sections/FontsSection.vue
@@ -5,6 +5,7 @@ import SelectField from '../fields/SelectField.vue';
 import ToggleField from '../fields/ToggleField.vue';
 import { useFonts } from '../useFonts';
 import { canonicalFamily, FONT_CATALOG } from '@/fonts/catalog';
+import { t, type MessageKey } from '@/i18n';
 import {
   FONT_FAMILY_PATTERN,
   FONT_SIZE_MAX,
@@ -19,12 +20,19 @@ import {
 const props = defineProps<{ font: FontSettings }>();
 const { fonts, busy, error, download, remove } = useFonts();
 
-const sourceOptions = [
-  { value: 'system', label: 'Installed on this computer' },
-  { value: 'google', label: 'Google Fonts (downloaded once, then works offline)' },
-];
-const weightLabels: Record<number, string> = { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold' };
-const weightOptions = FONT_WEIGHTS.map((weight) => ({ value: String(weight), label: `${weightLabels[weight]} (${weight})` }));
+const sourceOptions = computed(() => [
+  { value: 'system', label: t('options.fonts.source.system') },
+  { value: 'google', label: t('options.fonts.source.google') },
+]);
+const weightOptions = computed(() =>
+  FONT_WEIGHTS.map((weight) => ({
+    value: String(weight),
+    label: t('options.fonts.weightOption', {
+      name: t(`options.fonts.weight.${weight}` as MessageKey),
+      weight: String(weight),
+    }),
+  })),
+);
 const weight = computed({
   get: () => String(props.font.weight),
   set: (value: string) => {
@@ -51,37 +59,35 @@ async function onDownload(): Promise<void> {
 }
 
 async function onDelete(family: string): Promise<void> {
-  if (window.confirm(`Delete the downloaded font "${family}"?`)) await remove(family);
+  if (window.confirm(t('options.fonts.confirmDelete', { family }))) await remove(family);
 }
 </script>
 
 <template>
   <section id="fonts" class="opt-section">
-    <h2>Fonts</h2>
-    <SelectField v-model="font.source" label="Font source" :options="sourceOptions" />
+    <h2>{{ t('options.section.fonts') }}</h2>
+    <SelectField v-model="font.source" :label="t('options.fonts.source')" :options="sourceOptions" />
     <label class="opt-field">
-      <span class="opt-label">Font family</span>
+      <span class="opt-label">{{ t('options.fonts.family') }}</span>
       <input
         v-model.trim="font.family"
         type="text"
         spellcheck="false"
         @change="canonicalize"
         :list="isGoogle ? 'font-catalog' : undefined"
-        :placeholder="isGoogle ? 'e.g. JetBrains Mono' : 'Default monospace font'"
+        :placeholder="isGoogle ? t('options.fonts.family.googlePlaceholder') : t('options.fonts.family.systemPlaceholder')"
       />
       <small class="opt-hint">{{
-        isGoogle
-          ? 'Pick a suggestion or type any Google Fonts family.'
-          : 'A font installed on this computer, e.g. Cascadia Code. Leave empty for the default.'
+        isGoogle ? t('options.fonts.family.googleHint') : t('options.fonts.family.systemHint')
       }}</small>
     </label>
     <datalist id="font-catalog">
       <option v-for="family in FONT_CATALOG" :key="family" :value="family" />
     </datalist>
-    <p v-if="!familyValid" class="opt-errors" role="alert">Use letters, numbers, spaces, dots, dashes or underscores.</p>
+    <p v-if="!familyValid" class="opt-errors" role="alert">{{ t('options.fonts.family.invalid') }}</p>
     <template v-if="isGoogle">
       <fieldset class="opt-field opt-subsets">
-        <legend class="opt-label">Character sets to download</legend>
+        <legend class="opt-label">{{ t('options.fonts.subsets') }}</legend>
         <label v-for="subset in FONT_SUBSETS" :key="subset" class="opt-subset">
           <input v-model="font.subsets" type="checkbox" :value="subset" />
           {{ subset }}
@@ -89,23 +95,41 @@ async function onDelete(family: string): Promise<void> {
       </fieldset>
       <div class="opt-row">
         <button type="button" :disabled="!canDownload" @click="onDownload">
-          {{ busy ? 'Downloading…' : downloaded ? 'Download again' : 'Download' }}
+          {{
+            busy
+              ? t('options.fonts.downloading')
+              : downloaded
+                ? t('options.fonts.downloadAgain')
+                : t('options.fonts.download')
+          }}
         </button>
         <span class="opt-hint" role="status">{{
-          downloaded ? `Downloaded (${kb(downloaded.bytes)})` : font.family ? 'Not downloaded yet' : ''
+          downloaded
+            ? t('options.fonts.downloaded', { size: kb(downloaded.bytes) })
+            : font.family
+              ? t('options.fonts.notDownloaded')
+              : ''
         }}</span>
       </div>
     </template>
-    <NumberField v-model="font.sizePx" label="Font size (px)" :min="FONT_SIZE_MIN" :max="FONT_SIZE_MAX" />
-    <NumberField v-model="font.lineHeight" label="Line height" :min="LINE_HEIGHT_MIN" :max="LINE_HEIGHT_MAX" :step="0.1" />
-    <SelectField v-model="weight" label="Font weight" :options="weightOptions" />
-    <ToggleField v-model="font.ligatures" label="Font ligatures" hint="Joins character pairs such as => in fonts that have them." />
-    <h3 class="opt-subheading">Downloaded fonts</h3>
-    <p v-if="fonts.length === 0" class="opt-hint">None yet.</p>
+    <NumberField v-model="font.sizePx" :label="t('options.fonts.size')" :min="FONT_SIZE_MIN" :max="FONT_SIZE_MAX" />
+    <NumberField
+      v-model="font.lineHeight"
+      :label="t('options.fonts.lineHeight')"
+      :min="LINE_HEIGHT_MIN"
+      :max="LINE_HEIGHT_MAX"
+      :step="0.1"
+    />
+    <SelectField v-model="weight" :label="t('options.fonts.weight')" :options="weightOptions" />
+    <ToggleField v-model="font.ligatures" :label="t('options.fonts.ligatures')" :hint="t('options.fonts.ligaturesHint')" />
+    <h3 class="opt-subheading">{{ t('options.fonts.downloadedList') }}</h3>
+    <p v-if="fonts.length === 0" class="opt-hint">{{ t('options.fonts.none') }}</p>
     <ul v-else class="opt-font-list">
       <li v-for="item in fonts" :key="item.family">
         <span>{{ item.family }} · {{ kb(item.bytes) }}</span>
-        <button type="button" :aria-label="`Delete ${item.family}`" @click="onDelete(item.family)">Delete</button>
+        <button type="button" :aria-label="t('options.fonts.deleteFamily', { family: item.family })" @click="onDelete(item.family)">
+          {{ t('options.fonts.delete') }}
+        </button>
       </li>
     </ul>
     <p v-if="error" class="opt-errors" role="alert">{{ error }}</p>
```

Apply to `src/options/useFonts.ts`:

```diff
diff --git a/src/options/useFonts.ts b/src/options/useFonts.ts
index 3c260c8..5163a22 100644
--- a/src/options/useFonts.ts
+++ b/src/options/useFonts.ts
@@ -1,5 +1,6 @@
 import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
 import { downloadFont, FontDownloadError } from '@/fonts/download';
+import { t } from '@/i18n';
 import { deleteFont, listFonts, saveFont, watchFontIndex } from '@/fonts/store';
 import type { FontSummary, StoredFont } from '@/fonts/types';
 
@@ -41,7 +42,8 @@ export function useFonts(): FontsModel {
         return font;
       } catch (cause) {
         // Storage errors (e.g. the 10 MB local quota) are not download errors but still need a message.
-        error.value = cause instanceof FontDownloadError ? cause.message : `Could not save the font: ${describe(cause)}`;
+        error.value =
+          cause instanceof FontDownloadError ? cause.message : t('options.fonts.saveFailed', { reason: describe(cause) });
         return null;
       } finally {
         busy.value = false;
@@ -53,7 +55,7 @@ export function useFonts(): FontsModel {
         await deleteFont(family);
         await reload();
       } catch (cause) {
-        error.value = `Could not delete the font: ${describe(cause)}`;
+        error.value = t('options.fonts.deleteFailed', { reason: describe(cause) });
       }
     },
   };
```

Apply to `src/fonts/download.ts`:

```diff
diff --git a/src/fonts/download.ts b/src/fonts/download.ts
index 50e09f6..14212cc 100644
--- a/src/fonts/download.ts
+++ b/src/fonts/download.ts
@@ -1,3 +1,4 @@
+import { t } from '@/i18n';
 import { bytesToBase64 } from './base64';
 import { parseCss2, selectFaces } from './css2';
 import type { StoredFont, StoredFontFace } from './types';
@@ -27,7 +28,7 @@ async function network<T>(step: () => Promise<T>): Promise<T> {
   try {
     return await step();
   } catch {
-    throw new FontDownloadError('Could not reach Google Fonts. Check your connection.');
+    throw new FontDownloadError(t('options.fonts.error.offline'));
   }
 }
 
@@ -39,12 +40,12 @@ export async function downloadFont(
 ): Promise<StoredFont> {
   const response = await network(() => fetchImpl(css2Url(family)));
   if (response.status === 400) {
-    throw new FontDownloadError(`"${family}" is not a Google Fonts family. Names are case-sensitive, e.g. "JetBrains Mono".`);
+    throw new FontDownloadError(t('options.fonts.error.unknownFamily', { family }));
   }
-  if (!response.ok) throw new FontDownloadError(`Google Fonts answered ${response.status}.`);
+  if (!response.ok) throw new FontDownloadError(t('options.fonts.error.status', { status: String(response.status) }));
   const parsed = parseCss2(await network(() => response.text()));
   const files = selectFaces(parsed, subsets);
-  if (files.length === 0) throw new FontDownloadError(`"${family}" has no files for the selected character sets.`);
+  if (files.length === 0) throw new FontDownloadError(t('options.fonts.error.noFiles', { family }));
 
   const data = new Map<string, string>();
   const faces: StoredFontFace[] = [];
@@ -53,11 +54,13 @@ export async function downloadFont(
     let base64 = data.get(file.url);
     if (base64 === undefined) {
       const fileResponse = await network(() => fetchImpl(file.url));
-      if (!fileResponse.ok) throw new FontDownloadError(`Font file download failed (${fileResponse.status}).`);
+      if (!fileResponse.ok) {
+        throw new FontDownloadError(t('options.fonts.error.fileStatus', { status: String(fileResponse.status) }));
+      }
       const buffer = new Uint8Array(await network(() => fileResponse.arrayBuffer()));
       bytes += buffer.byteLength;
       if (bytes > MAX_FONT_BYTES) {
-        throw new FontDownloadError(`"${family}" is larger than 2 MB; choose fewer character sets.`);
+        throw new FontDownloadError(t('options.fonts.error.tooLarge', { family }));
       }
       base64 = bytesToBase64(buffer);
       data.set(file.url, base64);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/settings src/options src/fonts`
Expected: PASS.

Run: `pnpm build`, then `pnpm exec playwright test e2e/i18n.spec.ts e2e/options.spec.ts e2e/themes.spec.ts e2e/fonts.spec.ts`
Expected: PASS (35 tests).

- [ ] **Step 5: Full checks and commit**

Run: `pnpm compile` and `pnpm test`.
Expected: both green, 527 unit tests.

```bash
git add src/options src/fonts/download.ts src/settings/shortcuts.ts src/settings/shortcuts.test.ts src/i18n e2e/i18n.spec.ts
git commit -m "feat(i18n): translate the options page"
```

---

### Task 5: Translate the background, the scratchpad and the manifest

**Files:**
- Create: `src/background/locale.ts`, `public/_locales/en/messages.json`, `public/_locales/es/messages.json`
- Modify: `src/background/menus.ts`, `src/background/menus.test.ts`, `src/entrypoints/background.ts`, `src/scratchpad/ScratchpadApp.vue`, `src/entrypoints/scratchpad/main.ts`, `wxt.config.ts`, `src/i18n/messages/en.ts`, `src/i18n/messages/es.ts`, `e2e/i18n.spec.ts`

**Interfaces:**
- Consumes: `resolveLocale`, `translate`, `Locale`, `MessageKey` (`@/i18n/translate`, Task 2); `loadSettings`, `watchSettings` (`src/settings/storage.ts`); `applyLocaleSetting`, `getLocale`, `t` (Task 2, pages only).
- Produces:
  - `src/background/locale.ts`: `backgroundLocale(languages = navigator.languages): Promise<Locale>` (falls back to the browser's language if the settings can't be read).
  - `src/background/menus.ts`: `createMenus(locale: Locale)` (was `createMenus()`), `labelExtension(locale: Locale)` (toolbar tooltip and both menu titles; a missing menu is ignored); the failure tooltip is translated.
  - `wxt.config.ts`: `default_locale: 'en'`, `__MSG_extName__`, `__MSG_extDescription__`, `__MSG_actionTitle__`.

- [ ] **Step 1: Write the failing tests**

Apply to `src/background/menus.test.ts`:

```diff
diff --git a/src/background/menus.test.ts b/src/background/menus.test.ts
index 5fba00d..adde686 100644
--- a/src/background/menus.test.ts
+++ b/src/background/menus.test.ts
@@ -2,7 +2,7 @@ import { beforeEach, describe, expect, it, vi } from 'vitest';
 import type { Browser } from 'wxt/browser';
 import { fakeBrowser } from 'wxt/testing/fake-browser';
 import { scratchpadInputItem } from '@/scratchpad/input';
-import { createMenus, MENU_VIEW_PAGE, MENU_VIEW_SELECTION, onMenuClick } from './menus';
+import { createMenus, labelExtension, MENU_VIEW_PAGE, MENU_VIEW_SELECTION, onMenuClick } from './menus';
 import { SCRATCHPAD_PAGE } from './scratchpad';
 import { VIEWER_SCRIPT } from './viewer';
 
@@ -24,7 +24,7 @@ describe('context menus', () => {
   it('creates "View as JSON" for pages and "View selection as JSON" for selections', async () => {
     const removeAll = vi.spyOn(fakeBrowser.contextMenus, 'removeAll').mockResolvedValue(undefined);
     const create = vi.spyOn(fakeBrowser.contextMenus, 'create').mockReturnValue(1);
-    await createMenus();
+    await createMenus('en');
     expect(removeAll).toHaveBeenCalledOnce();
     expect(create.mock.calls.map(([props]) => props)).toEqual([
       { id: MENU_VIEW_PAGE, title: 'View as JSON', contexts: ['page'] },
@@ -32,6 +32,29 @@ describe('context menus', () => {
     ]);
   });
 
+  it('names the menus in the given language', async () => {
+    vi.spyOn(fakeBrowser.contextMenus, 'removeAll').mockResolvedValue(undefined);
+    const create = vi.spyOn(fakeBrowser.contextMenus, 'create').mockReturnValue(1);
+    await createMenus('es');
+    expect(create.mock.calls.map(([props]) => props.title)).toEqual(['Ver como JSON', 'Ver la selección como JSON']);
+  });
+
+  it('relabels the menus and the toolbar icon when the language changes', async () => {
+    const update = vi.spyOn(fakeBrowser.contextMenus, 'update').mockResolvedValue(undefined);
+    await labelExtension('es');
+    expect(update.mock.calls).toEqual([
+      [MENU_VIEW_PAGE, { title: 'Ver como JSON' }],
+      [MENU_VIEW_SELECTION, { title: 'Ver la selección como JSON' }],
+    ]);
+    expect(await fakeBrowser.action.getTitle({})).toBe('Abrir el bloc de JSON');
+  });
+
+  it('still labels the toolbar icon when the menus do not exist yet', async () => {
+    vi.spyOn(fakeBrowser.contextMenus, 'update').mockRejectedValue(new Error('Cannot find menu item'));
+    await labelExtension('en');
+    expect(await fakeBrowser.action.getTitle({})).toBe('Open the JSON scratchpad');
+  });
+
   it('forces the viewer into the clicked frame', async () => {
     await onMenuClick(click(MENU_VIEW_PAGE, { frameId: 4 }), tab);
     expect(executeScript).toHaveBeenCalledTimes(2);
@@ -52,11 +75,23 @@ describe('context menus', () => {
   });
 
   it('marks the toolbar icon when the viewer cannot run on the page', async () => {
+    // Explicit: on auto, the language would come from the machine running the tests.
+    await fakeBrowser.storage.sync.set({ settings: { locale: 'en' } });
     executeScript.mockRejectedValue(new Error('Cannot access a chrome:// URL'));
     vi.spyOn(console, 'warn').mockImplementation(() => undefined);
     await onMenuClick(click(MENU_VIEW_PAGE), tab);
     expect(await fakeBrowser.action.getBadgeText({ tabId: 7 })).toBe('!');
-    expect(await fakeBrowser.action.getTitle({ tabId: 7 })).toContain('Cannot access a chrome:// URL');
+    expect(await fakeBrowser.action.getTitle({ tabId: 7 })).toBe("JSON Viewer can't open this page: Cannot access a chrome:// URL");
+  });
+
+  it('explains the failure in the chosen language', async () => {
+    await fakeBrowser.storage.sync.set({ settings: { locale: 'es' } });
+    executeScript.mockRejectedValue(new Error('Cannot access a chrome:// URL'));
+    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
+    await onMenuClick(click(MENU_VIEW_PAGE), tab);
+    expect(await fakeBrowser.action.getTitle({ tabId: 7 })).toBe(
+      'JSON Viewer no puede abrir esta página: Cannot access a chrome:// URL',
+    );
   });
 
   it('ignores clicks without a tab', async () => {
```

Apply to `e2e/i18n.spec.ts`:

```diff
diff --git a/e2e/i18n.spec.ts b/e2e/i18n.spec.ts
index 65cfbeb..851a378 100644
--- a/e2e/i18n.spec.ts
+++ b/e2e/i18n.spec.ts
@@ -28,3 +28,32 @@ test('the viewer speaks the chosen language and follows a change live', async ({
   await expect(viewer.getByRole('button', { name: 'Fold all', exact: true })).toBeVisible();
   await expect(viewer.locator('.jv-status')).toContainText('lines');
 });
+
+test('the scratchpad speaks the chosen language', async ({ context, extensionId }) => {
+  await setStorage(context, 'sync', { settings: { locale: 'es' } });
+  const page = await context.newPage();
+  await page.goto(`chrome-extension://${extensionId}/scratchpad.html`);
+  await expect(page.getByRole('heading', { name: 'Bloc de JSON' })).toBeVisible();
+  await expect(page).toHaveTitle('Bloc de JSON');
+  await page.getByLabel('Entrada JSON').fill('{"a": 1}');
+  await expect(page.locator('.sp-output').getByRole('button', { name: 'Plegar todo', exact: true })).toBeVisible();
+});
+
+test('the manifest texts come from _locales', async ({ context }) => {
+  let [worker] = context.serviceWorkers();
+  if (!worker) worker = await context.waitForEvent('serviceworker');
+  type Chrome = { chrome: { i18n: { getMessage(key: string): string; getUILanguage(): string } } };
+  // chrome.i18n follows the browser's UI language (the machine's), not the page locale Playwright sets.
+  const { language, messages } = await worker.evaluate(() => {
+    const { i18n } = (globalThis as unknown as Chrome).chrome;
+    return {
+      language: i18n.getUILanguage(),
+      messages: ['extName', 'extDescription', 'actionTitle'].map((key) => i18n.getMessage(key)),
+    };
+  });
+  expect(messages).toEqual(
+    language.startsWith('es')
+      ? ['JSON Viewer', 'Visor de JSON rápido y personalizable, con temas de VS Code y Google Fonts.', 'Abrir el bloc de JSON']
+      : ['JSON Viewer', 'Fast, themeable JSON viewer with VS Code themes and Google Fonts.', 'Open the JSON scratchpad'],
+  );
+});
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `pnpm exec vitest run src/background/menus.test.ts`
Expected: FAIL. `labelExtension is not a function`; the menus and the failure tooltip are still in English.

- [ ] **Step 3: Implement**

Apply to `src/i18n/messages/en.ts`:

```diff
diff --git a/src/i18n/messages/en.ts b/src/i18n/messages/en.ts
index c17641e..0c0c026 100644
--- a/src/i18n/messages/en.ts
+++ b/src/i18n/messages/en.ts
@@ -192,6 +192,18 @@ export const en = {
   'options.advanced.hint':
     'Custom CSS for the viewer. Useful selectors: {selectors}. Variables: {variables}… Font variables ({fontVariables}…) come from the Fonts section; add {important} to override them here.',
 
+  'menu.viewPage': 'View as JSON',
+  'menu.viewSelection': 'View selection as JSON',
+  'action.title': 'Open the JSON scratchpad',
+  'action.cantOpen': "JSON Viewer can't open this page: {reason}",
+
+  'scratchpad.title': 'JSON Scratchpad',
+  'scratchpad.hint': 'Paste JSON, JSONP or NDJSON on the left.',
+  'scratchpad.clear': 'Clear',
+  'scratchpad.input': 'JSON input',
+  'scratchpad.empty': 'The formatted result appears here.',
+  'scratchpad.loadFailed': 'The scratchpad could not load its settings. Reload the page to try again.',
+
   'viewer.mode.code': 'Code',
   'viewer.mode.raw': 'Raw',
   'viewer.fold.group': 'Folding',
```

Apply to `src/i18n/messages/es.ts`:

```diff
diff --git a/src/i18n/messages/es.ts b/src/i18n/messages/es.ts
index c46270d..e494df7 100644
--- a/src/i18n/messages/es.ts
+++ b/src/i18n/messages/es.ts
@@ -195,6 +195,18 @@ export const es: Messages = {
   'options.advanced.hint':
     'CSS propio para el visor. Selectores útiles: {selectors}. Variables: {variables}… Las variables de fuente ({fontVariables}…) vienen de la sección Fuentes; añade {important} para cambiarlas aquí.',
 
+  'menu.viewPage': 'Ver como JSON',
+  'menu.viewSelection': 'Ver la selección como JSON',
+  'action.title': 'Abrir el bloc de JSON',
+  'action.cantOpen': 'JSON Viewer no puede abrir esta página: {reason}',
+
+  'scratchpad.title': 'Bloc de JSON',
+  'scratchpad.hint': 'Pega JSON, JSONP o NDJSON a la izquierda.',
+  'scratchpad.clear': 'Borrar',
+  'scratchpad.input': 'Entrada JSON',
+  'scratchpad.empty': 'Aquí aparece el resultado formateado.',
+  'scratchpad.loadFailed': 'El bloc no pudo cargar la configuración. Recarga la página para volver a intentarlo.',
+
   'viewer.mode.code': 'Código',
   'viewer.mode.raw': 'Texto',
   'viewer.fold.group': 'Plegado',
```

Create `src/background/locale.ts`:

```ts
import { resolveLocale, type Locale } from '@/i18n/translate';
import { loadSettings } from '@/settings/storage';

/** The language the background speaks (menus, the toolbar icon): the setting, or the browser's on `auto`. */
export async function backgroundLocale(languages: readonly string[] = navigator.languages): Promise<Locale> {
  try {
    return resolveLocale((await loadSettings()).locale, languages);
  } catch {
    return resolveLocale('auto', languages);
  }
}
```

Apply to `src/background/menus.ts`:

```diff
diff --git a/src/background/menus.ts b/src/background/menus.ts
index bd579c9..9c24fce 100644
--- a/src/background/menus.ts
+++ b/src/background/menus.ts
@@ -1,15 +1,35 @@
 import type { Browser } from 'wxt/browser';
+import { translate, type Locale, type MessageKey } from '@/i18n/translate';
+import { backgroundLocale } from './locale';
 import { openScratchpad } from './scratchpad';
 import { injectViewer, type FrameTarget } from './viewer';
 
 export const MENU_VIEW_PAGE = 'view-page-as-json';
 export const MENU_VIEW_SELECTION = 'view-selection-as-json';
 
+const MENU_TITLES: [id: string, key: MessageKey][] = [
+  [MENU_VIEW_PAGE, 'menu.viewPage'],
+  [MENU_VIEW_SELECTION, 'menu.viewSelection'],
+];
+
 /** Menus survive service worker restarts but not updates, so they are rebuilt on install and update. */
-export async function createMenus(): Promise<void> {
+export async function createMenus(locale: Locale): Promise<void> {
   await browser.contextMenus.removeAll();
-  browser.contextMenus.create({ id: MENU_VIEW_PAGE, title: 'View as JSON', contexts: ['page'] });
-  browser.contextMenus.create({ id: MENU_VIEW_SELECTION, title: 'View selection as JSON', contexts: ['selection'] });
+  browser.contextMenus.create({ id: MENU_VIEW_PAGE, title: translate(locale, 'menu.viewPage'), contexts: ['page'] });
+  browser.contextMenus.create({
+    id: MENU_VIEW_SELECTION,
+    title: translate(locale, 'menu.viewSelection'),
+    contexts: ['selection'],
+  });
+}
+
+/** Puts the menus and the toolbar icon's tooltip in `locale` (the manifest's follow the browser). */
+export async function labelExtension(locale: Locale): Promise<void> {
+  await browser.action.setTitle({ title: translate(locale, 'action.title') });
+  for (const [id, key] of MENU_TITLES) {
+    // Before the first install finishes there are no menus yet; createMenus names them then.
+    await browser.contextMenus.update(id, { title: translate(locale, key) }).catch(() => undefined);
+  }
 }
 
 /** The selection with its line breaks (info.selectionText may lose them), or the fallback. */
@@ -33,7 +53,7 @@ async function reportFailure(tabId: number, error: unknown): Promise<void> {
   try {
     await browser.action.setBadgeBackgroundColor({ tabId, color: '#d1242f' });
     await browser.action.setBadgeText({ tabId, text: '!' });
-    await browser.action.setTitle({ tabId, title: `JSON Viewer can't open this page: ${reason}` });
+    await browser.action.setTitle({ tabId, title: translate(await backgroundLocale(), 'action.cantOpen', { reason }) });
   } catch (badgeError) {
     console.warn('[json-viewer] could not mark the toolbar icon', badgeError);
   }
```

Apply to `src/entrypoints/background.ts`:

```diff
diff --git a/src/entrypoints/background.ts b/src/entrypoints/background.ts
index 0d1729d..27b0b60 100644
--- a/src/entrypoints/background.ts
+++ b/src/entrypoints/background.ts
@@ -1,12 +1,22 @@
-import { createMenus, onMenuClick } from '@/background/menus';
+import { backgroundLocale } from '@/background/locale';
+import { createMenus, labelExtension, onMenuClick } from '@/background/menus';
 import { openScratchpad } from '@/background/scratchpad';
 import { onJsonDetected } from '@/background/viewer';
+import { resolveLocale } from '@/i18n/translate';
 import { isJsonDetectedMessage, isOpenOptionsMessage } from '@/messages';
+import { watchSettings } from '@/settings/storage';
 
 export default defineBackground(() => {
   browser.runtime.onInstalled.addListener(() => {
-    createMenus().catch((error: unknown) => console.warn('[json-viewer] context menus failed', error));
+    backgroundLocale()
+      .then(createMenus)
+      .catch((error: unknown) => console.warn('[json-viewer] context menus failed', error));
   });
+  // The menus and the toolbar tooltip follow the language setting, live.
+  const relabel = (locale: Parameters<typeof labelExtension>[0]) =>
+    labelExtension(locale).catch((error: unknown) => console.warn('[json-viewer] relabeling failed', error));
+  void backgroundLocale().then(relabel);
+  watchSettings((settings) => void relabel(resolveLocale(settings.locale, navigator.languages)));
   browser.contextMenus.onClicked.addListener((info, tab) => void onMenuClick(info, tab));
   // The toolbar icon has no popup: a click opens the scratchpad next to the current tab.
   browser.action.onClicked.addListener((tab) => {
```

Apply to `src/scratchpad/ScratchpadApp.vue`:

```diff
diff --git a/src/scratchpad/ScratchpadApp.vue b/src/scratchpad/ScratchpadApp.vue
index e12c908..66d54bb 100644
--- a/src/scratchpad/ScratchpadApp.vue
+++ b/src/scratchpad/ScratchpadApp.vue
@@ -1,10 +1,11 @@
 <script setup lang="ts">
-import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
+import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';
 import { browser } from 'wxt/browser';
 import { takeScratchpadInput } from './input';
 import JsonViewer from '@/components/JsonViewer.vue';
 import ViewerShadowRoot from '@/components/ViewerShadowRoot.vue';
 import { sniffKind } from '@/detect/detect';
+import { getLocale, t } from '@/i18n';
 import type { ViewerSession } from '@/viewer/session';
 
 const props = defineProps<{ session: ViewerSession }>();
@@ -42,6 +43,12 @@ function openSettings(): void {
 const format = computed(() => sniffKind(raw.value));
 const state = props.session.state;
 
+// The session sets the language from the settings; the page's own title and lang follow it.
+watchEffect(() => {
+  document.documentElement.lang = getLocale();
+  document.title = t('scratchpad.title');
+});
+
 onMounted(async () => {
   const handed = await takeScratchpadInput();
   if (handed !== '') {
@@ -56,15 +63,15 @@ onBeforeUnmount(() => clearTimeout(timer));
 <template>
   <div class="sp-app">
     <header class="sp-header">
-      <h1 class="sp-title">JSON Scratchpad</h1>
-      <span class="sp-hint">Paste JSON, JSONP or NDJSON on the left.</span>
-      <button type="button" class="sp-button" :disabled="input === ''" @click="clear">Clear</button>
+      <h1 class="sp-title">{{ t('scratchpad.title') }}</h1>
+      <span class="sp-hint">{{ t('scratchpad.hint') }}</span>
+      <button type="button" class="sp-button" :disabled="input === ''" @click="clear">{{ t('scratchpad.clear') }}</button>
     </header>
     <textarea
       ref="textarea"
       v-model="input"
       class="sp-input"
-      aria-label="JSON input"
+      :aria-label="t('scratchpad.input')"
       spellcheck="false"
       placeholder='{"paste": "JSON here"}'
       @input="onInput"
@@ -85,7 +92,7 @@ onBeforeUnmount(() => clearTimeout(timer));
           @open-settings="openSettings"
         />
       </ViewerShadowRoot>
-      <p v-else class="sp-empty">The formatted result appears here.</p>
+      <p v-else class="sp-empty">{{ t('scratchpad.empty') }}</p>
     </div>
   </div>
 </template>
```

Apply to `src/entrypoints/scratchpad/main.ts`:

```diff
diff --git a/src/entrypoints/scratchpad/main.ts b/src/entrypoints/scratchpad/main.ts
index 4106329..b2cba27 100644
--- a/src/entrypoints/scratchpad/main.ts
+++ b/src/entrypoints/scratchpad/main.ts
@@ -1,5 +1,6 @@
 import '@/scratchpad/scratchpad.css';
 import { createApp } from 'vue';
+import { applyLocaleSetting, t } from '@/i18n';
 import ScratchpadApp from '@/scratchpad/ScratchpadApp.vue';
 import { createViewerSession } from '@/viewer/session';
 
@@ -7,5 +8,7 @@ createViewerSession(document.fonts)
   .then((session) => createApp(ScratchpadApp, { session }).mount('#app'))
   .catch((error: unknown) => {
     console.error('[json-viewer] scratchpad failed to start', error);
-    document.body.textContent = 'The scratchpad could not load its settings. Reload the page to try again.';
+    // The settings (and so the chosen language) are what failed to load: use the browser's.
+    applyLocaleSetting('auto');
+    document.body.textContent = t('scratchpad.loadFailed');
   });
```

Create `public/_locales/en/messages.json`:

```json
{
  "extName": { "message": "JSON Viewer" },
  "extDescription": { "message": "Fast, themeable JSON viewer with VS Code themes and Google Fonts." },
  "actionTitle": { "message": "Open the JSON scratchpad" }
}
```

Create `public/_locales/es/messages.json`:

```json
{
  "extName": { "message": "JSON Viewer" },
  "extDescription": { "message": "Visor de JSON rápido y personalizable, con temas de VS Code y Google Fonts." },
  "actionTitle": { "message": "Abrir el bloc de JSON" }
}
```

Apply to `wxt.config.ts`:

```diff
diff --git a/wxt.config.ts b/wxt.config.ts
index 1f419ba..a7571cc 100644
--- a/wxt.config.ts
+++ b/wxt.config.ts
@@ -18,11 +18,14 @@ export default defineConfig({
     },
   }),
   manifest: {
-    name: 'JSON Viewer',
-    description: 'Fast, themeable JSON viewer with VS Code themes and Google Fonts.',
+    // Manifest texts come from public/_locales and follow the browser's language; the UI follows the
+    // Language setting instead (src/i18n), and the background relabels the toolbar tooltip at startup.
+    default_locale: 'en',
+    name: '__MSG_extName__',
+    description: '__MSG_extDescription__',
     permissions: ['storage', 'scripting', 'contextMenus'],
     // No popup: clicking the icon opens the scratchpad (background.ts).
-    action: { default_title: 'Open the JSON scratchpad' },
+    action: { default_title: '__MSG_actionTitle__' },
     homepage_url: 'https://github.com/marr-cloud/json-viewer',
   },
 });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/background`
Expected: PASS (17 tests).

Run: `pnpm build`, then check that `.output/chrome-mv3/background.js` contains no Vue (`grep -c "__v_isRef" .output/chrome-mv3/background.js` prints 0) and that the detector is still 5444 bytes (`wc -c .output/chrome-mv3/content-scripts/detector.js`).

Run: `pnpm exec playwright test e2e/i18n.spec.ts e2e/input.spec.ts`
Expected: PASS. The manifest test reads `chrome.i18n`, which follows the machine's UI language; it accepts either dictionary accordingly.

- [ ] **Step 5: Full checks and commit**

Run: `pnpm compile`, `pnpm test` and `pnpm test:e2e`.
Expected: all green: 531 unit tests and 105 e2e tests.

```bash
git add src/background src/entrypoints/background.ts src/scratchpad/ScratchpadApp.vue src/entrypoints/scratchpad/main.ts public/_locales wxt.config.ts src/i18n e2e/i18n.spec.ts
git commit -m "feat(i18n): translate the context menu, toolbar tooltip, scratchpad and manifest"
```

---

### Task 6: Documentation

**Files:**
- Create: `docs/notes/pendientes-fase-6b.md`
- Modify: `README.md`, `docs/notes/pendientes-fase-6a.md`, `docs/superpowers/specs/2026-10-11-json-viewer-design.md`

- [ ] **Step 1: Update the docs**

Apply to `README.md`:

```diff
diff --git a/README.md b/README.md
index 9f96cbd..f0d5e02 100644
--- a/README.md
+++ b/README.md
@@ -37,6 +37,11 @@ solos y se aplican en vivo a las pestañas abiertas.
   imágenes, y el umbral del modo ligero.
 - **Sitios:** hosts donde no abrir el visor (uno por línea; `*.example.com` incluye `example.com`, `*` comodín).
 - **Avanzado:** CSS propio para el visor.
+- **Idioma:** English o Español, o el del navegador (por defecto). Cambia en vivo el visor, las opciones, el scratchpad,
+  el menú contextual y el texto del ícono. El nombre y la descripción de la tienda siguen al idioma del navegador.
+- **Exportar / importar:** un archivo `json-viewer-settings-AAAA-MM-DD.json` con los ajustes, el CSS propio y los
+  temas personalizados (las fuentes descargadas no se incluyen). Al importar se reemplazan los ajustes y se añaden o
+  actualizan los temas del archivo. **Restablecer valores** vuelve a los ajustes por defecto y conserva los temas.
 
 ## En el visor
 
```

Apply to `docs/superpowers/specs/2026-10-11-json-viewer-design.md` (Decision 1):

```diff
diff --git a/docs/superpowers/specs/2026-10-11-json-viewer-design.md b/docs/superpowers/specs/2026-10-11-json-viewer-design.md
index ed6295b..8535bbb 100644
--- a/docs/superpowers/specs/2026-10-11-json-viewer-design.md
+++ b/docs/superpowers/specs/2026-10-11-json-viewer-design.md
@@ -32,7 +32,7 @@ Uso personal primero (Edge y Chrome, cargada sin empaquetar), con estructura lis
 - **Vue 3** (`@wxt-dev/module-vue`) para visor, opciones y scratchpad.
 - **CodeMirror 6** (`@codemirror/lang-json`, fold, search, view, state).
 - `jsonpath-plus` (con `eval: 'safe'`: intérprete propio, sin `eval`/`Function`; ver §6.2) para el filtro.
-- `@wxt-dev/i18n` para en/es.
+- i18n en/es propio (`src/i18n`): diccionarios TypeScript tipados, porque `@wxt-dev/i18n` (como `browser.i18n`) no permite elegir el idioma desde los ajustes. Solo el manifest usa `_locales`.
 - `tm-themes` (devDependency) como fuente de los temas incluidos.
 - Vitest (`WxtVitest`, `fakeBrowser`) y Playwright.
 - Ícono: `vscode-icons:file-type-json` (ya presente en la raíz como `vscode-icons_file-type-light-json.svg`; se moverá a `assets/` y se generarán los PNG del manifest).
@@ -259,7 +259,7 @@ Navegación lateral: Apariencia (temas), Fuentes, Comportamiento, Estructura, Fu
 
 ### 6.9 Idiomas
 
-en y es con `@wxt-dev/i18n`; `locale: 'auto'` sigue el idioma del navegador.
+en y es con diccionarios propios (`src/i18n`); `locale: 'auto'` sigue el idioma del navegador y `en`/`es` lo fijan. El cambio se aplica en vivo. El nombre, la descripción y el título por defecto del manifest van en `public/_locales` y siguen al navegador (el background re-etiqueta el ícono y el menú contextual según el ajuste).
 
 ## 7. Manejo de errores
 
```

Apply to `docs/notes/pendientes-fase-6a.md`:

```diff
diff --git a/docs/notes/pendientes-fase-6a.md b/docs/notes/pendientes-fase-6a.md
index 7ea276f..b4a46ae 100644
--- a/docs/notes/pendientes-fase-6a.md
+++ b/docs/notes/pendientes-fase-6a.md
@@ -21,6 +21,4 @@
 - El visor forzado en páginas HTML vive en un shadow root abierto junto a los scripts de la página.
 - Comprobar a mano "View as JSON" en una página HTML con CSP estricta (`style-src`).
 
-## Para la Fase 6b
-- Exportar / importar configuración y restablecer (§6.8).
-- i18n en/es (§6.9): incluye los textos nuevos de esta fase (menú contextual, Sites, scratchpad).
+La Fase 6b (exportar / importar e i18n) está hecha; sus pendientes, en `pendientes-fase-6b.md`.
```

Create `docs/notes/pendientes-fase-6b.md`:

```markdown
# Pendientes tras la Fase 6b

## Textos que siguen en inglés
- Los mensajes de validación de temas (`src/themes/validate.ts`) y los avisos del conversor de VS Code
  (`src/themes/fromVSCode.ts`): son diagnósticos técnicos que citan campos del JSON (`"colors"`, `"type"`).
- Los mensajes de error que vienen del motor: `JSON.parse` (en el banner de JSON inválido, tras "Línea N:" en NDJSON)
  y `jsonpath-plus` (filtro JSONPath). Dependen del navegador o de la librería.
- Los nombres de las claves de color en el editor de temas (`background`, `gutterForeground`…): son los del formato
  compacto.

## Limitaciones conocidas
- `chrome.i18n` (nombre, descripción y título por defecto del ícono) sigue al idioma del navegador; el background
  corrige el título del ícono al arrancar y cuando cambia el ajuste, pero la tienda y `edge://extensions` muestran el
  del navegador.
- Al cambiar de idioma, los marcadores de bloques ya plegados ("… 3 items") conservan el idioma anterior hasta que se
  vuelven a plegar. El panel de búsqueda, los tooltips y el resto de la interfaz cambian al momento.
- El background, con `auto`, usa `navigator.languages` del service worker, que puede diferir del de una página si el
  navegador fuerza otro idioma para el contenido.
- Los números de la barra de estado se agrupan según el idioma (`12,345` / `12.345`); los tamaños (`1.2 MB`) siguen
  con punto decimal.

## Ideas
- Importar también desde un archivo de opciones de tulios/json-viewer (sus claves ya tienen equivalente, §6.7).
```

- [ ] **Step 2: Commit**

```bash
git add README.md docs
git commit -m "docs: document settings export/import and the Language setting"
```

---

## Manual checks in Edge (after the last task)

- [ ] Options › Language › Español: the options page, an open JSON tab, the scratchpad and the right-click menu switch to Spanish without reloading; the toolbar icon's tooltip says "Abrir el bloc de JSON".
- [ ] Export settings, change a few settings and a custom theme, then import the file: everything comes back.
- [ ] Import the same file in another Edge profile: settings, CSS and custom themes arrive; a Google font shows as "not downloaded yet" until downloaded.
- [ ] Import a VS Code theme file by mistake through **Import settings**: "That file is not a JSON Viewer settings file."
