# Pendientes tras la Fase 5

## Limitaciones conocidas
- Un número entero entre 1990 y 2100 en segundos o milisegundos (p. ej. un id) también muestra tooltip de fecha;
  solo aparece al pasar el ratón.
- Las imágenes se piden desde el content script, sin referrer: una URL rota, la red, el contenido mixto (http en una
  página https) o la falta de cookies pueden impedir la miniatura; el tooltip lo indica. La CSP de la página no las
  bloquea en Chromium (comprobado en e2e); en Firefox está sin comprobar.
- Los colores con transparencia se muestran sobre el fondo del editor, sin damero.

## Menores diferidos de la revisión
- Mac: un atajo guardado como `Meta+…` antes de esta fase ya no coincide nunca (Cmd ahora cuenta como Ctrl) y
  opciones lo sigue mostrando como "Meta+…"; hay que volver a grabarlo o restablecer. Posible arreglo: normalizar
  `Meta`→`Ctrl` al leer en Mac.
- Mac: comprobar a mano si Cmd+Shift+C (copiar ruta) llega a la página o se lo queda el selector de DevTools.
- `richValues` devuelve el objeto compartido `NO_RICH_VALUES` en modo ligero (el test fija esa identidad); nadie debe
  mutarlo.
- `COLOR_STRING` es una regex global exportada (estado en `lastIndex`); copiarla antes de usarla fuera de
  `MatchDecorator`.
- Fechas extremas: años 0000–0099 (`Date.UTC` los lleva a 19xx) y desbordes más allá de 9999 en `formatClock`; las
  fracciones de más de 3 dígitos dependen de `Date.parse` del motor.
- `JsonViewer` registra el listener de `documentShortcuts` solo al montar; cambiar la prop después no tiene efecto.
- `ViewerStatusBar` no tiene test propio (se cubre a través de `JsonViewer`).

## De fases anteriores, sin resolver
- La ruta con reviver (números largos) es ~10× más lenta; hoy solo se usa si hay números de más de 15 dígitos.
- `text/plain` se parsea entero en el detector, sin límite de tamaño (el detector no puede crecer).
- La vista Raw de documentos enormes no está virtualizada.
