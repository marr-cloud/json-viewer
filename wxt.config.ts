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
    // Manifest texts come from public/_locales and follow the browser's language; the UI follows the
    // Language setting instead (src/i18n), and the background relabels the toolbar tooltip at startup.
    default_locale: 'en',
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    permissions: ['storage', 'scripting', 'contextMenus'],
    // No popup: clicking the icon opens the scratchpad (background.ts).
    action: { default_title: '__MSG_actionTitle__' },
    homepage_url: 'https://github.com/marr-cloud/json-viewer',
  },
});
