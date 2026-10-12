# Visores JSON nativos (spike §8.1)

Fecha: 2026-10-11. Navegadores: Edge 155.0.4283.45, Chromium 153.0.8010.12 (Playwright).
Respuestas servidas localmente con `application/json`, `application/ld+json` y `text/plain`.

| Content type | `document.contentType` | Hijos de `<body>` |
|---|---|---|
| `application/json` | `application/json` | `<pre>` (texto crudo) + `<div class="json-formatter-container">` vacío |
| `application/ld+json` | `application/ld+json` | igual que arriba |
| `text/plain` | `text/plain` | `<pre style="word-wrap: break-word; white-space: pre-wrap;">` |

- El texto crudo está intacto en `pre.textContent` en todos los casos.
- No hay shadow DOM; el contenedor del visor nativo está vacío al cargar.

Regla implementada en `src/detect/readRawText.ts`: aceptar un `<body>` cuyos hijos sean exactamente
un `<pre>` y, opcionalmente, `div.json-formatter-container`; leer `pre.textContent`.

## Verificación manual Fase 1

2026-10-11 — Edge: el usuario confirmó que la extensión funciona (visor en páginas JSON, páginas normales intactas).
