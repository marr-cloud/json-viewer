export const SAMPLE_URL = 'https://github.com/marr-cloud/json-viewer';

// Shows every token kind plus what the options affect: clickable URLs, color swatches, dates
// and an image URL to hover, long lines to wrap, nesting to fold, empty containers, escapes, non-ASCII text, ligature-prone operators and
// a number too big for a double. Minified like a real API response; the viewer formats it.
export const SAMPLE_JSON = [
  '{"title":"JSON Viewer"',
  '"repository":"https://github.com/marr-cloud/json-viewer"',
  '"description":"Fast, themeable JSON viewer with VS Code themes and Google Fonts."',
  '"version":"0.1.0","stable":true,"deprecated":false,"license":null',
  '"stars":128,"rating":4.9,"offset":-0.035,"bigId":12345678901234567890',
  '"releasedAt":"2026-10-12T09:30:00Z","createdAt":1728691200,"accent":"#4493f8"',
  '"logo":"https://api.iconify.design/vscode-icons:file-type-json.svg"',
  '"tags":["json","viewer","themes","fonts"]',
  '"maintainers":[{"name":"marr-cloud","profile":"https://github.com/marr-cloud","roles":["author","maintainer"]}]',
  '"features":{"themes":{"builtIn":16,"importFromVSCode":true},"fonts":{"googleFonts":true,"worksOffline":true,"ligatures":"a => b, x != y, i >= 0"},"emptyList":[],"emptyObject":{}}',
  '"escapes":"line 1\\nline 2\\t\\"quoted\\" \\\\ backslash"',
  '"unicode":"Olá, mundo · ¡Hola! · こんにちは"',
  '"longText":"Long lines wrap when \\"Wrap long lines\\" is on and scroll sideways when it is off; try it in the Structure section."}',
].join(',');
