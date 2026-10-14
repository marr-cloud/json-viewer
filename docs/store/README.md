# Publicar JSON Viewer Extended

Guía para subir la versión 1.0.0 a **Edge Add-ons** (Microsoft Partner Center) y a la **Chrome Web Store**. Los textos
de la ficha van en bloques listos para copiar, en inglés y en español.

## 1. Preparar el paquete

```bash
pnpm install
pnpm test && pnpm test:e2e      # todo en verde
pnpm zip                        # .output/json-viewer-1.0.0-chrome.zip  → Chrome
pnpm exec wxt zip -b edge       # .output/json-viewer-1.0.0-edge.zip    → Edge
pnpm store:assets               # regenera docs/store/assets/ (usa el build de .output/chrome-mv3)
```

Comprueba el zip antes de subirlo: cárgalo descomprimido en `edge://extensions` (modo desarrollador) y abre una página
JSON, las opciones y el bloc.

## 2. Imágenes (`docs/store/assets/`)

| Archivo | Uso |
|---|---|
| `1-viewer-dark.png` … `6-options-es.png` | Capturas 1280×800 (Chrome admite hasta 5; Edge hasta 10). En Chrome: 1, 2, 3, 4 y 5. |
| `logo-300.png` | Logo de Edge (300×300). |
| `promo-440x280.png` | Mosaico promocional pequeño de Chrome (440×280, opcional). |
| `.output/chrome-mv3/icons/128.png` | Ícono de la tienda de Chrome (128×128). |

## 3. Datos de la ficha

- **Nombre:** JSON Viewer Extended
- **Categoría:** Developer Tools / Herramientas para desarrolladores
- **Idiomas de la ficha:** English (predeterminado) y Español
- **Sitio web:** <https://github.com/marr-cloud/json-viewer>
- **Soporte:** <https://github.com/marr-cloud/json-viewer/issues>
- **Política de privacidad:** <https://github.com/marr-cloud/json-viewer/blob/main/PRIVACY.md>

### Descripción corta (máx. 132 caracteres)

```text
Readable JSON in your browser: VS Code themes, Google Fonts, JSONPath filter, search, JSONP and NDJSON, in English and Spanish.
```

```text
JSON legible en el navegador: temas de VS Code, Google Fonts, filtro JSONPath, búsqueda, JSONP y NDJSON, en español e inglés.
```

### Descripción (inglés)

```text
JSON Viewer Extended turns JSON responses into a fast, readable, themeable view, right where they open.

VIEWER
• Syntax highlighting, line numbers, folding (all, none or by level) and item counts on folded blocks
• Search inside the document (Ctrl+F) with match case, whole word and regular expressions
• JSONPath filter: $.data[?(@.paid == true)]
• Copy formatted or minified, download, sort keys, Raw view
• The path of the cursor in the status bar ($.items[3].name), copied with one click
• Clickable URLs, including paths like "/api/users" resolved against the page
• Color swatches, date tooltips (Unix time and ISO 8601) and image previews on hover
• Handles big documents: a light mode keeps files of tens of MB fast
• Also JSONP and NDJSON / JSON Lines

THEMES AND FONTS
• 17 built-in themes from VS Code (One Dark Pro, Dracula, GitHub, Tokyo Night, Nord, Night Sky…), light and dark, following the system
• Import any VS Code color theme, or duplicate one and edit its colors
• Any installed font or any Google Font, downloaded once and used offline; size, line height, weight and ligatures

MORE
• Scratchpad: click the toolbar icon to paste JSON and view it
• Right-click "View as JSON" on any page, or "View selection as JSON"
• Sites where the viewer should not open
• Configurable keyboard shortcuts and custom CSS
• Export and import your settings
• English and Spanish

PRIVACY
No analytics, no tracking, no servers. Pages are processed inside your browser and never sent anywhere.

Open source: https://github.com/marr-cloud/json-viewer
Inspired by tulios/json-viewer.
```

### Descripción (español)

```text
JSON Viewer Extended convierte las respuestas JSON en una vista rápida, legible y personalizable, en la misma pestaña.

VISOR
• Resaltado de sintaxis, números de línea, plegado (todo, nada o por nivel) y número de elementos en los bloques plegados
• Búsqueda en el documento (Ctrl+F) con mayúsculas, palabra completa y expresiones regulares
• Filtro JSONPath: $.data[?(@.paid == true)]
• Copiar formateado o minificado, descargar, ordenar claves y vista de texto
• La ruta del cursor en la barra de estado ($.items[3].name), que se copia con un clic
• URLs clicables, incluidas rutas como "/api/users" resueltas contra la página
• Muestras de color, fechas (tiempo Unix e ISO 8601) e imágenes al pasar el cursor
• Documentos grandes: el modo ligero mantiene rápidos archivos de decenas de MB
• También JSONP y NDJSON / JSON Lines

TEMAS Y FUENTES
• 17 temas incluidos de VS Code (One Dark Pro, Dracula, GitHub, Tokyo Night, Nord, Night Sky…), claros y oscuros, según el sistema
• Importa cualquier tema de color de VS Code, o duplica uno y edita sus colores
• Cualquier fuente instalada o de Google Fonts, descargada una vez y usada sin conexión; tamaño, interlineado, grosor y ligaduras

ADEMÁS
• Bloc de JSON: haz clic en el ícono para pegar JSON y verlo
• Clic derecho «Ver como JSON» en cualquier página, o «Ver la selección como JSON»
• Sitios donde no abrir el visor
• Atajos de teclado configurables y CSS propio
• Exportar e importar la configuración
• Español e inglés

PRIVACIDAD
Sin analíticas, sin seguimiento y sin servidores. Las páginas se procesan dentro del navegador y nunca se envían a ningún sitio.

Código abierto: https://github.com/marr-cloud/json-viewer
Inspirado en tulios/json-viewer.
```

## 4. Prácticas de privacidad (formularios de las tiendas)

**Propósito único (single purpose):**

```text
Display JSON responses (JSON, JSONP, NDJSON) in a readable, searchable, themeable viewer.
```

**Justificación de permisos:**

| Permiso | Texto para el formulario |
|---|---|
| `storage` | `Saves the user's settings, custom themes, custom CSS and downloaded fonts.` |
| `scripting` | `Injects the viewer into a tab only when its page is a JSON response, or when the user chooses "View as JSON" in the context menu.` |
| `contextMenus` | `Adds "View as JSON" and "View selection as JSON" to the right-click menu.` |
| Host `<all_urls>` | `JSON responses can come from any site; a small script checks whether the page is JSON and, only then, the viewer is shown. Font downloads from Google Fonts also need host access.` |

- **Código remoto:** No (todo el código va en el paquete).
- **Datos recopilados:** ninguno. Marca que la extensión **no** recopila datos de ningún tipo, y las tres certificaciones
  (no se venden datos, no se usan para fines ajenos al propósito único, no se usan para crédito).

## 5. Envío

### Edge Add-ons (gratis)

1. Entra en <https://partner.microsoft.com/dashboard/microsoftedge/overview> con tu cuenta Microsoft y regístrate como
   desarrollador (cuenta individual).
2. **Create new extension** › sube `json-viewer-1.0.0-edge.zip`.
3. **Availability:** público, todos los mercados.
4. **Properties:** categoría *Developer tools*, URL de la política de privacidad, sitio web y soporte (sección 3).
5. **Store listings:** añade *English* y *Spanish*; en cada una, la descripción, la descripción corta, el logo de
   300×300 y las capturas.
6. **Submit** y escribe en las notas para certificación que es un visor de JSON sin servidores. La revisión suele tardar
   unos días.

### Chrome Web Store (pago único de 5 USD)

1. Entra en <https://chrome.google.com/webstore/devconsole>, acepta el acuerdo y paga el registro.
2. **New item** › sube `json-viewer-1.0.0-chrome.zip`.
3. **Store listing:** descripción en inglés (y añade la traducción al español), categoría, idioma, ícono de 128×128,
   capturas y mosaico de 440×280.
4. **Privacy:** propósito único, justificación de permisos y uso de datos (sección 4), URL de la política de
   privacidad.
5. **Distribution:** pública, todas las regiones. **Submit for review**.

> La justificación de `<all_urls>` suele alargar la revisión; los textos de la sección 4 explican por qué hace falta.

## 6. Después

- Cada versión nueva: sube `version` en `package.json`, `pnpm zip` y sube el zip en las dos tiendas.
- Cuando la ficha esté publicada, añade los enlaces de las tiendas al README.
