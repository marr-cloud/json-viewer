// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { setLocale } from '@/i18n';
import ThemeImport from './ThemeImport.vue';

const VSCODE_THEME = JSON.stringify({
  name: 'Test Night',
  type: 'dark',
  colors: { 'editor.background': '#101010', 'editor.foreground': '#eeeeee' },
});

let app: App | undefined;

beforeEach(() => fakeBrowser.reset());

afterEach(() => {
  app?.unmount();
  app = undefined;
  document.body.innerHTML = '';
  setLocale('en');
});

describe('ThemeImport', () => {
  it('says what it imported in the current language, and follows a change', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    app = createApp({ render: () => h(ThemeImport, { takenIds: [] }) });
    app.mount(host);
    const textarea = host.querySelector('textarea')!;
    textarea.value = VSCODE_THEME;
    textarea.dispatchEvent(new Event('input'));
    await nextTick();
    host.querySelector<HTMLButtonElement>('button')!.click();
    const status = () => host.querySelector('[role=status]')?.textContent?.trim();
    await vi.waitFor(() => expect(status()).toBe('Imported “Test Night” as a dark theme.'));
    setLocale('es');
    await nextTick();
    expect(status()).toBe('Se importó «Test Night» como tema oscuro.');
  });
});
