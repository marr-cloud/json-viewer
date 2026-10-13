// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { setLocale } from '@/i18n';
import type { Theme } from '@/themes/types';
import ThemeEditor from './ThemeEditor.vue';

const theme: Theme = {
  id: 'mine',
  name: 'Mine',
  type: 'dark',
  source: 'custom',
  colors: { background: '#101010', foreground: '#eeeeee' },
};

let app: App | undefined;

function mount(): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  app = createApp({ render: () => h(ThemeEditor, { initial: theme, isNew: false, takenIds: [] }) });
  app.mount(host);
  return host;
}

afterEach(() => {
  app?.unmount();
  app = undefined;
  document.body.innerHTML = '';
  setLocale('en');
});

const alerts = (host: HTMLElement) => [...host.querySelectorAll('[role=alert]')].map((element) => element.textContent?.trim());

describe('ThemeEditor', () => {
  it('words its errors in the current language, and follows a change', async () => {
    const host = mount();
    const hex = host.querySelector<HTMLInputElement>('input[aria-label="key hex"]')!;
    hex.value = 'red';
    hex.dispatchEvent(new Event('change'));
    const json = host.querySelector<HTMLTextAreaElement>('textarea')!;
    json.value = '{oops';
    json.dispatchEvent(new Event('input'));
    await nextTick();
    expect(alerts(host)).toEqual([
      expect.stringMatching(/^Invalid JSON: /),
      'Invalid color for key: use #rgb, #rgba, #rrggbb or #rrggbbaa',
    ]);
    setLocale('es');
    await nextTick();
    expect(alerts(host)).toEqual([
      expect.stringMatching(/^JSON no válido: /),
      'Color no válido para key: usa #rgb, #rgba, #rrggbb o #rrggbbaa',
    ]);
  });
});
