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

## Menores diferidos de la revisión
- Mensajes que se guardan ya traducidos y no cambian si se cambia el idioma con el mensaje a la vista: importar tema
  (`ThemeImport.vue`), editor de temas (`ThemeEditor.vue`), errores de fuentes (`useFonts.ts`, `FontDownloadError`).
  Arreglo: guardar una función o la clave con sus parámetros, como `SettingsActions.vue`.
- La alerta "storage is full" sale también cuando se supera el límite de escrituras por minuto de `storage.sync`.
- La confirmación de importar no dice que también se reemplaza el CSS propio ni que los temas con el mismo id se
  sobrescriben.
- El contador de la búsqueda no agrupa cifras (`1000+`), a diferencia de la barra de estado (`1,000 matches`).
- El JSON de ejemplo de la vista previa de opciones nombra opciones en inglés.
- "Pasa el ratón" suena a España; para es-MX quedaría mejor "Pasa el cursor".
- El background re-etiqueta menú y tooltip con cualquier cambio de ajustes, no solo de idioma (3 llamadas, inocuo).
- Los e2e no fijan `locale` en el contexto de Playwright; funcionan porque las páginas usan `en-US` por defecto.
