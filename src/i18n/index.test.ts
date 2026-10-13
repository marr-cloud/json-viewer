// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { applyLocaleSetting, getLocale, messageParts, n, setLocale, t, tc } from '.';
import I18nText from './I18nText.vue';

let app: App | undefined;

afterEach(() => {
  app?.unmount();
  app = undefined;
  document.body.innerHTML = '';
  setLocale('en');
});

function mount(render: () => ReturnType<typeof h>): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  app = createApp({ render });
  app.mount(host);
  return host;
}

describe('the page language', () => {
  it('starts in English and translates in the language set', () => {
    expect(t('options.section.sites')).toBe('Sites');
    setLocale('es');
    expect(getLocale()).toBe('es');
    expect(t('options.section.sites')).toBe('Sitios');
    expect(tc('options.backup.themesSkipped', 2)).toBe('Se omitieron 2 temas del archivo.');
    expect(n(12345)).toBe('12.345');
  });

  it('applies the setting, following the browser on auto', () => {
    expect(applyLocaleSetting('auto', ['es-ES'])).toBe('es');
    expect(getLocale()).toBe('es');
    expect(applyLocaleSetting('en', ['es-ES'])).toBe('en');
    expect(getLocale()).toBe('en');
  });

  it('re-renders components when it changes', async () => {
    const host = mount(() => h('p', t('options.section.about')));
    expect(host.textContent).toBe('About');
    setLocale('es');
    await nextTick();
    expect(host.textContent).toBe('Acerca de');
  });
});

describe('messageParts', () => {
  it('splits a message at its placeholders', () => {
    expect(messageParts('Inspired by {link}.')).toEqual([{ text: 'Inspired by ' }, { slot: 'link' }, { text: '.' }]);
    expect(messageParts('{a}{b}')).toEqual([{ slot: 'a' }, { slot: 'b' }]);
    expect(messageParts('plain')).toEqual([{ text: 'plain' }]);
  });
});

describe('I18nText', () => {
  it('puts the slots in the placeholders, in the current language', async () => {
    const host = mount(() =>
      h(I18nText, { k: 'options.about.inspired' }, { link: () => h('a', { href: 'https://x.test' }, 'tulios') }),
    );
    expect(host.innerHTML).toBe('Inspired by <a href="https://x.test">tulios</a>.');
    setLocale('es');
    await nextTick();
    expect(host.innerHTML).toBe('Inspirado en <a href="https://x.test">tulios</a>.');
  });
});
