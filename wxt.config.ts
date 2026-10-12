import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-vue', '@wxt-dev/auto-icons'],
  autoIcons: {
    baseIconPath: 'assets/icon.svg',
  },
  // Chrome refuses to inject scripts containing non-characters (U+FFFF in CodeMirror),
  // so the minifier must emit ASCII-only output.
  vite: () => ({
    build: {
      rolldownOptions: { output: { minify: { codegen: { asciiOnly: true } } } },
      // The viewer and options bundles carry all of CodeMirror (~550 kB). An extension loads them from
      // disk, so the web-oriented 500 kB warning doesn't apply; warn only if they grow well past that.
      chunkSizeWarningLimit: 800,
    },
  }),
  manifest: {
    name: 'JSON Viewer',
    description: 'Fast, themeable JSON viewer with VS Code themes and Google Fonts.',
    permissions: ['storage', 'scripting'],
    // No popup: clicking the icon opens the scratchpad (background.ts).
    action: { default_title: 'Open the JSON scratchpad' },
    homepage_url: 'https://github.com/marr-cloud/json-viewer',
  },
});
