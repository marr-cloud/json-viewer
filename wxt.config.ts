import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-vue', '@wxt-dev/auto-icons'],
  autoIcons: {
    baseIconPath: 'assets/icon.svg',
  },
  manifest: {
    name: 'JSON Viewer',
    description: 'Fast, themeable JSON viewer with VS Code themes and Google Fonts.',
    permissions: ['storage', 'scripting'],
  },
});
