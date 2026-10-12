# JSON Viewer

Visor de JSON para Edge y Chrome hecho con [WXT](https://wxt.dev), Vue 3 y CodeMirror 6.
Inspirado en [tulios/json-viewer](https://github.com/tulios/json-viewer).

## Desarrollo

```bash
pnpm install
pnpm dev:edge      # abre Edge con la extensión (requiere web-ext.config.ts local)
pnpm test          # unit tests (Vitest)
pnpm test:e2e      # build + e2e (Playwright, Chromium)
pnpm build         # .output/chrome-mv3
```

## Cargar en Edge / Chrome

1. `pnpm build`
2. Abrir `edge://extensions` (o `chrome://extensions`) y activar **Modo de desarrollador**.
3. **Cargar desempaquetada** → seleccionar `.output/chrome-mv3`.
4. Desactivar otras extensiones de JSON (p. ej. tulios/json-viewer) para evitar conflictos.

## Documentación

- Diseño: `docs/superpowers/specs/2026-10-11-json-viewer-design.md`
- Visores nativos: `docs/notes/native-viewers.md`
