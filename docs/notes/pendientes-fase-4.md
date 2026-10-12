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
