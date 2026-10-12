import type { Plugin } from 'vite';
import { defineConfig } from 'wxt';

// Chrome refuses to inject scripts containing non-characters (U+FFFF in CodeMirror),
// so escape every non-ASCII character in the emitted JS.
function asciiOnly(): Plugin {
  return {
    name: 'ascii-only-output',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue;
        file.code = file.code.replace(
          /[^\x00-\x7f]/g,
          (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`,
        );
      }
    },
  };
}

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-vue', '@wxt-dev/auto-icons'],
  autoIcons: {
    baseIconPath: 'assets/icon.svg',
  },
  vite: () => ({ plugins: [asciiOnly()] }),
  manifest: {
    name: 'JSON Viewer',
    description: 'Fast, themeable JSON viewer with VS Code themes and Google Fonts.',
    permissions: ['storage', 'scripting'],
  },
});
