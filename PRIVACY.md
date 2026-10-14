# Privacy policy — JSON Viewer Extended

*Last updated: 2026-10-13.* [Versión en español más abajo.](#política-de-privacidad--json-viewer-extended)

JSON Viewer Extended does not collect, sell or share any personal data. It has no analytics, no tracking and no
servers of its own.

## What it reads

- **Pages you visit:** a small script checks whether the page is a JSON response (JSON, JSONP or NDJSON). Only then is
  the viewer added to that page; other pages are left alone and nothing is read from them. "View as JSON" and "View
  selection as JSON" (right-click menu) read the page or the selected text only when you choose them.
- Everything happens inside your browser. The text of the pages is never sent anywhere.

## What it stores

- Your settings, custom CSS, custom themes and downloaded fonts, in your browser's extension storage. Settings and
  custom themes use the browser's sync storage, so your browser may sync them to your other devices through your
  browser account (Microsoft or Google), as it does for other extensions. Nothing is stored on any other server.
- Text you send to the scratchpad is kept in session storage only until the scratchpad opens it.

## Network requests

The extension only connects to other sites in these cases, both started by you:

- **Google Fonts:** when you download a font in the options page, it is fetched from `fonts.googleapis.com` and
  `fonts.gstatic.com`. Google receives the usual request data (such as your IP address) under
  [Google's privacy policy](https://policies.google.com/privacy).
- **Image previews:** when you hover the URL of an image inside a JSON document, the image is loaded from that URL (with
  no referrer), as if you opened it. You can turn image previews off in Options › Features.

## Contact

Questions or issues: <https://github.com/marr-cloud/json-viewer/issues>.

---

# Política de privacidad — JSON Viewer Extended

*Última actualización: 2026-10-13.*

JSON Viewer Extended no recopila, vende ni comparte datos personales. No tiene analíticas, ni seguimiento, ni
servidores propios.

## Qué lee

- **Las páginas que visitas:** un pequeño script comprueba si la página es una respuesta JSON (JSON, JSONP o NDJSON).
  Solo entonces se añade el visor a esa página; las demás quedan intactas y no se lee nada de ellas. "Ver como JSON" y
  "Ver la selección como JSON" (menú contextual) leen la página o el texto seleccionado solo cuando los eliges.
- Todo ocurre dentro del navegador. El texto de las páginas nunca se envía a ningún sitio.

## Qué guarda

- Tus ajustes, el CSS propio, los temas personalizados y las fuentes descargadas, en el almacenamiento de extensiones
  del navegador. Los ajustes y los temas usan el almacenamiento sincronizado, así que el navegador puede sincronizarlos
  con tus otros dispositivos mediante tu cuenta (Microsoft o Google), como con cualquier extensión. No se guarda nada en
  ningún otro servidor.
- El texto que envías al bloc de JSON se guarda en el almacenamiento de sesión solo hasta que el bloc lo abre.

## Peticiones de red

La extensión solo se conecta a otros sitios en estos casos, y siempre por una acción tuya:

- **Google Fonts:** al descargar una fuente en las opciones, se pide a `fonts.googleapis.com` y `fonts.gstatic.com`.
  Google recibe los datos habituales de una petición (como tu dirección IP) según su
  [política de privacidad](https://policies.google.com/privacy).
- **Vista previa de imágenes:** al pasar el cursor sobre la URL de una imagen dentro de un JSON, la imagen se carga
  desde esa URL (sin referrer), como si la abrieras. Puedes desactivarla en Opciones › Funciones.

## Contacto

Dudas o problemas: <https://github.com/marr-cloud/json-viewer/issues>.
