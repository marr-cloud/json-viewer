# JSON Viewer — Fases 0 y 1 (base + visor fiel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extensión WXT + Vue + CodeMirror 6 que detecta respuestas JSON en Edge/Chrome y las muestra formateadas (números de línea, plegado, URLs clicables, Raw, error de parseo localizado) con el tema Dark+, sin cargar el visor en páginas que no son JSON.

**Architecture:** Un content script mínimo (`detector`) corre en todas las páginas, lee el `<pre>` que el navegador genera para respuestas de texto y decide con `detect()`. Si es JSON avisa al background, que inyecta el content script `viewer` (registrado en runtime) con `scripting.executeScript`. El visor oculta el contenido original y monta una app Vue en un shadow root (`createShadowRootUi`) con CodeMirror 6. Toda la lógica (detección, parseo, formato, temas, extensiones de editor) vive en módulos puros con tests de Vitest; el cableado se prueba con Playwright cargando la extensión compilada.

**Tech Stack:** WXT 0.21.4, Vue 3.5, CodeMirror 6 (`codemirror` 6.0.2, `@codemirror/lang-json` 6.0.2, `@codemirror/language` 6.13, `@codemirror/view` 6.43), TypeScript, pnpm 12, Vitest 5 + happy-dom 21, Playwright 1.64, `@wxt-dev/auto-icons` 1.1.2.

**Spec:** `docs/superpowers/specs/2026-10-11-json-viewer-design.md` (este plan cubre §10 Fases 0 y 1; Fases 2–6 tendrán su propio plan).

## Global Constraints

- Gestor de paquetes: **pnpm** (nunca npm/yarn). Node 24.
- Manifest V3. Permisos: solo `storage` y `scripting`; `<all_urls>` en `host_permissions` lo añade WXT por el content script `registration: 'runtime'`.
- `srcDir: 'src'`; alias `@/` → `src/`.
- El `detector` no puede importar Vue ni CodeMirror; `content-scripts/detector.js` compilado ≤ 8 kB.
- Sin acceso a red en runtime en estas fases.
- Identificadores, comentarios y textos de UI en inglés en estas fases (i18n en/es llega en Fase 6). Commits en formato conventional commits, cada uno terminando con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests unitarios junto al código (`src/**/*.test.ts`); e2e en `e2e/`.
- Resultado del spike (§8.1 de la spec, ya ejecutado en Edge 155 y Chromium 153): el `<body>` de una respuesta JSON/texto contiene un único `<pre>` con el texto crudo y, para tipos JSON, un `<div class="json-formatter-container">` vacío como hermano. No hay shadow DOM.

## Review Focus

1. **BOM UTF-8 delante del JSON** (`\uFEFF{"a":1}`): debe parsear y formatearse normal, sin banner de error (`JSON.parse` falla con BOM). → test en Task 4 y e2e en Task 11.
2. **JSON muy anidado** (100 000 niveles): `JSON.parse` lo acepta pero `JSON.stringify` desborda la pila; el visor debe mostrar el texto crudo con el banner "Document is nested too deeply to format", nunca una página en blanco ni una excepción. → test en Task 6.
3. **`text/plain` que empieza con `[` o `{` pero no es JSON** (logs tipo `[INFO] server started`): no se inyecta nada. → test en Task 2 y e2e en Task 10.
4. **Raíces primitivas, contenedores vacíos y cuerpo vacío** (`42`, `"s"`, `null`, `{}`, `[]`, `""`): se muestran tal cual o con banner de error, sin fallar. → test en Task 6.
5. **Claves `__proto__` / `constructor`**: sobreviven al formateo y a `sortKeys`. → test en Task 5.

---

## File Structure

```
package.json, pnpm-lock.yaml, wxt.config.ts, tsconfig.json, vitest.config.ts,
playwright.config.ts, .gitignore, web-ext.config.ts (gitignored), README.md
docs/notes/native-viewers.md          resultado del spike §8.1
src/assets/icon.svg                   ícono base (auto-icons genera los PNG)
src/types/json-raw.d.ts               tipos de JSON.rawJSON / isRawJSON
src/messages.ts                       mensaje detector → background
src/detect/detect.ts                  ¿es JSON? (content type + texto)
src/detect/readRawText.ts             texto crudo del <pre> del navegador
src/parse/parse.ts                    parseJson, stripBom, locateError
src/parse/format.ts                   formatJson (indent, sortKeys, cStyle)
src/viewer/options.ts                 ViewerOptions + defaults (equivalentes del original)
src/viewer/prepare.ts                 prepareDocument: parse + format sin lanzar
src/themes/types.ts                   Theme, ThemeColors, themeColorKeys
src/themes/color.ts                   parseHex, toHex, withAlpha, mix
src/themes/resolve.ts                 resolveColors (derivación §4.1)
src/themes/css.ts                     cssVarName, toCssVars
src/themes/builtin/dark-plus.json     tema por defecto
src/themes/builtin/index.ts           defaultTheme
src/editor/urls.ts                    URL_PATTERN, linkTarget, linkMarkSpec, clickableUrls
src/editor/foldSummary.ts             summarizeFold, formatFoldSummary, foldSummaries
src/editor/errorLine.ts               errorLineDecorations, errorLine
src/editor/theme.ts                   toCodeMirrorTheme
src/editor/setup.ts                   buildExtensions
src/components/CodeView.vue           monta EditorView
src/components/ViewerToolbar.vue      Code/Raw + encabezado URL/fecha
src/components/JsonViewer.vue         compone toolbar, banner, CodeView / Raw
src/entrypoints/background.ts         inyecta el visor
src/entrypoints/detector.content.ts   detector mínimo
src/entrypoints/viewer.content/index.ts  monta la app en shadow root
src/entrypoints/viewer.content/style.css estilos del visor
e2e/server.ts, e2e/fixtures.ts, e2e/viewer.spec.ts
```

---

### Task 1: Scaffold del proyecto, ícono y notas del spike

**Files:**
- Create: `package.json`, `wxt.config.ts`, `tsconfig.json`, `vitest.config.ts`, `web-ext.config.ts`, `.gitignore`, `src/assets/icon.svg`, `src/entrypoints/background.ts`, `src/types/json-raw.d.ts`, `docs/notes/native-viewers.md`
- Delete: `vscode-icons_file-type-light-json.svg` (se mueve a `src/assets/icon.svg`)

**Interfaces:**
- Produces: scripts `pnpm build`, `pnpm test`, `pnpm compile`, `pnpm test:e2e`; alias `@/` → `src/`; tipos globales `JSON.rawJSON(text: string): RawJSON` y `JSON.isRawJSON(value: unknown): value is RawJSON`.

- [ ] **Step 1: Crear `package.json`**

```json
{
  "name": "json-viewer",
  "description": "Fast, themeable JSON viewer with VS Code themes and Google Fonts.",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "wxt",
    "dev:edge": "wxt -b edge",
    "build": "wxt build",
    "build:edge": "wxt build -b edge",
    "zip": "wxt zip",
    "compile": "vue-tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "wxt build && playwright test",
    "postinstall": "wxt prepare"
  }
}
```

- [ ] **Step 2: Instalar dependencias**

```bash
pnpm add vue@3.5.43 codemirror@6.0.2 @codemirror/lang-json@6.0.2 @codemirror/language@6.13.1 @codemirror/view@6.43.14 @codemirror/state@6 @codemirror/search@6 @codemirror/commands@6 @lezer/highlight@1
pnpm add -D wxt@0.21.4 @wxt-dev/module-vue@1.0.3 @wxt-dev/auto-icons@1.1.2 typescript@5 vue-tsc@3 vitest@5.0.3 happy-dom@21.0.0 @playwright/test@1.64.0 @types/node@24
```

Expected: ambos terminan con `Done in …`. El `postinstall` (`wxt prepare`) puede fallar en este punto porque aún no existe `wxt.config.ts`; se corrige en el Step 4.

- [ ] **Step 3: Crear `wxt.config.ts`**

```ts
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-vue', '@wxt-dev/auto-icons'],
  autoIcons: {
    baseIconPath: 'assets/icon.svg',
  },
  manifest: {
    name: 'JSON Viewer',
    description: 'Fast, themeable JSON viewer with VS Code themes and Google Fonts.',
    permissions: ['storage', 'scripting'],
  },
});
```

- [ ] **Step 4: Crear `tsconfig.json`, `vitest.config.ts`, `web-ext.config.ts`, `.gitignore`**

`tsconfig.json`:

```json
{
  "extends": "./.wxt/tsconfig.json",
  "compilerOptions": {
    "resolveJsonModule": true
  }
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
});
```

`web-ext.config.ts` (local, no se versiona; hace que `pnpm dev` abra Edge porque Chrome no está instalado):

```ts
import { defineWebExtConfig } from 'wxt';

export default defineWebExtConfig({
  binaries: {
    chrome: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    edge: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  },
});
```

`.gitignore`:

```
node_modules
.output
.wxt
web-ext.config.ts
test-results
playwright-report
*.log
```

- [ ] **Step 5: Mover el ícono, crear background vacío y tipos de `JSON.rawJSON`**

```bash
mkdir -p src/assets src/entrypoints src/types
sed 's/width="1em" height="1em"/width="128" height="128"/' vscode-icons_file-type-light-json.svg > src/assets/icon.svg
rm vscode-icons_file-type-light-json.svg
```

`src/entrypoints/background.ts`:

```ts
export default defineBackground(() => {});
```

`src/types/json-raw.d.ts`:

```ts
// ES2025 JSON.parse source text access (Chrome 114+, Node 21+); not yet in TS lib.
interface RawJSON {
  readonly rawJSON: string;
}

interface JSON {
  rawJSON(text: string): RawJSON;
  isRawJSON(value: unknown): value is RawJSON;
}
```

- [ ] **Step 6: Escribir `docs/notes/native-viewers.md`**

```markdown
# Visores JSON nativos (spike §8.1)

Fecha: 2026-10-11. Navegadores: Edge 155.0.4283.45, Chromium 153.0.8010.12 (Playwright).
Respuestas servidas localmente con `application/json`, `application/ld+json` y `text/plain`.

| Content type | `document.contentType` | Hijos de `<body>` |
|---|---|---|
| `application/json` | `application/json` | `<pre>` (texto crudo) + `<div class="json-formatter-container">` vacío |
| `application/ld+json` | `application/ld+json` | igual que arriba |
| `text/plain` | `text/plain` | `<pre style="word-wrap: break-word; white-space: pre-wrap;">` |

- El texto crudo está intacto en `pre.textContent` en todos los casos.
- No hay shadow DOM; el contenedor del visor nativo está vacío al cargar.

Regla implementada en `src/detect/readRawText.ts`: aceptar un `<body>` cuyos hijos sean exactamente
un `<pre>` y, opcionalmente, `div.json-formatter-container`; leer `pre.textContent`.
```

- [ ] **Step 7: Instalar de nuevo (ejecuta `wxt prepare`) y verificar build, tests y tipos**

```bash
pnpm install
pnpm build
pnpm test
pnpm compile
```

Expected:
- `pnpm build`: `✔ Built extension` y la lista incluye `.output\chrome-mv3\icons\128.png`.
- `pnpm test`: `No test files found, exiting with code 0`.
- `pnpm compile`: sin salida, exit 0.

Comprobar el manifest:

```bash
cat .output/chrome-mv3/manifest.json
```

Expected: contiene `"permissions":["storage","scripting"]` y `"icons":{"16":"icons/16.png",…}`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold WXT + Vue extension with icon and spike notes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Detección de JSON (`detect`)

**Files:**
- Create: `src/detect/detect.ts`
- Test: `src/detect/detect.test.ts`

**Interfaces:**
- Produces: `type JsonKind = 'json'`; `interface Detection { kind: JsonKind }`; `normalizeContentType(contentType: string): string`; `isJsonContentType(contentType: string): boolean`; `detect(contentType: string, text: string): Detection | null`.

- [ ] **Step 1: Escribir el test**

`src/detect/detect.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { detect, isJsonContentType, normalizeContentType } from './detect';

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
    ['text/plain', '\uFEFF  {"a":1}  '],
  ])('detects %s with %j', (type, text) => {
    expect(detect(type, text)).toEqual({ kind: 'json' });
  });

  it.each([
    ['text/plain', '[INFO] server started'],
    ['text/plain', '{ not json'],
    ['text/plain', 'hello'],
    ['text/plain', '42'],
    ['text/plain', ''],
    ['text/html', '{"a":1}'],
    ['application/javascript', '{}'],
  ])('ignores %s with %j', (type, text) => {
    expect(detect(type, text)).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm vitest run src/detect/detect.test.ts`
Expected: FAIL — `Failed to resolve import "./detect"`.

- [ ] **Step 3: Implementar**

`src/detect/detect.ts`:

```ts
export type JsonKind = 'json';

export interface Detection {
  kind: JsonKind;
}

const JSON_TYPES = new Set(['application/json', 'text/json']);
const SUFFIX_JSON = /^application\/[\w.+-]+\+json$/;

export function normalizeContentType(contentType: string): string {
  return contentType.split(';')[0].trim().toLowerCase();
}

export function isJsonContentType(contentType: string): boolean {
  const type = normalizeContentType(contentType);
  return JSON_TYPES.has(type) || SUFFIX_JSON.test(type);
}

/**
 * JSON content types are always shown (invalid bodies get an error banner).
 * text/plain is only claimed when the body is an object or array that parses,
 * so plain logs like "[INFO] …" are left alone.
 */
export function detect(contentType: string, text: string): Detection | null {
  if (isJsonContentType(contentType)) return { kind: 'json' };
  if (normalizeContentType(contentType) === 'text/plain' && isJsonContainer(text)) {
    return { kind: 'json' };
  }
  return null;
}

function isJsonContainer(text: string): boolean {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (trimmed[0] !== '{' && trimmed[0] !== '[') return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `pnpm vitest run src/detect/detect.test.ts`
Expected: PASS (todos los casos).

- [ ] **Step 5: Commit**

```bash
git add src/detect
git commit -m "feat(detect): classify responses as JSON by content type and body

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Lectura del texto crudo (`readRawText`)

**Files:**
- Create: `src/detect/readRawText.ts`
- Test: `src/detect/readRawText.test.ts`

**Interfaces:**
- Produces: `readRawText(doc: Document): string | null` — `null` cuando la página no es una respuesta de texto renderizada por el navegador.

- [ ] **Step 1: Escribir el test**

`src/detect/readRawText.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { readRawText } from './readRawText';

function docWith(bodyHtml: string): Document {
  document.body.innerHTML = bodyHtml;
  return document;
}

describe('readRawText', () => {
  it('reads a lone <pre>', () => {
    expect(readRawText(docWith('<pre>{"a":1}</pre>'))).toBe('{"a":1}');
  });

  it('accepts the native JSON viewer container next to the <pre>', () => {
    expect(
      readRawText(docWith('<pre>{"a":1}</pre><div class="json-formatter-container"></div>')),
    ).toBe('{"a":1}');
    expect(
      readRawText(docWith('<div class="json-formatter-container"></div><pre>[1]</pre>')),
    ).toBe('[1]');
  });

  it('keeps whitespace and newlines', () => {
    expect(readRawText(docWith('<pre>{\n  "a": 1\n}</pre>'))).toBe('{\n  "a": 1\n}');
  });

  it.each([
    ['regular html', '<h1>Hi</h1>'],
    ['pre plus other element', '<pre>a</pre><p>b</p>'],
    ['two pres', '<pre>a</pre><pre>b</pre>'],
    ['empty body', ''],
    ['other div', '<pre>a</pre><div class="something"></div>'],
  ])('returns null for %s', (_label, html) => {
    expect(readRawText(docWith(html))).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm vitest run src/detect/readRawText.test.ts`
Expected: FAIL — `Failed to resolve import "./readRawText"`.

- [ ] **Step 3: Implementar**

`src/detect/readRawText.ts`:

```ts
const NATIVE_VIEWER_CONTAINER = 'json-formatter-container';

/**
 * Returns the raw response text when the page is a browser-rendered text
 * response: <body> holds exactly one <pre>, optionally next to the empty
 * container Chrome/Edge add for their built-in JSON viewer.
 * See docs/notes/native-viewers.md.
 */
export function readRawText(doc: Document): string | null {
  const body = doc.body;
  if (!body) return null;

  let pre: HTMLPreElement | null = null;
  for (const el of Array.from(body.children)) {
    if (el.tagName === 'PRE' && !pre) {
      pre = el as HTMLPreElement;
    } else if (el.tagName === 'DIV' && el.classList.contains(NATIVE_VIEWER_CONTAINER)) {
      continue;
    } else {
      return null;
    }
  }
  return pre ? (pre.textContent ?? '') : null;
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `pnpm vitest run src/detect/readRawText.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/detect
git commit -m "feat(detect): read raw response text from the browser's <pre>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Parseo con números grandes y errores localizados (`parse`)

**Files:**
- Create: `src/parse/parse.ts`
- Test: `src/parse/parse.test.ts`

**Interfaces:**
- Consumes: `JSON.rawJSON`, `JSON.isRawJSON` (tipos de Task 1).
- Produces:
  - `interface ParseError { message: string; line: number | null; column: number | null }`
  - `type ParseResult = { ok: true; value: unknown } | { ok: false; error: ParseError }`
  - `parseJson(text: string): ParseResult`
  - `stripBom(text: string): string`
  - `locateError(text: string, message: string): { line: number | null; column: number | null }`
  - `offsetToLineColumn(text: string, offset: number): { line: number; column: number }`

- [ ] **Step 1: Escribir el test**

`src/parse/parse.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { locateError, offsetToLineColumn, parseJson, stripBom } from './parse';

describe('parseJson', () => {
  it('parses valid JSON', () => {
    expect(parseJson('{"a":[1,true,null]}')).toEqual({ ok: true, value: { a: [1, true, null] } });
  });

  it('ignores a leading UTF-8 BOM', () => {
    expect(parseJson('\uFEFF{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
  });

  it('preserves integers beyond Number.MAX_SAFE_INTEGER verbatim', () => {
    const result = parseJson('{"big":12345678901234567890,"small":7}');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const value = result.value as { big: unknown; small: unknown };
    expect(JSON.isRawJSON(value.big)).toBe(true);
    expect(value.small).toBe(7);
    expect(JSON.stringify(value)).toBe('{"big":12345678901234567890,"small":7}');
  });

  it('returns plain numbers when no long digit run exists', () => {
    const result = parseJson('{"f":1.0}');
    expect(result).toEqual({ ok: true, value: { f: 1 } });
  });

  it.each([
    ['{"a":1,}', 1, 8],
    ['{\n  "a": 1,\n}', 3, 1],
    ['[1,2', 1, 5],
    ['', 1, 1],
  ])('locates the error in %j at line %i column %i', (text, line, column) => {
    const result = parseJson(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.line).toBe(line);
    expect(result.error.column).toBe(column);
    expect(result.error.message.length).toBeGreaterThan(0);
  });
});

describe('stripBom', () => {
  it('removes only a leading BOM', () => {
    expect(stripBom('\uFEFFa\uFEFF')).toBe('a\uFEFF');
    expect(stripBom('abc')).toBe('abc');
  });
});

describe('locateError', () => {
  it('prefers explicit line/column in the message', () => {
    expect(locateError('x', 'bad at position 0 (line 4 column 2)')).toEqual({ line: 4, column: 2 });
  });

  it('falls back to the position', () => {
    expect(locateError('a\nbc', 'bad at position 3')).toEqual({ line: 2, column: 2 });
  });

  it('returns nulls when the message has no location', () => {
    expect(locateError('abc', 'Unexpected token')).toEqual({ line: null, column: null });
  });
});

describe('offsetToLineColumn', () => {
  it('counts lines and 1-based columns', () => {
    expect(offsetToLineColumn('ab\ncd\nef', 7)).toEqual({ line: 3, column: 2 });
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm vitest run src/parse/parse.test.ts`
Expected: FAIL — `Failed to resolve import "./parse"`.

- [ ] **Step 3: Implementar**

`src/parse/parse.ts`:

```ts
export interface ParseError {
  message: string;
  line: number | null;
  column: number | null;
}

export type ParseResult = { ok: true; value: unknown } | { ok: false; error: ParseError };

// Integers this long may exceed Number.MAX_SAFE_INTEGER; only then pay for a reviver.
const LONG_DIGIT_RUN = /\d{16,}/;

export function parseJson(text: string): ParseResult {
  const source = stripBom(text);
  try {
    const value = LONG_DIGIT_RUN.test(source)
      ? JSON.parse(source, preserveNumber)
      : JSON.parse(source);
    return { ok: true, value };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: { message, ...locateError(source, message) } };
  }
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function preserveNumber(_key: string, value: unknown, context?: { source?: string }): unknown {
  if (typeof value === 'number' && context?.source !== undefined && String(value) !== context.source) {
    return JSON.rawJSON(context.source);
  }
  return value;
}

export function locateError(
  text: string,
  message: string,
): { line: number | null; column: number | null } {
  const lineColumn = /\(line (\d+) column (\d+)\)/.exec(message);
  if (lineColumn) return { line: Number(lineColumn[1]), column: Number(lineColumn[2]) };

  const position = /position (\d+)/.exec(message);
  const offset = position
    ? Number(position[1])
    : /end of JSON input/.test(message)
      ? text.length
      : null;
  if (offset === null) return { line: null, column: null };
  return offsetToLineColumn(text, offset);
}

export function offsetToLineColumn(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `pnpm vitest run src/parse/parse.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/parse
git commit -m "feat(parse): parse JSON preserving big numbers and locating errors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Formateo (`formatJson`)

**Files:**
- Create: `src/parse/format.ts`
- Test: `src/parse/format.test.ts`

**Interfaces:**
- Consumes: `parseJson` (Task 4) solo en tests.
- Produces: `interface FormatOptions { indent: number; sortKeys: boolean; cStyle: boolean }`; `formatJson(value: unknown, options: FormatOptions): string`. Puede lanzar `RangeError` con anidamiento extremo (lo captura Task 6).

- [ ] **Step 1: Escribir el test**

`src/parse/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatJson } from './format';
import { parseJson } from './parse';

const plain = { indent: 2, sortKeys: false, cStyle: false };
const sample = { a: 1, b: [1, { c: null }], d: {}, e: [] };

describe('formatJson', () => {
  it('matches JSON.stringify for the default options', () => {
    expect(formatJson(sample, plain)).toBe(JSON.stringify(sample, null, 2));
  });

  it('respects the indent size', () => {
    expect(formatJson({ a: [1] }, { ...plain, indent: 4 })).toBe('{\n    "a": [\n        1\n    ]\n}');
  });

  it('sorts keys recursively', () => {
    const out = formatJson({ b: 1, a: { d: 1, c: 2 } }, { ...plain, sortKeys: true });
    expect(out).toBe('{\n  "a": {\n    "c": 2,\n    "d": 1\n  },\n  "b": 1\n}');
  });

  it('produces the same layout as JSON.stringify when sorting already-sorted input', () => {
    const sorted = { a: 1, b: [1, { c: null }], d: {}, e: [] };
    expect(formatJson(sorted, { ...plain, sortKeys: true })).toBe(JSON.stringify(sorted, null, 2));
  });

  it('puts non-empty container values on their own line in C style', () => {
    expect(formatJson(sample, { ...plain, cStyle: true })).toBe(
      [
        '{',
        '  "a": 1,',
        '  "b":',
        '  [',
        '    1,',
        '    {',
        '      "c": null',
        '    }',
        '  ],',
        '  "d": {},',
        '  "e": []',
        '}',
      ].join('\n'),
    );
  });

  it('keeps big numbers verbatim in every mode', () => {
    const parsed = parseJson('{"n":12345678901234567890}');
    if (!parsed.ok) throw new Error('fixture must parse');
    for (const options of [plain, { ...plain, sortKeys: true }, { ...plain, cStyle: true }]) {
      expect(formatJson(parsed.value, options)).toContain('"n": 12345678901234567890');
    }
  });

  it('keeps __proto__ and constructor keys', () => {
    const parsed = parseJson('{"constructor":2,"__proto__":{"x":1}}');
    if (!parsed.ok) throw new Error('fixture must parse');
    const out = formatJson(parsed.value, { ...plain, sortKeys: true });
    expect(out).toBe('{\n  "__proto__": {\n    "x": 1\n  },\n  "constructor": 2\n}');
  });

  it('formats primitives at the root', () => {
    expect(formatJson(42, plain)).toBe('42');
    expect(formatJson('s', plain)).toBe('"s"');
    expect(formatJson(null, { ...plain, cStyle: true })).toBe('null');
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm vitest run src/parse/format.test.ts`
Expected: FAIL — `Failed to resolve import "./format"`.

- [ ] **Step 3: Implementar**

`src/parse/format.ts`:

```ts
export interface FormatOptions {
  indent: number;
  sortKeys: boolean;
  cStyle: boolean;
}

/**
 * Pretty-prints a parsed JSON value. Values created with JSON.rawJSON
 * (big numbers) are emitted verbatim. Throws RangeError on extreme nesting.
 */
export function formatJson(value: unknown, options: FormatOptions): string {
  if (!options.sortKeys && !options.cStyle) {
    return JSON.stringify(value, null, options.indent);
  }

  const unit = ' '.repeat(options.indent);
  const out: string[] = [];

  const write = (node: unknown, pad: string): void => {
    const inner = pad + unit;
    if (Array.isArray(node)) {
      if (node.length === 0) {
        out.push('[]');
        return;
      }
      out.push('[\n');
      node.forEach((item, i) => {
        out.push(inner);
        write(item, inner);
        out.push(i < node.length - 1 ? ',\n' : '\n');
      });
      out.push(`${pad}]`);
      return;
    }
    if (isObject(node)) {
      const keys = Object.keys(node);
      if (options.sortKeys) keys.sort();
      if (keys.length === 0) {
        out.push('{}');
        return;
      }
      out.push('{\n');
      keys.forEach((key, i) => {
        const child = node[key];
        out.push(`${inner}${JSON.stringify(key)}:`);
        out.push(options.cStyle && isNonEmptyContainer(child) ? `\n${inner}` : ' ');
        write(child, inner);
        out.push(i < keys.length - 1 ? ',\n' : '\n');
      });
      out.push(`${pad}}`);
      return;
    }
    out.push(JSON.stringify(node));
  };

  write(value, '');
  return out.join('');
}

function isObject(node: unknown): node is Record<string, unknown> {
  return typeof node === 'object' && node !== null && !JSON.isRawJSON(node);
}

function isNonEmptyContainer(node: unknown): boolean {
  if (Array.isArray(node)) return node.length > 0;
  return isObject(node) && Object.keys(node).length > 0;
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `pnpm vitest run src/parse/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/parse
git commit -m "feat(parse): format JSON with indent, sorted keys and C-style braces

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Opciones del visor y `prepareDocument`

**Files:**
- Create: `src/viewer/options.ts`, `src/viewer/prepare.ts`
- Test: `src/viewer/prepare.test.ts`

**Interfaces:**
- Consumes: `parseJson`, `stripBom`, `ParseError` (Task 4); `formatJson` (Task 5).
- Produces:
  - `interface ViewerOptions { showHeader: boolean; sortKeys: boolean; clickableUrls: boolean; wrapLinkWithAnchorTag: boolean; openLinksInNewWindow: boolean; autoHighlight: boolean; lineNumbers: boolean; lineWrapping: boolean; foldGutter: boolean; tabSize: number; indentCStyle: boolean; showArraySize: boolean }`
  - `const defaultViewerOptions: ViewerOptions`
  - `type PreparedDocument = { ok: true; text: string } | { ok: false; text: string; error: ParseError }`
  - `prepareDocument(raw: string, options: Pick<ViewerOptions, 'tabSize' | 'sortKeys' | 'indentCStyle'>): PreparedDocument` — nunca lanza.

- [ ] **Step 1: Escribir el test**

`src/viewer/prepare.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultViewerOptions } from './options';
import { prepareDocument } from './prepare';

describe('defaultViewerOptions', () => {
  it('mirrors the original extension defaults', () => {
    expect(defaultViewerOptions).toEqual({
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
    });
  });
});

describe('prepareDocument', () => {
  it('formats valid JSON with the configured tab size', () => {
    expect(prepareDocument('{"a":[1]}', defaultViewerOptions)).toEqual({
      ok: true,
      text: '{\n  "a": [\n    1\n  ]\n}',
    });
    expect(prepareDocument('{"a":1}', { ...defaultViewerOptions, tabSize: 4 })).toEqual({
      ok: true,
      text: '{\n    "a": 1\n}',
    });
  });

  it('returns the raw text and a located error for invalid JSON', () => {
    const result = prepareDocument('{\n  "a": 1,\n}', defaultViewerOptions);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.text).toBe('{\n  "a": 1,\n}');
    expect(result.error).toMatchObject({ line: 3, column: 1 });
  });

  it('strips the BOM from valid and invalid input', () => {
    expect(prepareDocument('\uFEFF{"a":1}', defaultViewerOptions)).toEqual({
      ok: true,
      text: '{\n  "a": 1\n}',
    });
    const invalid = prepareDocument('\uFEFF{', defaultViewerOptions);
    expect(invalid.text).toBe('{');
  });

  it('does not throw on extremely deep nesting', () => {
    const depth = 100_000;
    const raw = '['.repeat(depth) + ']'.repeat(depth);
    for (const indentCStyle of [false, true]) {
      const result = prepareDocument(raw, { ...defaultViewerOptions, indentCStyle });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.text).toBe(raw);
      expect(result.error).toEqual({
        message: 'Document is nested too deeply to format',
        line: null,
        column: null,
      });
    }
  });

  it.each([
    ['42', '42'],
    ['"s"', '"s"'],
    ['null', 'null'],
    ['{}', '{}'],
    ['[]', '[]'],
  ])('handles root value %s', (raw, text) => {
    expect(prepareDocument(raw, defaultViewerOptions)).toEqual({ ok: true, text });
  });

  it('reports an empty body as an error', () => {
    const result = prepareDocument('', defaultViewerOptions);
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm vitest run src/viewer/prepare.test.ts`
Expected: FAIL — `Failed to resolve import "./options"`.

- [ ] **Step 3: Implementar**

`src/viewer/options.ts`:

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
};
```

`src/viewer/prepare.ts`:

```ts
import { formatJson } from '@/parse/format';
import { parseJson, stripBom, type ParseError } from '@/parse/parse';
import type { ViewerOptions } from './options';

export type PreparedDocument =
  | { ok: true; text: string }
  | { ok: false; text: string; error: ParseError };

const TOO_DEEP = 'Document is nested too deeply to format';

/** Parses and formats the raw response. Never throws: failures carry the raw text. */
export function prepareDocument(
  raw: string,
  options: Pick<ViewerOptions, 'tabSize' | 'sortKeys' | 'indentCStyle'>,
): PreparedDocument {
  const parsed = parseJson(raw);
  if (!parsed.ok) return { ok: false, text: stripBom(raw), error: parsed.error };

  try {
    const text = formatJson(parsed.value, {
      indent: options.tabSize,
      sortKeys: options.sortKeys,
      cStyle: options.indentCStyle,
    });
    return { ok: true, text };
  } catch (e) {
    const message = e instanceof RangeError ? TOO_DEEP : String(e);
    return { ok: false, text: stripBom(raw), error: { message, line: null, column: null } };
  }
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `pnpm vitest run src/viewer/prepare.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/viewer
git commit -m "feat(viewer): add viewer options and safe document preparation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Temas (formato compacto, derivación, variables CSS, Dark+)

**Files:**
- Create: `src/themes/types.ts`, `src/themes/color.ts`, `src/themes/resolve.ts`, `src/themes/css.ts`, `src/themes/builtin/dark-plus.json`, `src/themes/builtin/index.ts`
- Test: `src/themes/color.test.ts`, `src/themes/resolve.test.ts`

**Interfaces:**
- Produces:
  - `themeColorKeys` (tupla readonly de las 17 claves de §4.1), `type ThemeColorKey`, `type ThemeColors = Record<ThemeColorKey, string>`
  - `interface Theme { id: string; name: string; type: 'dark' | 'light'; source: 'builtin' | 'imported' | 'custom'; colors: Partial<ThemeColors> & Pick<ThemeColors, 'background' | 'foreground'> }`
  - `parseHex(hex: string): Rgba`, `toHex(c: Rgba): string`, `withAlpha(hex: string, alpha: number): string`, `mix(hex: string, target: string, amount: number): string`
  - `resolveColors(theme: Theme): ThemeColors`
  - `cssVarName(key: ThemeColorKey): string` (p. ej. `gutterForeground` → `--jv-gutter-foreground`), `toCssVars(colors: ThemeColors): Record<string, string>`
  - `defaultTheme: Theme` (Dark+)

- [ ] **Step 1: Escribir los tests**

`src/themes/color.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mix, parseHex, toHex, withAlpha } from './color';

describe('parseHex', () => {
  it('parses short and long forms', () => {
    expect(parseHex('#abc')).toEqual({ r: 170, g: 187, b: 204, a: 1 });
    expect(parseHex('#1e1e1e')).toEqual({ r: 30, g: 30, b: 30, a: 1 });
    expect(parseHex('#00000080').a).toBeCloseTo(128 / 255);
    expect(parseHex('#0008').a).toBeCloseTo(136 / 255);
  });

  it('rejects invalid colors', () => {
    expect(() => parseHex('red')).toThrow('Invalid hex color: red');
    expect(() => parseHex('#12345')).toThrow();
  });
});

describe('toHex', () => {
  it('omits alpha when opaque', () => {
    expect(toHex({ r: 30, g: 30, b: 30, a: 1 })).toBe('#1e1e1e');
    expect(toHex({ r: 255, g: 0, b: 0, a: 0.6 })).toBe('#ff000099');
  });
});

describe('withAlpha / mix', () => {
  it('sets alpha', () => {
    expect(withAlpha('#d4d4d4', 0.6)).toBe('#d4d4d499');
    expect(withAlpha('#d4d4d4', 0.06)).toBe('#d4d4d40f');
  });

  it('mixes toward a target color', () => {
    expect(mix('#1e1e1e', '#000000', 0.04)).toBe('#1d1d1d');
    expect(mix('#ffffff', '#000000', 0.1)).toBe('#e6e6e6');
  });
});
```

`src/themes/resolve.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultTheme } from './builtin';
import { cssVarName, toCssVars } from './css';
import { resolveColors } from './resolve';
import { themeColorKeys, type Theme } from './types';

const minimal = (type: Theme['type'], background: string, foreground: string): Theme => ({
  id: 't',
  name: 'T',
  type,
  source: 'custom',
  colors: { background, foreground },
});

describe('resolveColors', () => {
  it('returns every color of a fully specified theme unchanged', () => {
    expect(resolveColors(defaultTheme)).toEqual(defaultTheme.colors);
  });

  it('derives missing colors for a dark theme', () => {
    const colors = resolveColors(minimal('dark', '#1e1e1e', '#d4d4d4'));
    expect(colors).toMatchObject({
      gutterBackground: '#1e1e1e',
      gutterForeground: '#d4d4d499',
      punctuation: '#d4d4d499',
      foldPlaceholder: '#d4d4d499',
      activeLine: '#d4d4d40f',
      selection: '#d4d4d433',
      cursor: '#d4d4d4',
      toolbarBackground: '#1d1d1d',
      border: '#1b1b1b',
      key: '#9cdcfe',
      string: '#ce9178',
      link: '#3794ff',
    });
  });

  it('derives missing colors for a light theme', () => {
    const colors = resolveColors(minimal('light', '#ffffff', '#000000'));
    expect(colors).toMatchObject({
      toolbarBackground: '#ffffff',
      border: '#e6e6e6',
      key: '#0451a5',
      boolean: '#0000ff',
    });
  });

  it('ignores explicitly undefined colors', () => {
    const theme = minimal('dark', '#1e1e1e', '#d4d4d4');
    theme.colors.key = undefined;
    expect(resolveColors(theme).key).toBe('#9cdcfe');
  });
});

describe('toCssVars', () => {
  it('maps every key to a --jv- custom property', () => {
    expect(cssVarName('gutterForeground')).toBe('--jv-gutter-foreground');
    const vars = toCssVars(resolveColors(defaultTheme));
    expect(Object.keys(vars)).toHaveLength(themeColorKeys.length);
    expect(vars['--jv-background']).toBe('#1e1e1e');
    expect(vars['--jv-toolbar-background']).toBe('#252526');
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run src/themes`
Expected: FAIL — `Failed to resolve import "./color"` y `"./builtin"`.

- [ ] **Step 3: Implementar**

`src/themes/types.ts`:

```ts
export const themeColorKeys = [
  'background',
  'foreground',
  'gutterBackground',
  'gutterForeground',
  'activeLine',
  'selection',
  'cursor',
  'foldPlaceholder',
  'key',
  'string',
  'number',
  'boolean',
  'null',
  'punctuation',
  'link',
  'toolbarBackground',
  'border',
] as const;

export type ThemeColorKey = (typeof themeColorKeys)[number];
export type ThemeColors = Record<ThemeColorKey, string>;

export interface Theme {
  id: string;
  name: string;
  type: 'dark' | 'light';
  source: 'builtin' | 'imported' | 'custom';
  colors: Partial<ThemeColors> & Pick<ThemeColors, 'background' | 'foreground'>;
}
```

`src/themes/color.ts`:

```ts
export interface Rgba {
  r: number;
  g: number;
  b: number;
  /** 0..1 */
  a: number;
}

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function parseHex(hex: string): Rgba {
  const match = HEX.exec(hex.trim());
  if (!match) throw new Error(`Invalid hex color: ${hex}`);
  let digits = match[1];
  if (digits.length <= 4) digits = [...digits].map((d) => d + d).join('');
  const channel = (i: number) => parseInt(digits.slice(i, i + 2), 16);
  return { r: channel(0), g: channel(2), b: channel(4), a: digits.length === 8 ? channel(6) / 255 : 1 };
}

export function toHex({ r, g, b, a }: Rgba): string {
  const hex = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}${a < 1 ? hex(a * 255) : ''}`;
}

export function withAlpha(hex: string, alpha: number): string {
  return toHex({ ...parseHex(hex), a: alpha });
}

/** Linear RGB mix of `hex` toward `target`; keeps the alpha of `hex`. */
export function mix(hex: string, target: string, amount: number): string {
  const from = parseHex(hex);
  const to = parseHex(target);
  const lerp = (x: number, y: number) => x + (y - x) * amount;
  return toHex({ r: lerp(from.r, to.r), g: lerp(from.g, to.g), b: lerp(from.b, to.b), a: from.a });
}
```

`src/themes/resolve.ts`:

```ts
import { mix, withAlpha } from './color';
import type { Theme, ThemeColors } from './types';

type TokenColors = Pick<ThemeColors, 'key' | 'string' | 'number' | 'boolean' | 'null' | 'link'>;

// VS Code Dark+ / Light+ JSON token colors.
const defaultTokenColors: Record<Theme['type'], TokenColors> = {
  dark: {
    key: '#9cdcfe',
    string: '#ce9178',
    number: '#b5cea8',
    boolean: '#569cd6',
    null: '#569cd6',
    link: '#3794ff',
  },
  light: {
    key: '#0451a5',
    string: '#a31515',
    number: '#098658',
    boolean: '#0000ff',
    null: '#0000ff',
    link: '#006ab1',
  },
};

/** Fills every color the theme leaves out, following spec §4.1. */
export function resolveColors(theme: Theme): ThemeColors {
  const { background, foreground } = theme.colors;
  const dark = theme.type === 'dark';
  const derived: ThemeColors = {
    background,
    foreground,
    gutterBackground: background,
    gutterForeground: withAlpha(foreground, 0.6),
    punctuation: withAlpha(foreground, 0.6),
    foldPlaceholder: withAlpha(foreground, 0.6),
    activeLine: withAlpha(foreground, 0.06),
    selection: withAlpha(foreground, 0.2),
    cursor: foreground,
    toolbarBackground: dark ? mix(background, '#000000', 0.04) : mix(background, '#ffffff', 0.04),
    border: mix(background, '#000000', 0.1),
    ...defaultTokenColors[theme.type],
  };
  const defined = Object.fromEntries(
    Object.entries(theme.colors).filter(([, value]) => value !== undefined),
  );
  return { ...derived, ...defined };
}
```

`src/themes/css.ts`:

```ts
import { themeColorKeys, type ThemeColorKey, type ThemeColors } from './types';

export function cssVarName(key: ThemeColorKey): string {
  return `--jv-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

export function toCssVars(colors: ThemeColors): Record<string, string> {
  return Object.fromEntries(themeColorKeys.map((key) => [cssVarName(key), colors[key]]));
}
```

`src/themes/builtin/dark-plus.json`:

```json
{
  "id": "dark-plus",
  "name": "Dark+",
  "type": "dark",
  "source": "builtin",
  "colors": {
    "background": "#1e1e1e",
    "foreground": "#d4d4d4",
    "gutterBackground": "#1e1e1e",
    "gutterForeground": "#858585",
    "activeLine": "#2a2d2e",
    "selection": "#264f78",
    "cursor": "#aeafad",
    "foldPlaceholder": "#808080",
    "key": "#9cdcfe",
    "string": "#ce9178",
    "number": "#b5cea8",
    "boolean": "#569cd6",
    "null": "#569cd6",
    "punctuation": "#d4d4d4",
    "link": "#3794ff",
    "toolbarBackground": "#252526",
    "border": "#3c3c3c"
  }
}
```

`src/themes/builtin/index.ts`:

```ts
import type { Theme } from '../types';
import darkPlus from './dark-plus.json';

export const defaultTheme = darkPlus as Theme;
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

Run: `pnpm vitest run src/themes`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/themes
git commit -m "feat(themes): add compact theme format with derived colors and Dark+

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: URLs clicables (`editor/urls`)

**Files:**
- Create: `src/editor/urls.ts`
- Test: `src/editor/urls.test.ts`

**Interfaces:**
- Consumes: `ViewerOptions` (Task 6).
- Produces:
  - `URL_PATTERN: RegExp` (con flag `g`)
  - `linkTarget(opts: Pick<ViewerOptions, 'openLinksInNewWindow'>): '_blank' | '_self'`
  - `linkMarkSpec(url: string, opts: Pick<ViewerOptions, 'wrapLinkWithAnchorTag' | 'openLinksInNewWindow'>): { tagName: string; class: string; attributes: Record<string, string> }`
  - `clickableUrls(opts: Pick<ViewerOptions, 'wrapLinkWithAnchorTag' | 'openLinksInNewWindow'>): Extension` — los enlaces llevan clase `cm-url` y `data-url`.

- [ ] **Step 1: Escribir el test**

`src/editor/urls.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { linkMarkSpec, linkTarget, URL_PATTERN } from './urls';

const urls = (text: string) => text.match(URL_PATTERN) ?? [];

describe('URL_PATTERN', () => {
  it('finds http(s) URLs inside JSON strings', () => {
    expect(urls('"u": "https://example.com/a?b=1#c",')).toEqual(['https://example.com/a?b=1#c']);
    expect(urls('"http://localhost:3000/x" "https://a.b"')).toEqual([
      'http://localhost:3000/x',
      'https://a.b',
    ]);
  });

  it('stops at quotes, whitespace and escapes', () => {
    expect(urls('"https://a.b/c\\"d"')).toEqual(['https://a.b/c']);
    expect(urls('"https://a.b/c d"')).toEqual(['https://a.b/c']);
  });

  it('ignores other schemes', () => {
    expect(urls('"ftp://a.b" "mailto:x@y.z"')).toEqual([]);
  });
});

describe('linkTarget', () => {
  it('follows openLinksInNewWindow', () => {
    expect(linkTarget({ openLinksInNewWindow: true })).toBe('_blank');
    expect(linkTarget({ openLinksInNewWindow: false })).toBe('_self');
  });
});

describe('linkMarkSpec', () => {
  it('builds a real anchor when wrapLinkWithAnchorTag is on', () => {
    expect(
      linkMarkSpec('https://a.b', { wrapLinkWithAnchorTag: true, openLinksInNewWindow: true }),
    ).toEqual({
      tagName: 'a',
      class: 'cm-url',
      attributes: {
        href: 'https://a.b',
        target: '_blank',
        rel: 'noopener noreferrer',
        'data-url': 'https://a.b',
      },
    });
  });

  it('builds a span otherwise', () => {
    expect(
      linkMarkSpec('https://a.b', { wrapLinkWithAnchorTag: false, openLinksInNewWindow: false }),
    ).toEqual({ tagName: 'span', class: 'cm-url', attributes: { 'data-url': 'https://a.b' } });
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `pnpm vitest run src/editor/urls.test.ts`
Expected: FAIL — `Failed to resolve import "./urls"`.

- [ ] **Step 3: Implementar**

`src/editor/urls.ts`:

```ts
import type { Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import type { ViewerOptions } from '@/viewer/options';

type LinkOptions = Pick<ViewerOptions, 'wrapLinkWithAnchorTag' | 'openLinksInNewWindow'>;

export const URL_PATTERN = /\bhttps?:\/\/[^\s"\\<>]+/g;

export function linkTarget(opts: Pick<ViewerOptions, 'openLinksInNewWindow'>): '_blank' | '_self' {
  return opts.openLinksInNewWindow ? '_blank' : '_self';
}

export function linkMarkSpec(
  url: string,
  opts: LinkOptions,
): { tagName: string; class: string; attributes: Record<string, string> } {
  if (opts.wrapLinkWithAnchorTag) {
    return {
      tagName: 'a',
      class: 'cm-url',
      attributes: { href: url, target: linkTarget(opts), rel: 'noopener noreferrer', 'data-url': url },
    };
  }
  return { tagName: 'span', class: 'cm-url', attributes: { 'data-url': url } };
}

export function clickableUrls(opts: LinkOptions): Extension {
  const decorator = new MatchDecorator({
    regexp: URL_PATTERN,
    decoration: (match) => Decoration.mark(linkMarkSpec(match[0], opts)),
  });

  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = decorator.createDeco(view);
      }
      update(update: ViewUpdate) {
        this.decorations = decorator.updateDeco(update, this.decorations);
      }
    },
    { decorations: (instance) => instance.decorations },
  );

  // The editor is contenteditable, so anchors don't navigate on their own.
  const clicks = EditorView.domEventHandlers({
    click(event) {
      if (event.button !== 0) return false;
      const link = (event.target as HTMLElement | null)?.closest?.<HTMLElement>('.cm-url');
      const url = link?.dataset.url;
      if (!url) return false;
      event.preventDefault();
      if (linkTarget(opts) === '_blank') window.open(url, '_blank', 'noopener');
      else window.location.href = url;
      return true;
    },
  });

  return [plugin, clicks];
}
```

- [ ] **Step 4: Ejecutar y verificar que pasa**

Run: `pnpm vitest run src/editor/urls.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/editor
git commit -m "feat(editor): make URLs in JSON strings clickable

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Plegado con tamaño, línea de error, tema y `buildExtensions`

**Files:**
- Create: `src/editor/foldSummary.ts`, `src/editor/errorLine.ts`, `src/editor/theme.ts`, `src/editor/setup.ts`
- Test: `src/editor/foldSummary.test.ts`, `src/editor/errorLine.test.ts`, `src/editor/setup.test.ts`

**Interfaces:**
- Consumes: `ViewerOptions` (Task 6); `Theme`, `ThemeColorKey`, `cssVarName` (Task 7); `clickableUrls` (Task 8).
- Produces:
  - `interface FoldSummary { type: 'object' | 'array'; count: number }`
  - `summarizeFold(state: EditorState, from: number): FoldSummary | null` (`from` = inicio del rango plegado, justo después de `{`/`[`)
  - `formatFoldSummary(summary: FoldSummary): string` (`'1 item'`, `'3 items'`, `'1 key'`, `'2 keys'`)
  - `foldSummaries(): Extension`
  - `errorLineDecorations(doc: Text, line: number): DecorationSet`, `errorLine(line: number): Extension` (clase `cm-jv-error-line`)
  - `toCodeMirrorTheme(theme: Theme): Extension`
  - `interface EditorSetup { options: ViewerOptions; theme: Theme; errorLine: number | null }`, `buildExtensions(setup: EditorSetup): Extension[]`

- [ ] **Step 1: Escribir los tests**

`src/editor/foldSummary.test.ts`:

```ts
// @vitest-environment happy-dom
import { json } from '@codemirror/lang-json';
import { ensureSyntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { formatFoldSummary, summarizeFold } from './foldSummary';

// Offsets: "{" 0, "[" 9, inner "{" 16, outer "c" value "{" 37
const doc = '{\n  "a": [1, 2, {"b": null}],\n  "c": {}\n}';
const state = EditorState.create({ doc, extensions: [json()] });
ensureSyntaxTree(state, state.doc.length);

describe('summarizeFold', () => {
  it('counts array items', () => {
    expect(summarizeFold(state, 10)).toEqual({ type: 'array', count: 3 });
  });

  it('counts object keys', () => {
    expect(summarizeFold(state, 1)).toEqual({ type: 'object', count: 2 });
    expect(summarizeFold(state, 17)).toEqual({ type: 'object', count: 1 });
  });

  it('returns null when the position does not follow a bracket', () => {
    expect(summarizeFold(state, 5)).toBeNull();
  });
});

describe('formatFoldSummary', () => {
  it('pluralizes', () => {
    expect(formatFoldSummary({ type: 'array', count: 1 })).toBe('1 item');
    expect(formatFoldSummary({ type: 'array', count: 3 })).toBe('3 items');
    expect(formatFoldSummary({ type: 'object', count: 1 })).toBe('1 key');
    expect(formatFoldSummary({ type: 'object', count: 2 })).toBe('2 keys');
  });
});
```

`src/editor/errorLine.test.ts`:

```ts
// @vitest-environment happy-dom
import { Text } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { errorLineDecorations } from './errorLine';

const doc = Text.of(['a', 'b', 'c']);

describe('errorLineDecorations', () => {
  it('marks the start of the requested line', () => {
    const cursor = errorLineDecorations(doc, 2).iter();
    expect(cursor.from).toBe(2);
    expect(cursor.value?.spec.class).toBe('cm-jv-error-line');
  });

  it('clamps lines past the end of the document', () => {
    expect(errorLineDecorations(doc, 99).iter().from).toBe(4);
  });

  it('clamps lines before the start of the document', () => {
    expect(errorLineDecorations(doc, 0).iter().from).toBe(0);
  });
});
```

`src/editor/setup.test.ts`:

```ts
// @vitest-environment happy-dom
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { defaultTheme } from '@/themes/builtin';
import { defaultViewerOptions, type ViewerOptions } from '@/viewer/options';
import { buildExtensions } from './setup';

const create = (options: ViewerOptions, errorLine: number | null = null) =>
  EditorState.create({
    doc: '{\n  "a": "https://example.com"\n}',
    extensions: buildExtensions({ options, theme: defaultTheme, errorLine }),
  });

describe('buildExtensions', () => {
  it('creates a read-only state with the configured tab size', () => {
    const state = create({ ...defaultViewerOptions, tabSize: 4 });
    expect(state.readOnly).toBe(true);
    expect(state.tabSize).toBe(4);
  });

  it('accepts every feature switched on', () => {
    const all = { ...defaultViewerOptions, showArraySize: true, wrapLinkWithAnchorTag: true };
    expect(() => create(all, 2)).not.toThrow();
  });

  it('accepts every feature switched off', () => {
    const none: ViewerOptions = {
      ...defaultViewerOptions,
      clickableUrls: false,
      lineNumbers: false,
      lineWrapping: false,
      foldGutter: false,
      showArraySize: false,
    };
    expect(() => create(none)).not.toThrow();
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `pnpm vitest run src/editor`
Expected: FAIL — `Failed to resolve import "./foldSummary"`, `"./errorLine"`, `"./setup"` (los tests de `urls` siguen en verde).

- [ ] **Step 3: Implementar `foldSummary.ts`**

`src/editor/foldSummary.ts`:

```ts
import { codeFolding, syntaxTree } from '@codemirror/language';
import type { EditorState, Extension } from '@codemirror/state';

export interface FoldSummary {
  type: 'object' | 'array';
  count: number;
}

const ARRAY_PUNCTUATION = new Set(['[', ']', ',']);

/** Summarizes the object/array whose fold range starts at `from` (just after its bracket). */
export function summarizeFold(state: EditorState, from: number): FoldSummary | null {
  const bracket = syntaxTree(state).resolveInner(from - 1, 1);
  const node = bracket.parent;
  if (!node || (node.name !== 'Object' && node.name !== 'Array')) return null;

  let count = 0;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (node.name === 'Object' ? child.name === 'Property' : !ARRAY_PUNCTUATION.has(child.name)) {
      count++;
    }
  }
  return { type: node.name === 'Object' ? 'object' : 'array', count };
}

export function formatFoldSummary({ type, count }: FoldSummary): string {
  const noun = type === 'array' ? 'item' : 'key';
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** Fold placeholders that show how many items/keys are hidden ("… 3 items"). */
export function foldSummaries(): Extension {
  return codeFolding({
    preparePlaceholder: (state, range) => summarizeFold(state, range.from),
    placeholderDOM(_view, onclick, prepared: FoldSummary | null) {
      const el = document.createElement('span');
      el.className = 'cm-foldPlaceholder';
      el.textContent = prepared ? `… ${formatFoldSummary(prepared)}` : '…';
      el.title = 'Unfold';
      el.onclick = onclick;
      return el;
    },
  });
}
```

- [ ] **Step 4: Implementar `errorLine.ts`**

`src/editor/errorLine.ts`:

```ts
import type { Extension, Text } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';

const errorLineMark = Decoration.line({ class: 'cm-jv-error-line' });

export function errorLineDecorations(doc: Text, line: number): DecorationSet {
  const clamped = Math.min(Math.max(line, 1), doc.lines);
  return Decoration.set([errorLineMark.range(doc.line(clamped).from)]);
}

export function errorLine(line: number): Extension {
  return EditorView.decorations.of((view) => errorLineDecorations(view.state.doc, line));
}
```

- [ ] **Step 5: Implementar `theme.ts`**

`src/editor/theme.ts`:

```ts
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { cssVarName } from '@/themes/css';
import type { Theme, ThemeColorKey } from '@/themes/types';

// Colors are CSS variables set on the viewer root (see toCssVars), so switching
// themes only swaps variables; the CodeMirror theme itself depends only on dark/light.
const v = (key: ThemeColorKey) => `var(${cssVarName(key)})`;

const highlight = HighlightStyle.define([
  { tag: t.propertyName, color: v('key') },
  { tag: t.string, color: v('string') },
  { tag: t.number, color: v('number') },
  { tag: t.bool, color: v('boolean') },
  { tag: t.null, color: v('null') },
  { tag: [t.separator, t.brace, t.squareBracket], color: v('punctuation') },
]);

function editorTheme(dark: boolean): Extension {
  return EditorView.theme(
    {
      '&': { color: v('foreground'), backgroundColor: v('background'), height: '100%' },
      '.cm-scroller': {
        fontFamily: 'var(--jv-font-family)',
        fontSize: 'var(--jv-font-size)',
        lineHeight: 'var(--jv-line-height)',
      },
      '.cm-content': { caretColor: v('cursor') },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: v('cursor') },
      '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
        { backgroundColor: v('selection') },
      '.cm-activeLine': { backgroundColor: v('activeLine') },
      '.cm-gutters': {
        backgroundColor: v('gutterBackground'),
        color: v('gutterForeground'),
        border: 'none',
      },
      '.cm-activeLineGutter': { backgroundColor: v('activeLine') },
      '.cm-foldPlaceholder': {
        backgroundColor: 'transparent',
        border: 'none',
        color: v('foldPlaceholder'),
        cursor: 'pointer',
      },
      '.cm-url, .cm-url span': { color: v('link'), textDecoration: 'underline', cursor: 'pointer' },
      '.cm-jv-error-line': { backgroundColor: 'rgba(255, 64, 64, 0.18)' },
      '.cm-panels': { backgroundColor: v('toolbarBackground'), color: v('foreground') },
      '.cm-panels.cm-panels-top': { borderBottom: `1px solid ${v('border')}` },
    },
    { dark },
  );
}

export function toCodeMirrorTheme(theme: Theme): Extension {
  return [editorTheme(theme.type === 'dark'), syntaxHighlighting(highlight)];
}
```

- [ ] **Step 6: Implementar `setup.ts`**

`src/editor/setup.ts`:

```ts
import { defaultKeymap } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { foldGutter, foldKeymap } from '@codemirror/language';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { EditorState, type Extension } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import type { Theme } from '@/themes/types';
import type { ViewerOptions } from '@/viewer/options';
import { errorLine } from './errorLine';
import { foldSummaries } from './foldSummary';
import { toCodeMirrorTheme } from './theme';
import { clickableUrls } from './urls';

export interface EditorSetup {
  options: ViewerOptions;
  theme: Theme;
  errorLine: number | null;
}

export function buildExtensions({ options, theme, errorLine: line }: EditorSetup): Extension[] {
  const extensions: Extension[] = [
    // Read-only but still focusable, so the cursor, search and keyboard navigation work.
    EditorState.readOnly.of(true),
    EditorState.tabSize.of(options.tabSize),
    json(),
    drawSelection(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    search({ top: true }),
    keymap.of([...searchKeymap, ...foldKeymap, ...defaultKeymap]),
    toCodeMirrorTheme(theme),
  ];
  if (options.lineNumbers) extensions.push(lineNumbers(), highlightActiveLineGutter());
  if (options.foldGutter) extensions.push(foldGutter());
  if (options.showArraySize) extensions.push(foldSummaries());
  if (options.lineWrapping) extensions.push(EditorView.lineWrapping);
  if (options.clickableUrls) extensions.push(clickableUrls(options));
  if (line !== null) extensions.push(errorLine(line));
  return extensions;
}
```

- [ ] **Step 7: Ejecutar y verificar que pasan**

Run: `pnpm vitest run src/editor`
Expected: PASS (urls, foldSummary, errorLine, setup).

- [ ] **Step 8: Verificar tipos y commit**

Run: `pnpm compile`
Expected: exit 0.

```bash
git add src/editor
git commit -m "feat(editor): add fold summaries, error line, theme and editor setup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Detector, inyección y visor mínimo (con e2e)

**Files:**
- Create: `src/messages.ts`, `src/entrypoints/detector.content.ts`, `src/entrypoints/viewer.content/index.ts`, `src/entrypoints/viewer.content/style.css`, `src/components/CodeView.vue`, `src/components/JsonViewer.vue`, `playwright.config.ts`, `e2e/server.ts`, `e2e/fixtures.ts`, `e2e/viewer.spec.ts`
- Modify: `src/entrypoints/background.ts`
- Test: `src/messages.test.ts`, `e2e/viewer.spec.ts`

**Interfaces:**
- Consumes: `detect` (Task 2), `readRawText` (Task 3), `prepareDocument`, `defaultViewerOptions`, `ViewerOptions` (Task 6), `defaultTheme`, `resolveColors`, `toCssVars`, `Theme` (Task 7), `buildExtensions` (Task 9).
- Produces:
  - `JSON_DETECTED = 'json-detected'`, `interface JsonDetectedMessage { type: 'json-detected' }`, `isJsonDetectedMessage(value: unknown): value is JsonDetectedMessage`
  - Custom element del shadow root: `json-viewer-app`. Atributo de guarda: `data-json-viewer` en `<html>`.
  - `<JsonViewer :raw :options :theme :source>` con `source?: { url: string; loadedAt: Date }`; raíz `.jv-root`.
  - `<CodeView :doc :options :theme :error-line>`; raíz `.jv-code`.
  - Fixtures e2e: `test`, `expect` (de `e2e/fixtures.ts`) con fixtures `context`, `extensionId`, `server` (`server.url(path)`).

- [ ] **Step 1: Test unitario del mensaje**

`src/messages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isJsonDetectedMessage, JSON_DETECTED } from './messages';

describe('isJsonDetectedMessage', () => {
  it('accepts the detector message only', () => {
    expect(isJsonDetectedMessage({ type: JSON_DETECTED })).toBe(true);
    expect(isJsonDetectedMessage({ type: 'other' })).toBe(false);
    expect(isJsonDetectedMessage(null)).toBe(false);
    expect(isJsonDetectedMessage('json-detected')).toBe(false);
  });
});
```

Run: `pnpm vitest run src/messages.test.ts`
Expected: FAIL — `Failed to resolve import "./messages"`.

- [ ] **Step 2: Implementar `messages.ts`**

`src/messages.ts`:

```ts
export const JSON_DETECTED = 'json-detected';

export interface JsonDetectedMessage {
  type: typeof JSON_DETECTED;
}

export function isJsonDetectedMessage(value: unknown): value is JsonDetectedMessage {
  return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === JSON_DETECTED;
}
```

Run: `pnpm vitest run src/messages.test.ts`
Expected: PASS.

- [ ] **Step 3: Escribir el arnés e2e y los tests de esta tarea**

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  workers: 1,
  reporter: 'list',
});
```

`e2e/server.ts`:

```ts
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FixtureServer {
  url(path: string): string;
  close(): Promise<void>;
}

const bigJson = JSON.stringify(
  Array.from({ length: 50_000 }, (_, i) => ({
    id: i,
    name: `item ${i}`,
    url: `https://example.com/${i}`,
    tags: ['a', 'b'],
  })),
);

const routes: Record<string, { type: string; body: string }> = {
  '/data.json': {
    type: 'application/json',
    body: '{"name":"x","url":"https://example.com/a","nested":{"list":[1,2,3]},"big":12345678901234567890}',
  },
  '/ld': { type: 'application/ld+json; charset=utf-8', body: '{"@context":"https://schema.org"}' },
  '/plain-json': { type: 'text/plain', body: '[{"a":1}]' },
  '/plain-log': { type: 'text/plain', body: '[INFO] server started' },
  '/page.html': { type: 'text/html', body: '<!doctype html><title>t</title><pre>{"a":1}</pre>' },
  '/invalid.json': { type: 'application/json', body: '{\n  "a": 1,\n}' },
  '/bom.json': { type: 'application/json', body: '\uFEFF{"a":1}' },
  '/big.json': { type: 'application/json', body: bigJson },
};

export async function startFixtureServer(): Promise<FixtureServer> {
  const server = http.createServer((req, res) => {
    const route = routes[req.url ?? ''];
    if (!route) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': route.type });
    res.end(route.body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: (path) => `http://127.0.0.1:${port}${path}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
```

`e2e/fixtures.ts`:

```ts
import path from 'node:path';
import { test as base, chromium, type BrowserContext } from '@playwright/test';
import { startFixtureServer, type FixtureServer } from './server';

const extensionPath = path.resolve('.output/chrome-mv3');

export const test = base.extend<
  { context: BrowserContext; extensionId: string },
  { server: FixtureServer }
>({
  server: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const server = await startFixtureServer();
      await use(server);
      await server.close();
    },
    { scope: 'worker' },
  ],
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    await use(new URL(worker.url()).host);
  },
});

export const expect = test.expect;
```

`e2e/viewer.spec.ts`:

```ts
import { expect, test } from './fixtures';

const viewer = 'json-viewer-app';

test.beforeEach(async ({ extensionId }) => {
  // Requesting the fixture makes sure the extension's service worker is up.
  expect(extensionId).toMatch(/^[a-p]{32}$/);
});

test('renders application/json responses formatted', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const content = page.locator(`${viewer} .cm-content`);
  await expect(content).toContainText('"name": "x"');
  await expect(content).toContainText('12345678901234567890');
  await expect(page.locator('body > pre')).toBeHidden();
});

test('renders +json and JSON served as text/plain', async ({ context, server }) => {
  const page = await context.newPage();
  for (const route of ['/ld', '/plain-json']) {
    await page.goto(server.url(route));
    await expect(page.locator(`${viewer} .cm-content`)).toBeVisible();
  }
});

test('leaves HTML pages and plain-text logs alone', async ({ context, server }) => {
  const page = await context.newPage();
  for (const route of ['/page.html', '/plain-log']) {
    await page.goto(server.url(route));
    await page.waitForTimeout(500);
    await expect(page.locator(viewer)).toHaveCount(0);
    await expect(page.locator('body > pre')).toBeVisible();
  }
});

test('renders a ~4 MB document', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/big.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"item 0"', { timeout: 15_000 });
});
```

- [ ] **Step 4: Ejecutar e2e y verificar que fallan**

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

Expected: build OK; los tests `renders …` FAIL por timeout esperando `json-viewer-app .cm-content` (aún no hay detector ni visor). `leaves HTML pages …` puede pasar.

- [ ] **Step 5: Implementar detector y background**

`src/entrypoints/detector.content.ts`:

```ts
import { detect } from '@/detect/detect';
import { readRawText } from '@/detect/readRawText';
import { JSON_DETECTED, type JsonDetectedMessage } from '@/messages';

// Runs on every page: keep this free of Vue/CodeMirror imports.
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_end',
  main() {
    const text = readRawText(document);
    if (text === null || !detect(document.contentType, text)) return;
    const message: JsonDetectedMessage = { type: JSON_DETECTED };
    void browser.runtime.sendMessage(message);
  },
});
```

`src/entrypoints/background.ts`:

```ts
import { isJsonDetectedMessage } from '@/messages';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender) => {
    if (!isJsonDetectedMessage(message)) return;
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    browser.scripting
      .executeScript({
        target: { tabId, frameIds: [sender.frameId ?? 0] },
        files: ['/content-scripts/viewer.js'],
      })
      .catch((error: unknown) => console.warn('[json-viewer] viewer injection failed', error));
  });
});
```

- [ ] **Step 6: Implementar componentes y entrypoint del visor**

`src/components/CodeView.vue`:

```vue
<script setup lang="ts">
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { buildExtensions } from '@/editor/setup';
import type { Theme } from '@/themes/types';
import type { ViewerOptions } from '@/viewer/options';

const props = defineProps<{
  doc: string;
  options: ViewerOptions;
  theme: Theme;
  errorLine: number | null;
}>();

const host = ref<HTMLDivElement>();
let view: EditorView | undefined;

function createState(): EditorState {
  return EditorState.create({
    doc: props.doc,
    extensions: buildExtensions({ options: props.options, theme: props.theme, errorLine: props.errorLine }),
  });
}

function revealErrorLine(): void {
  if (!view || props.errorLine === null) return;
  const doc = view.state.doc;
  const line = doc.line(Math.min(Math.max(props.errorLine, 1), doc.lines));
  view.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: 'center' }) });
}

onMounted(() => {
  view = new EditorView({ state: createState(), parent: host.value! });
  revealErrorLine();
});

watch(
  () => [props.doc, props.options, props.theme, props.errorLine],
  () => {
    view?.setState(createState());
    revealErrorLine();
  },
);

onBeforeUnmount(() => view?.destroy());
</script>

<template>
  <div ref="host" class="jv-code" />
</template>
```

`src/components/JsonViewer.vue` (versión mínima; Task 11 la completa):

```vue
<script setup lang="ts">
import { computed } from 'vue';
import CodeView from './CodeView.vue';
import { toCssVars } from '@/themes/css';
import { resolveColors } from '@/themes/resolve';
import type { Theme } from '@/themes/types';
import type { ViewerOptions } from '@/viewer/options';
import { prepareDocument } from '@/viewer/prepare';

const props = defineProps<{
  raw: string;
  options: ViewerOptions;
  theme: Theme;
  source?: { url: string; loadedAt: Date };
}>();

const prepared = computed(() => prepareDocument(props.raw, props.options));
const cssVars = computed(() => toCssVars(resolveColors(props.theme)));
</script>

<template>
  <div class="jv-root" :class="`jv-${theme.type}`" :style="cssVars">
    <CodeView
      class="jv-body"
      :doc="prepared.text"
      :options="options"
      :theme="theme"
      :error-line="prepared.ok ? null : prepared.error.line"
    />
  </div>
</template>
```

`src/entrypoints/viewer.content/style.css`:

```css
.jv-root {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  background: var(--jv-background);
  color: var(--jv-foreground);
  font: 13px/1.4 system-ui, sans-serif;
  --jv-font-family: ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace;
  --jv-font-size: 13px;
  --jv-line-height: 1.5;
}

.jv-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.jv-code .cm-editor {
  height: 100%;
}
```

`src/entrypoints/viewer.content/index.ts`:

```ts
import './style.css';
import { createApp } from 'vue';
import JsonViewer from '@/components/JsonViewer.vue';
import { readRawText } from '@/detect/readRawText';
import { defaultTheme } from '@/themes/builtin';
import { defaultViewerOptions } from '@/viewer/options';

const GUARD = 'data-json-viewer';

export default defineContentScript({
  matches: ['<all_urls>'],
  registration: 'runtime',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const root = document.documentElement;
    if (root.hasAttribute(GUARD)) return;
    const raw = readRawText(document);
    if (raw === null) return;
    root.setAttribute(GUARD, '');

    // Hide (don't remove) the browser's rendering so the original stays recoverable.
    for (const el of Array.from(document.body.children)) {
      (el as HTMLElement).style.display = 'none';
    }

    const ui = await createShadowRootUi(ctx, {
      name: 'json-viewer-app',
      position: 'inline',
      anchor: 'body',
      onMount(container) {
        const app = createApp(JsonViewer, {
          raw,
          options: defaultViewerOptions,
          theme: defaultTheme,
          source: { url: location.href, loadedAt: new Date() },
        });
        app.mount(container);
        return app;
      },
      onRemove(app) {
        app?.unmount();
      },
    });
    ui.mount();
  },
});
```

- [ ] **Step 7: Ejecutar e2e y unit tests y verificar que pasan**

```bash
pnpm test:e2e
pnpm test
pnpm compile
```

Expected: los 4 tests e2e PASS; `pnpm test` PASS; `pnpm compile` exit 0.

- [ ] **Step 8: Verificar el peso del detector y el manifest**

```bash
ls -l .output/chrome-mv3/content-scripts/
cat .output/chrome-mv3/manifest.json
```

Expected:
- `detector.js` ≤ 8192 bytes; existen `viewer.js` y `viewer.css`.
- El manifest tiene `content_scripts` solo con `content-scripts/detector.js` (`run_at: document_end`), `host_permissions: ["<all_urls>"]` y `web_accessible_resources` con `content-scripts/viewer.css`.

Si `detector.js` supera 8 kB, revisar que no importe nada de `@/components`, `@/editor`, `vue` ni `@codemirror/*`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: detect JSON pages and inject the CodeMirror viewer on demand

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Barra (Code/Raw + encabezado), banner de error y enlaces (con e2e)

**Files:**
- Create: `src/components/ViewerToolbar.vue`
- Modify: `src/components/JsonViewer.vue` (reemplazo completo), `src/entrypoints/viewer.content/style.css` (añadir reglas), `e2e/viewer.spec.ts` (añadir tests)

**Interfaces:**
- Consumes: todo lo de Task 10.
- Produces: `<ViewerToolbar v-model:mode :source>` con `mode: 'code' | 'raw'`; pestañas con `role="tab"` y nombres accesibles `Code` y `Raw`; clases `.jv-toolbar`, `.jv-url`, `.jv-error`, `.jv-raw`.

- [ ] **Step 1: Añadir los tests e2e**

Añadir al final de `e2e/viewer.spec.ts`:

```ts
test('colors keys with the Dark+ theme', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const keyLine = page.locator(`${viewer} .cm-line`, { hasText: '"name"' });
  await expect(keyLine.locator('span').first()).toHaveCSS('color', 'rgb(156, 220, 254)');
});

test('shows the URL header and toggles Raw', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  await expect(page.locator(`${viewer} .jv-url`)).toHaveText(server.url('/data.json'));

  await page.getByRole('tab', { name: 'Raw' }).click();
  await expect(page.locator(`${viewer} .jv-raw`)).toContainText('{"name":"x"');
  await expect(page.locator(`${viewer} .cm-editor`)).toHaveCount(0);

  await page.getByRole('tab', { name: 'Code' }).click();
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"name": "x"');
});

test('shows a located error for invalid JSON', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/invalid.json'));
  await expect(page.locator(`${viewer} .jv-error`)).toContainText('line 3, column 1');
  await expect(page.locator(`${viewer} .cm-jv-error-line`)).toHaveCount(1);
});

test('treats a BOM-prefixed body as valid JSON', async ({ context, server }) => {
  const page = await context.newPage();
  await page.goto(server.url('/bom.json'));
  await expect(page.locator(`${viewer} .cm-content`)).toContainText('"a": 1');
  await expect(page.locator(`${viewer} .jv-error`)).toHaveCount(0);
});

test('opens clicked URLs in a new tab', async ({ context, server }) => {
  await context.route('https://example.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>ok</p>' }),
  );
  const page = await context.newPage();
  await page.goto(server.url('/data.json'));
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    page.locator(`${viewer} .cm-url`).first().click(),
  ]);
  await popup.waitForURL('https://example.com/a');
});
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `pnpm test:e2e`
Expected: los 5 tests nuevos FAIL (no existen `.jv-url`, la pestaña `Raw` ni `.jv-error`; el de color y el de URL pueden pasar ya, porque Task 9/10 los cubren a nivel de editor). Los 4 tests de Task 10 siguen PASS.

- [ ] **Step 3: Crear `ViewerToolbar.vue`**

`src/components/ViewerToolbar.vue`:

```vue
<script setup lang="ts">
defineProps<{ source?: { url: string; loadedAt: Date } }>();
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
  </header>
</template>
```

- [ ] **Step 4: Reemplazar `JsonViewer.vue` completo**

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

const props = defineProps<{
  raw: string;
  options: ViewerOptions;
  theme: Theme;
  source?: { url: string; loadedAt: Date };
}>();

const prepared = computed(() => prepareDocument(props.raw, props.options));
const cssVars = computed(() => toCssVars(resolveColors(props.theme)));
// autoHighlight=false starts on Raw; the Code tab still formats on demand.
const mode = ref<'code' | 'raw'>(props.options.autoHighlight ? 'code' : 'raw');
</script>

<template>
  <div class="jv-root" :class="`jv-${theme.type}`" :style="cssVars">
    <ViewerToolbar v-model:mode="mode" :source="options.showHeader ? source : undefined" />
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
      :error-line="prepared.ok ? null : prepared.error.line"
    />
    <pre v-else class="jv-body jv-raw">{{ raw }}</pre>
  </div>
</template>
```

- [ ] **Step 5: Añadir estilos de barra, banner y Raw**

Añadir al final de `src/entrypoints/viewer.content/style.css`:

```css
.jv-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px;
  background: var(--jv-toolbar-background);
  border-bottom: 1px solid var(--jv-border);
}

.jv-modes {
  display: flex;
}

.jv-modes button {
  background: transparent;
  color: inherit;
  border: 1px solid var(--jv-border);
  padding: 2px 10px;
  font: inherit;
  cursor: pointer;
}

.jv-modes button + button {
  border-left: none;
}

.jv-modes button[aria-selected='true'] {
  background: var(--jv-selection);
}

.jv-source {
  display: flex;
  gap: 12px;
  min-width: 0;
  opacity: 0.8;
}

.jv-url {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.jv-error {
  padding: 6px 10px;
  background: #5a1d1d;
  color: #ffd7d7;
  border-bottom: 1px solid var(--jv-border);
}

.jv-raw {
  margin: 0;
  padding: 8px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--jv-font-family);
  font-size: var(--jv-font-size);
  line-height: var(--jv-line-height);
}
```

- [ ] **Step 6: Ejecutar todo y verificar que pasa**

```bash
pnpm test:e2e
pnpm test
pnpm compile
```

Expected: 9 tests e2e PASS; unit tests PASS; `compile` exit 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(viewer): add Code/Raw toolbar, URL header and located error banner

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: README y verificación manual en Edge (checkpoint humano)

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: build de `.output/chrome-mv3`.
- Produces: instrucciones de desarrollo y carga; checklist verificada por el usuario.

- [ ] **Step 1: Escribir `README.md`**

````markdown
# JSON Viewer

Visor de JSON para Edge y Chrome hecho con [WXT](https://wxt.dev), Vue 3 y CodeMirror 6.
Inspirado en [tulios/json-viewer](https://github.com/tulios/json-viewer).

## Desarrollo

```bash
pnpm install
pnpm dev:edge      # abre Edge con la extensión (requiere web-ext.config.ts local)
pnpm test          # unit tests (Vitest)
pnpm test:e2e      # build + e2e (Playwright, Chromium)
pnpm build         # .output/chrome-mv3
```

## Cargar en Edge / Chrome

1. `pnpm build`
2. Abrir `edge://extensions` (o `chrome://extensions`) y activar **Modo de desarrollador**.
3. **Cargar desempaquetada** → seleccionar `.output/chrome-mv3`.
4. Desactivar otras extensiones de JSON (p. ej. tulios/json-viewer) para evitar conflictos.

## Documentación

- Diseño: `docs/superpowers/specs/2026-10-11-json-viewer-design.md`
- Visores nativos: `docs/notes/native-viewers.md`
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with development and loading instructions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Checkpoint humano — verificación en Edge**

Pedir al usuario que haga `pnpm build`, cargue `.output/chrome-mv3` en `edge://extensions` (con la extensión JSON Viewer original desactivada) y confirme:

1. `https://jsonplaceholder.typicode.com/users` → visor con Dark+, números de línea, plegado y URLs clicables.
2. La pestaña **Raw** muestra el texto original; **Code** vuelve a la vista formateada.
3. Una página HTML normal (p. ej. `https://wxt.dev`) no cambia.
4. Un archivo `.txt` local que empiece con `[` y no sea JSON no cambia.
5. `edge://extensions` → la extensión no muestra errores.

Registrar el resultado (OK / problemas) en `docs/notes/native-viewers.md`, sección nueva "Verificación manual Fase 1", y commitear:

```bash
git add docs/notes/native-viewers.md
git commit -m "docs: record manual Edge verification for phase 1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
