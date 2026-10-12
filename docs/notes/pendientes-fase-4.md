# Pendientes tras la Fase 4

## Limitaciones conocidas
- jsonpath-plus no resuelve claves entre corchetes que contengan `'`, `]`, `\`, `~`, `*`, `@`, `^`, `..` o `$` sola
  (`$["a'b"]` no encuentra nada): la ruta copiada del cursor no sirve como filtro para esas claves.
- Con números grandes (`JSON.rawJSON`), `$..*` devuelve además el texto del número como string.
- El formato mostrado es siempre "JSON" hasta que la Fase 6 añada JSONP y NDJSON.
- `Ctrl+Shift+C` es también "inspeccionar elemento" de las DevTools; si el navegador se lo queda, cambiar el atajo.
- En documentos muy grandes (~4 MB), "Plegar todo" y el plegado al abrir pliegan primero la parte ya parseada y
  terminan el resto un momento después (el parser sigue en porciones de 50 ms); un bloque que el usuario despliegue
  mientras tanto se queda desplegado.

## Rendimiento (documentos de ~4 MB)
- Replegar al mismo nivel despliega y vuelve a plegar todo.
- Cambiar el nivel en vivo, o alternar el orden, descarta los pliegues manuales.
- El recorrido de índices de array de `jsonPathAt` es O(n) por movimiento del cursor (bien con 50k elementos; podría
  ir lento con arrays de más de 100k).

## Visor (UX)
- Los títulos de los botones de la barra no muestran el atajo configurado (p. ej. "Fold all (Alt+[)").
- "Sort keys" sigue habilitado en Raw y con JSON inválido (el cambio no hace nada visible).
- Esc puede ser consumido antes por `simplifySelection` de CodeMirror; Enter durante una composición IME aplica el
  filtro antes de tiempo.
- El atajo del filtro se traga la tecla cuando el campo está deshabilitado (JSON inválido).
- En Mac, los caracteres de la capa Option se pierden en el filtro por los atajos Alt por defecto.
- Se permite grabar `Ctrl+Alt+<tecla>`, que puede robar caracteres AltGr en teclado español; la página de opciones
  podría avisar.

## Opciones y accesibilidad
- Shift+Tab queda capturado mientras se graba un atajo (se sale con Esc/Tab/clic).
- La alerta "Use Ctrl, Alt…" persiste tras Tab/blur y oculta el mensaje de conflicto.
- El `aria-label` del botón de grabación oculta la combinación actual a los lectores de pantalla (arreglo barato:
  incluir `model || 'None'` en la etiqueta).

## Robustez y casos borde
- `copyText` llama a `focus()`/`select()` fuera del try (la garantía de "nunca lanza" no es estructural).
- `formatBytes(1048575)` devuelve "1024.0 KB".
- `downloadName` puede producir "xxx..json" o partir un par sustituto; un escape porcentual inválido descarta todo el
  segmento.
- `$` sobre documentos raíz falsy (null, 0, false, "") devuelve 0 coincidencias.
- Comparar un número grande `JSON.rawJSON` en un filtro da un error poco claro ("Cannot convert object to primitive
  value").
- La búsqueda en `PUNCTUATION_KEYS` no usa `Object.hasOwn`; el conjunto de teclas reconocidas está definido dos veces
  (tablas de `keyFromCode` y `KNOWN_KEYS`).
- El temporizador del aviso (flash) puede seguir armado tras desmontar.
- La continuación del plegado no comprueba que la vista siga viva (depende de la cancelación de CodeView).
- La ruta del cursor puede leer un prefijo más corto en documentos grandes hasta que el parseo en segundo plano
  alcance el cursor.

## Tests pendientes
- cursorPath: `onChange` tras el parseo en segundo plano; sonda de línea en blanco; rutas concretas en documentos
  inválidos.
- foldLevel: documento con errores de sintaxis; replegado al mismo nivel.
- urls: `detail > 1`, caminos de etiqueta anchor y de `location.href`.
- clipboard/download: los overrides de `defineProperty` se filtran entre tests; falta un test con contenedor
  ShadowRoot; no se comprueba el contenido del blob.
- jsonPath: el test del sandbox solo comprueba `ok === false`.
- shortcuts: `actionFor(shortcuts, '')`, formas hostiles en `validateShortcuts`, orden de Meta.
- JsonViewer: autolimpieza del flash, "Copy failed", `copy(null)`; orden desactivado; copiar/descargar desde Raw;
  ramas de Esc y botón de limpiar; foco tras Raw→Code.
- ShortcutField: blur, Delete, guarda de keyup, Shift+Tab.
- Varias tareas no registraron ejecución RED (7, 11, 12).

## Estilo
- Una línea de más de 100 caracteres en `src/editor/urls.test.ts`; una línea larga en el bullet "Comportamiento" del
  README.
- `e2e/themes.spec.ts` localiza el mensaje de éxito por clase (`p.opt-success`) en vez de por rol + texto.
