# JSON Viewer (WXT) — Diseño

Fecha: 2026-10-11
Estado: aprobado en brainstorming, pendiente de revisión escrita

## 1. Objetivo

Crear una versión mejorada de [tulios/json-viewer](https://github.com/tulios/json-viewer) que se mantenga fiel a su experiencia (abrir una URL que devuelve JSON y verlo formateado, con números de línea, plegado y URLs clicables) pero con:

- Configuración por UI (interruptores, selectores, vista previa en vivo) en vez de editar JSON a mano.
- Temas basados en temas de VS Code: incluidos, importables y editables con un formato compacto.
- Selección de Google Fonts sin pegar `@font-face` en base64 manualmente.
- Funciones nuevas: navegación, acciones, valores enriquecidos, mejor detección y entrada.
- Ligera: las páginas que no son JSON no cargan el visor.

### Público y distribución

Uso personal primero (Edge y Chrome, cargada sin empaquetar), con estructura lista para publicar más adelante en Chrome Web Store y Edge Add-ons: permisos mínimos, permisos opcionales para hosts externos, i18n en/es.

### Criterios de éxito

1. Abrir una URL con `application/json` en Edge y Chrome muestra el visor con el tema y la fuente configurados.
2. Las páginas HTML normales no reciben más que el detector (~2 KB).
3. Todas las opciones del original tienen equivalente en UI (ver §6.7) excepto `alwaysRenderAllContent`, que deja de ser necesaria.
4. Un tema de VS Code (JSON/JSONC) pegado en opciones produce un tema usable sin editar nada.
5. Elegir una fuente de Google Fonts en opciones la aplica en el visor sin CSS manual, incluso en páginas con CSP restrictiva.
6. `pnpm test` (Vitest) y `pnpm test:e2e` (Playwright) en verde al cierre de cada fase.

## 2. Pila

- **WXT** (Manifest V3), TypeScript, **pnpm**.
- **Vue 3** (`@wxt-dev/module-vue`) para visor, opciones y scratchpad.
- **CodeMirror 6** (`@codemirror/lang-json`, fold, search, view, state).
- `jsonpath-plus` (con `eval: 'safe'`: intérprete propio, sin `eval`/`Function`; ver §6.2) para el filtro.
- `@wxt-dev/i18n` para en/es.
- `tm-themes` (devDependency) como fuente de los temas incluidos.
- Vitest (`WxtVitest`, `fakeBrowser`) y Playwright.
- Ícono: `vscode-icons:file-type-json` (ya presente en la raíz como `vscode-icons_file-type-light-json.svg`; se moverá a `assets/` y se generarán los PNG del manifest).

## 3. Arquitectura

Enfoque elegido: **detector mínimo + inyección bajo demanda**.

### 3.1 Entrypoints (`entrypoints/`)

| Entrypoint | Responsabilidad |
|---|---|
| `detector.content.ts` | `matches: ['<all_urls>']`, `runAt: 'document_end'`. Lee `document.contentType`, comprueba que el `<body>` contiene solo texto plano / un único `<pre>`, consulta la lista de sitios excluidos y, si corresponde, envía `{ type: 'json-detected' }` al background. Sin dependencias pesadas. |
| `background.ts` | Al recibir `json-detected`, inyecta el visor en la pestaña con `browser.scripting.executeScript`. Registra el menú contextual "Ver como JSON". Ejecuta migraciones de configuración en `runtime.onInstalled`. Abre el scratchpad al pulsar el ícono. |
| `viewer.content/` | `registration: 'runtime'` (no aparece en el manifest). Lee el texto crudo, lo parsea, reemplaza el documento y monta la app Vue dentro de un shadow root (`createShadowRootUi`). |
| `options/` | App Vue de opciones con vista previa en vivo. |
| `scratchpad/` | Página para pegar JSON y verlo con el mismo componente del visor. |

Permisos: `storage`, `scripting`, `contextMenus`, `host_permissions: ['<all_urls>']`. Permisos opcionales: `https://fonts.googleapis.com/*`, `https://fonts.gstatic.com/*` (solicitados al descargar la primera fuente).

### 3.2 Módulos compartidos (`src/`)

Cada módulo tiene una responsabilidad y una interfaz pequeña; la lógica es pura (sin DOM salvo donde se indica) para poder probarla con Vitest.

| Módulo | Responsabilidad | Interfaz principal |
|---|---|---|
| `detect/` | Decidir si una respuesta es JSON, JSONP o NDJSON | `detect(contentType: string, text: string): { kind: 'json' \| 'jsonp' \| 'ndjson' } \| null` |
| `parse/` | Parseo tolerante: quita el wrapper JSONP, divide NDJSON, conserva números grandes como texto, errores con línea/columna | `parse(text, kind): { ok: true, value, text } \| { ok: false, error: { message, line, column } }` |
| `settings/` | Esquema tipado, valores por defecto, validación, migraciones | `settingsItem` (`storage.defineItem('sync:settings', { fallback, version, migrations })`), `validateSettings(unknown): Settings` |
| `themes/` | Formato compacto, conversión VS Code→compacto, compacto→CodeMirror/variables CSS, registro de temas incluidos | `fromVSCode(jsonc: string): { theme, warnings }`, `toCssVars(theme)`, `toCodeMirrorTheme(theme)`, `builtinThemes` |
| `fonts/` | Catálogo curado, descarga vía API CSS2, almacenamiento, registro con `FontFace` | `parseCss2(css)`, `selectFaces(faces, subsets)`, `downloadFont(family, subsets)`, `createFontLoader(document.fonts)`, `trackStoredFont(family, loader)` |
| `editor/` | Extensiones de CodeMirror propias | `clickableUrls()`, `colorSwatches()`, `dateTooltips()`, `imagePreview()`, `arraySize()`, `cursorPath(onChange)`, `foldToLevel(view, n)` |
| `components/` | Componentes Vue compartidos (visor, barra, barra de estado, vista previa) | `<JsonViewer :text :kind :settings :theme />` |

### 3.3 Flujo

1. La página carga; el detector evalúa `contentType` + estructura del body.
2. Si es JSON y el host no está excluido → mensaje al background.
3. El background inyecta `viewer.content`.
4. El visor obtiene el texto crudo (ver riesgo §8.1), lee `sync:settings`, el tema activo y la fuente desde `local:`, y monta la UI.
5. Si el texto supera el umbral de modo ligero (por defecto 20 MB) se desactivan las decoraciones caras (colores, fechas, imágenes) y se avisa en la barra.
6. El visor observa (`watch`) la configuración: los cambios hechos en opciones se reflejan en pestañas abiertas sin recargar.

## 4. Temas

### 4.1 Formato compacto

```jsonc
{
  "id": "dracula",
  "name": "Dracula",
  "type": "dark",              // dark | light
  "source": "builtin",         // builtin | imported | custom
  "colors": {
    "background": "#282a36", "foreground": "#f8f8f2",
    "gutterBackground": "#282a36", "gutterForeground": "#6272a4",
    "activeLine": "#44475a80", "selection": "#44475a",
    "cursor": "#f8f8f0", "foldPlaceholder": "#6272a4",
    "key": "#8be9fd", "string": "#f1fa8c", "number": "#bd93f9",
    "boolean": "#bd93f9", "null": "#bd93f9", "punctuation": "#f8f8f2",
    "link": "#8be9fd", "toolbarBackground": "#21222c", "border": "#191a21"
  }
}
```

Solo `id`, `name`, `type`, `colors.background` y `colors.foreground` son obligatorios. Los demás colores se derivan:

- `gutterBackground` = `background`; `gutterForeground`, `punctuation`, `foldPlaceholder` = `foreground` al 60 % de opacidad.
- `activeLine` = `foreground` al 6 %; `selection` = `foreground` al 20 %; `cursor` = `foreground`.
- `toolbarBackground` / `border` = `background` oscurecido 4 % / 10 % (tema `dark`) o aclarado/oscurecido (tema `light`).
- `key`, `string`, `number`, `boolean`, `null`, `link` = colores de la paleta por defecto del `type` (Dark+ / Light+).

### 4.2 Conversor VS Code → compacto (`themes/fromVSCode.ts`)

- Acepta JSONC (comentarios y comas finales).
- `colors`: `editor.background`, `editor.foreground`, `editorLineNumber.foreground`, `editor.selectionBackground`, `editor.lineHighlightBackground`, `editorCursor.foreground`, `editorGutter.background`, `titleBar.activeBackground` (→ `toolbarBackground`), `panel.border` / `editorGroup.border` (→ `border`).
- `tokenColors`: resolución de scopes TextMate por "gana el selector más largo que sea prefijo del scope objetivo". Scopes objetivo:
  - `key`: `support.type.property-name.json`
  - `string`: `string.quoted.double.json`
  - `number`: `constant.numeric.json`
  - `boolean`: `constant.language.json`
  - `null`: `constant.language.json`
  - `punctuation`: `punctuation.separator.dictionary.key-value.json`
  - `link`: `markup.underline.link` (si no existe, `string`)
- `type` desde el campo `type` del tema (`dark`/`light`/`hc*`), o por luminancia del fondo si falta.
- Si existe `include`, se emite un aviso y los colores faltantes se derivan según §4.1.
- Devuelve `{ theme, warnings: string[] }`; error si no hay `editor.background` ni `tokenColors`.

### 4.3 Temas incluidos

`scripts/build-themes.ts` toma los JSON de `tm-themes`, los pasa por `fromVSCode`, y escribe `src/themes/builtin/<id>.json` más `src/themes/builtin/LICENSES.md`. Se ejecuta manualmente y el resultado se versiona (cero coste en runtime). Lista: One Dark Pro, Dracula, GitHub Dark, GitHub Light, Monokai, Tokyo Night, Catppuccin Mocha, Catppuccin Latte, Nord, Night Owl, Solarized Dark, Solarized Light, Ayu Dark, Material Theme, Dark+ y Light+.

### 4.4 Selección y edición

- Configuración: `themeMode: 'auto' | 'light' | 'dark'`, `lightThemeId`, `darkThemeId`. En `auto` se sigue `prefers-color-scheme`.
- El visor tiene un botón para alternar claro/oscuro solo en esa pestaña (no persiste).
- Temas importados o personalizados se guardan en `sync:customThemes` (lista; ~1 KB cada uno, dentro de las cuotas de `storage.sync`).
- Editor: "Duplicar y editar" sobre cualquier tema → cuadrícula de selectores de color + JSON compacto editable lado a lado + vista previa en vivo.
- Importar: pegar o subir `.json` de VS Code. Exportar: descarga del JSON compacto.

## 5. Fuentes

- **Catálogo curado** (`fonts/catalog.ts`) de ~20 familias monoespaciadas de Google Fonts. Lista final (verificada contra Google Fonts el 2026-10-12): JetBrains Mono, Fira Code, Source Code Pro, IBM Plex Mono, Roboto Mono, Ubuntu Mono, Inconsolata, Space Mono, Red Hat Mono, DM Mono, Geist Mono, Martian Mono, Victor Mono, Cascadia Code, Noto Sans Mono, Azeret Mono, Sometype Mono, Fragment Mono, Spline Sans Mono, Reddit Mono. Commit Mono no está en Google Fonts y se quitó.
- **Campo libre** para cualquier familia de Google Fonts, y opción **fuente del sistema** (texto libre, sin descarga).
- **Descarga**: `GET https://fonts.googleapis.com/css2?family=<Familia>:wght@300;400;500;600;700&display=swap` → `parseCss2` extrae los bloques `@font-face` (subset del comentario, peso, `unicode-range`, URL `woff2` de `fonts.gstatic.com`) → filtra por subsets (por defecto `latin`, `latin-ext`) → une en un rango (`"300 700"`) los pesos que comparten archivo (fuentes variables) → descarga cada archivo una vez (máx. 2 MB por familia) → guarda `local:fonts/<familia>` = `{ family, faces: [{ weight, unicodeRange, subset, dataBase64 }], bytes, subsets, downloadedAt }` y el índice `local:fontFamilies`.
- **Permisos**: ninguno extra. Ambos hosts responden `Access-Control-Allow-Origin: *`, así que la página de opciones descarga con `fetch` sin `host_permissions` (decisión de la Fase 3).
- **En el visor**: por cada face, `new FontFace(family, arrayBuffer, { weight, unicodeRange })` y `document.fonts.add(face)` (independiente de la CSP de la página). Pila final: `"<familia>", ui-monospace, Consolas, monospace`.
- **Controles**: tamaño (px), interlineado, ligaduras (`font-variant-ligatures`), peso.
- **Gestión**: lista de fuentes descargadas con tamaño ocupado y botón borrar.

## 6. Visor y funciones

### 6.1 Layout

```
┌ [Código|Raw]  🔍 $.items[*].id      ⇣ ⇡ N▾   ⧉ ⧉min ⬇   ⇅ claves   ☾ ⚙ ┐
│  1 ▾ {                                                                │
│  2     "createdAt": 1728691200,  ← tooltip: 2024-10-12 00:00 UTC      │
│  3     "color": "■ #ff5500",                                          │
│  4   ▸ "items": [...] // 120 items                                    │
└ $.items[3].email  (clic = copiar)    ·  12.4 KB · 1,203 líneas · JSON ┘
```

Todo dentro de un shadow root; el tema se aplica con variables CSS (`toCssVars`) y un tema de CodeMirror (`toCodeMirrorTheme`). Si `prependHeader` está activo, la URL y la fecha de carga se muestran en la barra superior (no como comentario dentro del JSON).

### 6.2 Barra superior

- Selector Código / Raw.
- Filtro JSONPath (`jsonpath-plus`, `eval: 'safe'`): el resultado se muestra formateado en el editor (solo lectura); `Esc` vuelve al documento completo; errores de sintaxis se muestran bajo el campo.
- Plegar todo, desplegar todo, plegar hasta nivel N.
- Copiar formateado, copiar minificado, descargar `.json`.
- Ordenar claves (re-formatea el documento sin recargar).
- Alternar claro/oscuro (solo pestaña).
- Abrir opciones.

Decisiones de la Fase 4:

- El filtro usa `eval: 'safe'` en vez de `eval: false`: con `false` ningún filtro `[?(...)]` funciona, y `'safe'` no ejecuta código ni accede a globales (compatible con CSP). Se aplica con Enter, no al escribir; el resultado es siempre un array y se abre sin plegar.
- Niveles: el valor raíz es el nivel 1. "Plegar todo" deja abierto el raíz (nivel 2); la UI muestra "Show N levels" (= nivel N + 1).
- Copiar y descargar actúan sobre lo que muestra Code (el resultado del filtro si hay uno). Sin API de portapapeles (http no local) se usa `execCommand('copy')`.

### 6.3 Barra inferior

- Ruta JSON del cursor (`$.a.b[3]`; claves no identificadoras como `$["a-b"]`), calculada sobre el árbol de sintaxis de `@codemirror/lang-json`. Clic = copiar.
- Tamaño, número de líneas, formato detectado (JSON, JSONP, NDJSON).

### 6.4 Atajos (configurables en opciones)

| Acción | Atajo por defecto |
|---|---|
| Buscar | `Ctrl+F` |
| Filtro JSONPath | `Ctrl+Shift+F` |
| Alternar Raw | `Alt+R` |
| Plegar todo / desplegar todo | `Alt+[` / `Alt+]` |
| Copiar ruta del cursor | `Ctrl+Shift+C` |

Se guardan como `"Ctrl+Shift+F"` y se comparan por tecla física (`KeyboardEvent.code`), así Shift, Alt y AltGr no cambian la tecla; AltGr llega como Ctrl+Alt y no coincide con un atajo `Alt+…`. Exigen Ctrl, Alt o Meta (o una tecla F). `""` desactiva la acción; si dos acciones comparten combinación gana la primera y opciones avisa.

### 6.5 Valores enriquecidos

Decoraciones de CodeMirror calculadas solo sobre el rango visible:

- **Color**: muestra junto a strings `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()/rgba()`, `hsl()/hsla()`.
- **Fechas**: tooltip con hora local y UTC para números epoch en segundos o milisegundos que caen entre 1990-01-01 y 2100-01-01, y para strings ISO 8601.
- **Imágenes**: tooltip con miniatura (carga diferida) para URLs que terminan en `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.avif`. Desactivable.
- **URLs clicables**: respetan `wrapLinkWithAnchorTag` y `openLinksInNewWindow`.
- **Tamaño de arrays**: texto `// N items` en el placeholder de plegado si `showArraySize`.

### 6.6 Detección y entrada

- Content types aceptados: `application/json`, `application/*+json`, `text/json`, `application/x-ndjson`, `application/jsonl`; además `text/plain` y `text/javascript` / `application/javascript` solo si el cuerpo parsea como JSON o JSONP.
- Lista de sitios excluidos (patrones de host con `*`).
- Menú contextual "Ver como JSON" para forzar el visor.
- Scratchpad: página de la extensión para pegar JSON; se abre desde el ícono.

### 6.7 Configuración (`sync:settings`)

| Original | Nuevo |
|---|---|
| `prependHeader` (true) | `showHeader` (true): URL y fecha en la barra |
| `maxJsonSize` (400 KB) | `lightModeThresholdMB` (20) |
| `alwaysFold` (false) | `foldFromLevel` (0 = no plegar; 2 = `alwaysFold`) |
| `alwaysRenderAllContent` | eliminado (CodeMirror 6 virtualiza) |
| `sortKeys` (false) | `sortKeys` |
| `clickableUrls` (true) | `clickableUrls` |
| `wrapLinkWithAnchorTag` (false) | `wrapLinkWithAnchorTag` |
| `openLinksInNewWindow` (true) | `openLinksInNewWindow` |
| `autoHighlight` (true) | `autoHighlight` (si es false, se muestra Raw con botón para formatear) |
| `lineNumbers`, `lineWrapping`, `foldGutter` (true) | igual |
| `tabSize` (2), `indentCStyle` (false), `showArraySize` (false) | igual |
| Custom Style | `customCss` (sección Avanzado, editor CSS con CodeMirror) |

Nuevos: `themeMode`, `lightThemeId`, `darkThemeId`, `font: { source: 'google' \| 'system', family, sizePx, lineHeight, ligatures, weight, subsets }`, `features: { jsonPath, colorSwatches, dateTooltips, imagePreview }`, `shortcuts`, `excludedHosts`, `locale` (`auto` \| `en` \| `es`).

`validateSettings` rellena con el valor por defecto cada campo ausente o con tipo inválido (no descarta la configuración completa).

### 6.8 Página de opciones

Navegación lateral: Apariencia (temas), Fuentes, Comportamiento, Estructura, Funciones, Sitios, Avanzado, Acerca de. Vista previa en vivo fija a la derecha usando `<JsonViewer>` con un JSON de ejemplo. Al pie: exportar / importar configuración (archivo JSON con settings + temas personalizados; las fuentes no se incluyen) y restablecer valores por defecto.

### 6.9 Idiomas

en y es con `@wxt-dev/i18n`; `locale: 'auto'` sigue el idioma del navegador.

## 7. Manejo de errores

| Situación | Comportamiento |
|---|---|
| JSON inválido | Visor en modo Raw con la línea del error resaltada y banner con mensaje, línea y columna. |
| Detección dudosa (`text/plain` que no parsea) | No se inyecta nada. |
| Inyección fallida (páginas restringidas, permisos) | Se registra en el background; la página queda intacta. Si vino del menú contextual, notificación con el motivo. |
| Descarga de fuente fallida (red, familia inexistente) | Mensaje en opciones; el visor usa la pila de respaldo. |
| Importación de tema fallida | Lista de errores concretos; no se guarda nada. |
| Configuración corrupta o de versión desconocida | Migraciones + `validateSettings` rellenan campos inválidos con defaults. |
| Fuente referenciada pero no descargada | Se usa la pila de respaldo; opciones muestra aviso. |

## 8. Riesgos

### 8.1 Visores JSON integrados de Edge y Chrome

Edge tiene un visor JSON propio y Chrome muestra una casilla "pretty print". Ambos alteran el DOM de la página JSON. La Fase 0 incluye un spike que documenta, para cada navegador: qué `contentType` reporta el documento, qué DOM genera el visor nativo y de dónde se obtiene el texto crudo (p. ej. `<pre>` oculto, `document.body.innerText`, o volver a pedir la URL con `fetch` como último recurso solo para GET). El resultado se registra en `docs/notes/native-viewers.md` y ajusta `detect`/`viewer` antes de la Fase 1.

### 8.2 Cuotas de `storage.sync`

8 KB por item y 100 KB en total. Settings (~2 KB) y temas personalizados (~1 KB c/u) caben; si `customThemes` superara 8 KB se divide en un item por tema (`sync:customTheme:<id>`). Las fuentes van siempre en `local:`.

## 9. Pruebas

- **Vitest** (`WxtVitest`, `fakeBrowser`): `detect` (tabla de content types y cuerpos), `parse` (JSONP, NDJSON, errores con posición, números grandes), `fromVSCode` (fixtures reales, JSONC, `include`, colores faltantes), derivación de colores, `validateSettings` y migraciones, `parseCss2` (respuesta grabada), detectores de colores/fechas/URLs de imagen, cálculo de ruta JSON.
- **Playwright** con la extensión compilada cargada en Chromium y un servidor local de fixtures: página JSON → visor; página HTML → sin visor; JSON inválido → banner; cambio de tema en opciones → reflejado en pestaña abierta; filtro JSONPath; copiar ruta; alternar Raw.
- **Manual en Edge**: verificación de §8.1 y de cada fase.

## 10. Fases

Cada fase termina con una extensión usable y pruebas en verde.

| Fase | Contenido |
|---|---|
| 0. Base + spike | Scaffold WXT + Vue + pnpm, git, scripts `test`, `test:e2e`, `build`. Ícono. Spike §8.1. |
| 1. Visor fiel | `detect`, `parse`, detector, background, visor con CodeMirror (plegado, líneas, URLs clicables), Raw, tema por defecto (Dark+). |
| 2. Opciones + temas | `settings`, página de opciones con vista previa, temas incluidos, importador VS Code, editor de temas, modo auto claro/oscuro. |
| 3. Fuentes | Catálogo, descarga, almacenamiento, `FontFace`, controles tipográficos. |
| 4. Navegación + acciones | Ruta del cursor, plegado por nivel, atajos, copiar/descargar, ordenar claves, filtro JSONPath. |
| 5. Valores enriquecidos | Colores, fechas, imágenes, modo ligero. |
| 6. Detección y entrada | JSONP, NDJSON, `+json`, sitios excluidos, menú contextual, scratchpad, exportar/importar, i18n en/es. |

## 11. Fuera de alcance (backlog)

- Instalar temas desde Open VSX por ID.
- Vista de árbol.
- Soporte Firefox.
- Diff entre dos JSON.
- Validación con JSON Schema.
- Publicación en tiendas.
