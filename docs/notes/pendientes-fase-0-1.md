# Pendientes tras las Fases 0–1

Hallazgos de las revisiones que se dejaron para fases siguientes (triage de la revisión final).

## Primera tarea del próximo plan
- **Desfase del offset de error con CRLF**: en JSON inválido con saltos `\r\n`, la marca del carácter
  y el scroll caen desplazados (offset del texto crudo vs. posiciones normalizadas de CodeMirror).
  Arreglo: derivar la posición de `line`/`column` (`doc.line(line).from + column - 1`).

## Fase 2 (opciones, temas)
- `CodeView` recrea todo el estado del editor al cambiar props: pasar a `Compartment`s; `view.focus()`
  en el watcher roba el foco al cambiar tema/opciones.
- Validar settings: acotar `tabSize` a 1..10 (el formateador manual no lo acota como `JSON.stringify`).
- Validar/sanear temas importados (`resolveColors` acepta claves y colores inválidos).
- Colores fijos del banner de error y de la línea/carácter de error → variables `--jv-*`.
- Tests para `autoHighlight=false` (empieza en Raw) y `showHeader=false`; cableado de `showArraySize`.

## Fase 4 (navegación)
- Clic en URL: limpiar el temporizador de 400 ms al destruir la vista; cancelar también ante selección por teclado.

## Fase 5 (rendimiento)
- La ruta con reviver (números largos) es ~10× más lenta; revisar junto al modo ligero.
- `text/plain` se parsea entero en el detector, sin límite de tamaño.
- La vista Raw de documentos enormes no está virtualizada.

## Fase 6 (detección)
- Tests de content type vacío/con espacios y variantes `x-json`.
- `URL_PATTERN` corta en `\` (URLs escapadas en modo error) e incluye puntuación final.

## Menores sin fase
- Pestañas sin el patrón WAI-ARIA completo; `<time>` puede partirse en pantallas estrechas.
- Spec §1 dice ~2 KB para el detector; el real es ~4,2 KB (casi todo runtime de WXT). Alinear criterio.
