# JSON Viewer

Visor de JSON para Edge y Chrome hecho con [WXT](https://wxt.dev), Vue 3 y CodeMirror 6.
Repositorio: [marr-cloud/json-viewer](https://github.com/marr-cloud/json-viewer). Inspirado en [tulios/json-viewer](https://github.com/tulios/json-viewer).

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

## Configuración

Abre las opciones desde el botón ⚙ del visor o con clic derecho en el ícono › Opciones. Los cambios se guardan
solos y se aplican en vivo a las pestañas abiertas.

- **Apariencia:** modo claro/oscuro (sigue al sistema o fijo), un tema para cada modo, importar temas de VS Code
  (pega el JSON del tema o elige el archivo) y un editor para duplicar y retocar cualquier tema.
- **Fuentes:** una fuente instalada en el equipo o cualquier familia de Google Fonts (con sugerencias de fuentes
  monoespaciadas). Las de Google se descargan una vez desde las opciones y luego funcionan sin conexión, incluso en
  páginas con CSP estricta. Tamaño, interlineado, grosor y ligaduras.
- **Comportamiento** y **Estructura:** las mismas opciones del json-viewer original, con interruptores, y plegado al abrir (como `alwaysFold`).
- **Atajos:** cada acción del visor tiene un atajo que se cambia pulsando la nueva combinación (Retroceso lo quita).
  En Mac, Cmd hace de Ctrl.
- **Funciones:** activar o desactivar el filtro JSONPath, las muestras de color y las vistas previas de fechas e
  imágenes, y el umbral del modo ligero.
- **Avanzado:** CSS propio para el visor.

## En el visor

- **Barra inferior:** ruta JSON del cursor (`$.items[3]["e-mail"]`; clic = copiar), tamaño, líneas y formato.
- **Barra superior:** filtro JSONPath (Enter aplica, Esc vuelve al documento; admite filtros como
  `$..items[?(@.price > 10)]`), plegar todo / desplegar todo / plegar por nivel, copiar formateado o minificado,
  descargar `.json` y ordenar claves (solo en esa pestaña).
- **Búsqueda (`Ctrl+F`):** panel compacto al estilo VS Code con mayúsculas (`Aa`), palabra completa (`ab`) y
  expresión regular (`.*`), contador "2 of 12" (hasta 1000; sin contador en documentos de más de ~4 MB), Enter /
  Shift+Enter para siguiente / anterior, Alt+Enter para seleccionar todas y Esc para cerrar.
- **Valores enriquecidos:** muestra de color junto a `#ff5500`, `rgb(…)` o `hsl(…)`; al pasar el ratón por una fecha
  Unix (segundos o milisegundos) o ISO 8601, su hora local y UTC; al pasarlo por la URL de una imagen, una miniatura.
  Por encima del umbral de **modo ligero** (20 MB por defecto) se desactivan y la barra inferior lo indica.
- **Atajos por defecto:** buscar `Ctrl+F`, filtro `Ctrl+Shift+F`, Raw `Alt+R`, plegar / desplegar todo `Alt+[` /
  `Alt+]`, copiar ruta `Ctrl+Shift+C`. Se reconocen por la posición física de la tecla.

## Temas incluidos

Se generan desde [tm-themes](https://github.com/shikijs/textmate-grammars-themes):

```bash
pnpm themes:build   # regenera src/themes/builtin/generated.json y LICENSES.md
```

## Documentación

- Diseño: `docs/superpowers/specs/2026-10-11-json-viewer-design.md`
- Visores nativos: `docs/notes/native-viewers.md`
