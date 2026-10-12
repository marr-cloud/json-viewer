# Pendientes tras la Fase 2

Hallazgos menores de las revisiones de la Fase 2 (por tarea y final) que se dejaron para después.

## Decidir antes de la Fase 3
- **Claves desconocidas en settings**: `validateSettings` descarta las claves que no conoce y la página de
  opciones reescribe el objeto entero. Cuando la Fase 3 añada campos, un dispositivo con una versión vieja
  los borrará del item sincronizado. Opciones: fusionar sobre el valor crudo guardado o conservar las claves
  desconocidas.
- `validateSettings` trata `tabSize` aparte y asume que el resto de `viewer` son booleanos: pasar a
  validadores por campo cuando lleguen campos no booleanos.

## Sincronización y almacenamiento
- La página de opciones no observa storage: una segunda pestaña o un cambio sincronizado se pisa en la
  siguiente edición.
- El debounce de guardado no se vacía al cerrar la pestaña (se pierden ediciones de los últimos 300 ms); las
  escrituras fallidas no se reintentan y su error no se muestra.
- `customThemeIds` se actualiza con read-modify-write: dos importaciones en dispositivos distintos pueden
  dejar un tema huérfano (invisible y ocupando cuota). Arreglo barato: unir el índice con las claves
  `customTheme:*` de `storage.sync.get(null)`.
- `listCustomThemes` no comprueba que el id guardado coincida con la clave ni deduplica; un id propio que
  choque con uno incluido queda oculto sin aviso.
- Errores de cuota de sync se muestran en crudo; `deleteCustomTheme` no avisa si falla y reescribe el índice
  aunque no haya cambios.
- En el visor, los watchers arrancan antes de `createShadowRootUi` y `fail()` no los detiene; las recargas de
  temas propios pueden aplicarse fuera de orden.

## Temas
- Importar de VS Code: si el foreground ganador de un token es inválido no se prueba la siguiente regla; los
  errores de parseo no tienen tope; no se quita el BOM del JSON pegado; los scopes con comas dentro de un
  array no se separan; un objeto `colors` con solo claves que no son colores importa un tema por defecto.
- El validador acepta `source: "builtin"` de entrada no confiable (al guardar se reescribe a custom) y
  recorta el nombre a 80 caracteres sin avisar.
- `build-themes` no falla si un tema no tiene sección de licencia.
- Editor: el selector de color descarta el alfa; tras guardar se ven un instante los colores viejos; el texto
  pegado en el importador se pierde al abrir el editor; descartar cambios (Cancel o cambiar de tema) no pide
  confirmación.
- El archivo exportado conserva `source` y va indentado; el importador (que espera formato VS Code) no lo
  reimporta. "Edit" de un tema propio lo asigna al hueco de su tipo al guardar, aunque estuviera en el otro.

## Página de opciones
- La vista previa muestra los valores por defecto un instante antes de cargar los guardados.
- En pantalla ancha la barra lateral queda limitada a 100vh sin scroll propio.
- Claves `:key` repetidas si dos avisos del importador son idénticos.

## Tests
- Sin tests de componente de `ThemeEditor`; el localizador `key hex` es por subcadena.
- Quedan dos `waitForTimeout(500)` en `e2e/viewer.spec.ts`; pasarlos a `expect.poll`.
- Sin test de que `OPEN_OPTIONS` llegue al background; sin test de `revealError` al cambiar el error;
  sin test de columna ≤ 0 en `errorPosition`.
- Faltan casos en validadores (id largo/no string, color no string, viewer no objeto).

## Varios
- Los iconos del toolbar son glifos Unicode (dependen de la fuente).
- `errorLine.ts` repite la expresión de acotado de línea; la marca del carácter al final de una línea que no
  es la última cubre el salto de línea.
