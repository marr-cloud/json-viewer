// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, type App } from 'vue';
import { defaultLightTheme, defaultTheme } from '@/themes/builtin';
import type { Theme } from '@/themes/types';
import { defaultFontSettings, type FontSettings } from '@/settings/font';
import { defaultViewerOptions } from '@/viewer/options';
import JsonViewer from './JsonViewer.vue';

let app: App | undefined;

function mount(props: { font?: FontSettings; theme?: Theme; customCss?: string; onToggleTheme?: () => void; onOpenSettings?: () => void }) {
  const host = document.createElement('div');
  document.body.append(host);
  app = createApp({
    render: () => h(JsonViewer, { raw: '{"a":1}', options: defaultViewerOptions, theme: defaultTheme, ...props }),
  });
  app.mount(host);
  return host;
}

afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
});

describe('JsonViewer', () => {
  it('applies the font settings as CSS variables on the root', () => {
    const host = mount({ font: { ...defaultFontSettings, family: 'Fira Code', sizePx: 17 } });
    const root = host.querySelector<HTMLElement>('.jv-root')!;
    expect(root.style.getPropertyValue('--jv-font-family')).toMatch(/^"Fira Code", /);
    expect(root.style.getPropertyValue('--jv-font-size')).toBe('17px');
  });

  it('emits toggleTheme and openSettings from the toolbar', () => {
    const onToggleTheme = vi.fn();
    const onOpenSettings = vi.fn();
    const host = mount({ onToggleTheme, onOpenSettings });
    host.querySelector<HTMLButtonElement>('[aria-label="Toggle light/dark theme"]')!.click();
    host.querySelector<HTMLButtonElement>('[aria-label="Open settings"]')!.click();
    expect(onToggleTheme).toHaveBeenCalledOnce();
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it('injects custom CSS as text, never as markup', () => {
    const host = mount({ customCss: '.cm-content { color: red; } </style><img src=x onerror="alert(1)">' });
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('.jv-root > style')?.textContent).toContain('</style><img');
  });

  it('renders no style element without custom CSS', () => {
    expect(mount({}).querySelector('.jv-root > style')).toBeNull();
  });

  it('marks the root with the theme type', () => {
    expect(mount({ theme: defaultLightTheme }).querySelector('.jv-root')?.classList.contains('jv-light')).toBe(true);
  });
});
