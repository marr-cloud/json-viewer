// @vitest-environment happy-dom
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { defaultLightTheme, defaultTheme } from '@/themes/builtin';
import type { Theme } from '@/themes/types';
import { defaultFontSettings, type FontSettings } from '@/settings/font';
import { defaultViewerOptions } from '@/viewer/options';
import JsonViewer from './JsonViewer.vue';

let app: App | undefined;

type Props = {
  raw?: string;
  font?: FontSettings;
  theme?: Theme;
  customCss?: string;
  source?: { url: string; loadedAt: Date };
  onToggleTheme?: () => void;
  onOpenSettings?: () => void;
};

function mount(props: Props = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  app = createApp({
    render: () => h(JsonViewer, { raw: '{"a":1}', options: defaultViewerOptions, theme: defaultTheme, ...props }),
  });
  app.mount(host);
  return host;
}

function editorOf(host: HTMLElement): EditorView {
  return EditorView.findFromDOM(host.querySelector<HTMLElement>('.cm-editor')!)!;
}

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
}

afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
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

  it('shows the size, line count and format', () => {
    const info = mount().querySelector('.jv-status-info')!;
    expect(info.textContent).toContain('7 B');
    expect(info.textContent).toContain('3 lines');
    expect(info.textContent).toContain('JSON');
  });

  it('shows the cursor path and copies it on click', async () => {
    const writeText = mockClipboard();
    const host = mount();
    const path = host.querySelector<HTMLButtonElement>('.jv-path')!;
    expect(path.textContent).toBe('$');
    const view = editorOf(host);
    // happy-dom fires selectionchange synchronously, which re-enters a focused editor's update.
    view.contentDOM.blur();
    view.dispatch({ selection: { anchor: view.state.doc.toString().indexOf('"a"') + 1 } });
    await nextTick();
    expect(path.textContent).toBe('$.a');
    path.click();
    await vi.waitFor(() => expect(host.querySelector('.jv-status-message')?.textContent).toBe('Copied path'));
    expect(writeText).toHaveBeenCalledWith('$.a');
  });

  it('hides the path and counts raw lines on the Raw tab', async () => {
    const host = mount();
    host.querySelector<HTMLButtonElement>('[role="tab"]:nth-child(2)')!.click();
    await nextTick();
    expect(host.querySelector('.jv-path')).toBeNull();
    expect(host.querySelector('.jv-status-info')?.textContent).toContain('1 line');
  });
});
