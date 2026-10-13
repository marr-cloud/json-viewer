# Pendientes tras la Fase 6a

## Limitaciones conocidas
- Chromium descarga `application/x-ndjson`, `application/jsonl` y similares en vez de mostrarlos: esas respuestas no
  llegan al visor (sí como `text/plain` o JSON). En Firefox está sin comprobar.
- "View as JSON" sobre una página HTML usa `document.body.innerText`; el visor tapa la página hasta recargar.
- Los patrones de sitios no admiten IPv6 literal (`[::1]`) ni distinguen puertos.
- El scratchpad no guarda el texto entre aperturas.

## Menores diferidos de la revisión
- `hostMatches` convierte cada `*` en `.*`: un patrón con muchos `*` (`*a*a*a*b`) contra un host largo puede tardar
  segundos en el service worker. Hace falta que el usuario escriba ese patrón; arreglo: comparador de comodines
  iterativo o limitar los `*`.
- "View as JSON" falla en silencio en documentos sin `<body>` (XML, SVG) o si el render falla después de inyectar.
- La insignia "!" no se borra tras un "View as JSON" que luego funciona, y un fallo de "View selection as JSON"
  (p. ej. cuota de `storage.session`) dice "can't open this page".
- Dos "View selection as JSON" seguidos pueden cruzar el texto entre pestañas; `openScratchpad('')` no borra un
  traspaso sin consumir. Arreglo: un id en la URL del scratchpad.
- NDJSON servido como JSON con un registro roto muestra el error de JSON (línea N, columna 1) en vez de "Line N".
- Los hosts IDN (`münchen.de`) se rechazan en vez de pasarse a punycode.
- El visor forzado en páginas HTML vive en un shadow root abierto junto a los scripts de la página.
- Comprobar a mano "View as JSON" en una página HTML con CSP estricta (`style-src`).

La Fase 6b (exportar / importar e i18n) está hecha; sus pendientes, en `pendientes-fase-6b.md`.
