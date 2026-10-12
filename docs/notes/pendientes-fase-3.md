# Pendientes tras la Fase 3

Hallazgos menores de las revisiones de la Fase 3 (por tarea y final) que se dejaron para después.

## Fuentes
- El tamaño que muestra la lista es el del woff2; en storage ocupa ~4/3 (base64). Con el límite de ~10 MB de
  `storage.local` caben pocas familias grandes y no se ve cuánto queda.
- `listFonts` lee todos los base64 solo para el resumen; guardar el resumen en el índice.
- Desmarcar todos los conjuntos de caracteres desactiva Download sin explicarlo y no se guarda (al recargar
  vuelven los de por defecto).
- El tope de 2 MB se comprueba después de bajar cada archivo entero (sin mirar `Content-Length`).
- `useFonts.download` no se protege solo contra descargas dobles (lo hace el botón deshabilitado); si cambias la
  familia mientras descarga, al terminar se sobrescribe; "Downloading…" no se anuncia; un error viejo sigue visible
  al cambiar de familia u origen.
- Sin tests de los estados deshabilitados (familia inválida, sin subsets) ni del mensaje de error de storage.
- `listFonts` no comprueba que la familia guardada coincida con la clave; índice con read-modify-write.
- El tracker de fuentes del visor arranca antes de `createShadowRootUi` y `fail()` no lo detiene (igual que los
  demás watchers).

## Settings
- Sin test de guardar sobre un valor almacenado corrupto (no objeto); `mergeUnknown` usa `in` (claves heredadas
  como `toString` no se conservarían; `Object.hasOwn` sería más preciso); `saveSettings` lee y escribe sin
  atomicidad.
- Para sobrescribir `--jv-font-*` desde el CSS propio hace falta `!important` (las variables van en línea).

## Varios
- Orden de imports en `App.vue`; línea larga en la ayuda de Avanzado.
