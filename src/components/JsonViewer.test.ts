// @vitest-environment happy-dom
import { foldedRanges } from '@codemirror/language';
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

  const button = (host: HTMLElement, label: string) => host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;

  it('sorts keys for this tab without touching the setting', async () => {
    const host = mount({ raw: '{"b":1,"a":2}' });
    const sort = button(host, 'Sort keys');
    expect(sort.getAttribute('aria-pressed')).toBe('false');
    // happy-dom fires selectionchange synchronously, which re-enters a focused editor's update.
    editorOf(host).contentDOM.blur();
    sort.click();
    await nextTick();
    expect(editorOf(host).state.doc.line(2).text).toBe('  "a": 2,');
    expect(sort.getAttribute('aria-pressed')).toBe('true');
    expect(defaultViewerOptions.sortKeys).toBe(false);
  });

  it('copies the formatted and the minified document', async () => {
    const writeText = mockClipboard();
    const host = mount({ raw: '{ "a" : [1, 2] }' });
    button(host, 'Copy formatted JSON').click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('{\n  "a": [\n    1,\n    2\n  ]\n}'));
    button(host, 'Copy minified JSON').click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('{"a":[1,2]}'));
    await vi.waitFor(() => expect(host.querySelector('.jv-status-message')?.textContent).toBe('Copied minified JSON'));
  });

  it('disables copy minified for invalid JSON but copies the raw text as formatted', async () => {
    const writeText = mockClipboard();
    const host = mount({ raw: '{"a":' });
    expect(button(host, 'Copy minified JSON').disabled).toBe(true);
    button(host, 'Copy formatted JSON').click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('{"a":'));
  });

  it('downloads the document named after the URL', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    let link: HTMLAnchorElement | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      link = this;
    });
    const host = mount({ source: { url: 'https://api.test/v1/users?page=2', loadedAt: new Date() } });
    button(host, 'Download JSON').click();
    expect(link?.download).toBe('users.json');
  });

  it('folds all, unfolds all and folds to a level', async () => {
    const host = mount({ raw: '{"a":{"b":{"c":[1]}}}' });
    const folds = () => foldedRanges(editorOf(host).state).size;
    button(host, 'Fold all').click();
    expect(folds()).toBe(3);
    button(host, 'Unfold all').click();
    expect(folds()).toBe(0);
    const select = host.querySelector<HTMLSelectElement>('[aria-label="Fold to level"]')!;
    select.value = '4';
    select.dispatchEvent(new Event('change'));
    expect(folds()).toBe(1);
    expect(select.value).toBe('');
  });

  it('disables folding on the Raw tab', async () => {
    const host = mount();
    host.querySelector<HTMLButtonElement>('[role="tab"]:nth-child(2)')!.click();
    await nextTick();
    expect(button(host, 'Fold all').disabled).toBe(true);
    expect(host.querySelector<HTMLSelectElement>('[aria-label="Fold to level"]')!.disabled).toBe(true);
  });
});
