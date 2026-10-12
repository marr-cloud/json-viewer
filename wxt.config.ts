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
    build: { rolldownOptions: { output: { minify: { codegen: { asciiOnly: true } } } } },
  }),
  manifest: {
    name: 'JSON Viewer',
    description: 'Fast, themeable JSON viewer with VS Code themes and Google Fonts.',
    permissions: ['storage', 'scripting'],
  },
});
