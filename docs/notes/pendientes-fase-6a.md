# Pendientes tras la Fase 6a

## Limitaciones conocidas
- Chromium descarga `application/x-ndjson`, `application/jsonl` y similares en vez de mostrarlos: esas respuestas no
  llegan al visor (sí como `text/plain` o JSON). En Firefox está sin comprobar.
- "View as JSON" sobre una página HTML usa `document.body.innerText`; el visor tapa la página hasta recargar.
- Los patrones de sitios no admiten IPv6 literal (`[::1]`) ni distinguen puertos.
- El scratchpad no guarda el texto entre aperturas.

## Menores diferidos de la revisión
Resueltos en la rama de pulido (fix/deferred-minors): `hostMatches` sin backtracking, hosts IDN en punycode,
"View as JSON" en páginas sin `<body>` (XML, SVG), la insignia "!" (se limpia y distingue la selección), el
traspaso al scratchpad con id en la URL y NDJSON servido como JSON con un registro roto.

Siguen abiertos:
- "View as JSON" no avisa si el visor falla después de inyectarse (el error queda en la consola de la página).
- El visor forzado en páginas HTML vive en un shadow root abierto junto a los scripts de la página.
- Comprobar a mano "View as JSON" en una página HTML con CSP estricta (`style-src`).

La Fase 6b (exportar / importar e i18n) está hecha; sus pendientes, en `pendientes-fase-6b.md`.
