# Pendientes tras la Fase 6a

## Limitaciones conocidas
- Chromium descarga `application/x-ndjson`, `application/jsonl` y similares en vez de mostrarlos: esas respuestas no
  llegan al visor (sí como `text/plain` o JSON). En Firefox está sin comprobar.
- "View as JSON" sobre una página HTML usa `document.body.innerText`; el visor tapa la página hasta recargar.
- Los patrones de sitios no admiten IPv6 literal (`[::1]`) ni distinguen puertos.
- El scratchpad no guarda el texto entre aperturas.

## Para la Fase 6b
- Exportar / importar configuración y restablecer (§6.8).
- i18n en/es (§6.9): incluye los textos nuevos de esta fase (menú contextual, Sites, scratchpad).
