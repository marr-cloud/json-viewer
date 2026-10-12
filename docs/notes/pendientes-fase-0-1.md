# Pendientes tras las Fases 0–1

Hallazgos de las revisiones que se dejaron para fases siguientes (triage de la revisión final).

## Fase 2 (opciones, temas)
- Test de `showArraySize` desde la página de opciones.

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
