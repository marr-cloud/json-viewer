// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref, type App } from 'vue';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { BACKUP_FORMAT, MAX_BACKUP_BYTES } from '@/settings/backup';
import { defaultSettings, type Settings } from '@/settings/schema';
import type { Theme } from '@/themes/types';
import SettingsActions from './SettingsActions.vue';
import type { SettingsModel } from './useSettings';

const saveCustomTheme = vi.hoisted(() => vi.fn());
// happy-dom has no window.confirm.
const confirm = vi.fn<(message?: string) => boolean>();
vi.mock('@/themes/store', async (original) => ({ ...(await original<object>()), saveCustomTheme }));

const theme = (id: string): Theme => ({
  id,
  name: id,
  type: 'dark',
  source: 'custom',
  colors: { background: '#101010', foreground: '#eeeeee' },
});

let app: App | undefined;
let order: string[] = [];

function mount(customThemes: Theme[] = []) {
  const model: SettingsModel = {
    settings: ref<Settings>(structuredClone(defaultSettings)),
    customCss: ref(''),
    loaded: ref(true),
    reset: vi.fn(),
    replace: vi.fn(async (settings: Settings, css: string) => {
      order.push('settings');
      model.settings.value = settings;
      model.customCss.value = css;
    }),
  };
  const host = document.createElement('div');
  document.body.append(host);
  app = createApp({ render: () => h(SettingsActions, { model, customThemes }) });
  app.mount(host);
  return { host, model };
}

/** Picks `file` in the hidden input, as the Import button's file chooser would. */
async function pick(host: HTMLElement, file: File): Promise<void> {
  const input = host.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
  // file.text(), the confirm and the theme saves are all awaited in turn.
  await vi.waitFor(() => expect(host.querySelector('[role=status], [role=alert]')).not.toBeNull());
  await nextTick();
}

const backupFile = (content: unknown, name = 'backup.json') =>
  new File([typeof content === 'string' ? content : JSON.stringify(content)], name, { type: 'application/json' });

const texts = (host: HTMLElement, role: string) =>
  [...host.querySelectorAll(`[role=${role}]`)].map((element) => element.textContent);

beforeEach(() => {
  fakeBrowser.reset();
  order = [];
  saveCustomTheme.mockReset().mockImplementation(async (saved: Theme) => {
    order.push(saved.id);
  });
  confirm.mockReset().mockReturnValue(true);
  vi.stubGlobal('confirm', confirm);
});

afterEach(() => {
  app?.unmount();
  app = undefined;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SettingsActions', () => {
  it('exports what is on screen, including edits not saved yet', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    let link: HTMLAnchorElement | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      link = this;
    });
    const blobs: Blob[] = [];
    const original = globalThis.Blob;
    vi.spyOn(globalThis, 'Blob').mockImplementation(function (parts?: BlobPart[], options?: BlobPropertyBag) {
      const blob = new original(parts, options);
      blobs.push(blob);
      return blob;
    } as never);
    const { host, model } = mount([theme('mine')]);
    model.settings.value.viewer.tabSize = 7;
    host.querySelector<HTMLButtonElement>('button')!.click();
    expect(link?.download).toMatch(/^json-viewer-settings-\d{4}-\d{2}-\d{2}\.json$/);
    return blobs[0]!.text().then((text) => {
      expect(JSON.parse(text)).toMatchObject({
        format: BACKUP_FORMAT,
        settings: { viewer: { tabSize: 7 } },
        customThemes: [theme('mine')],
      });
    });
  });

  it('imports after confirming and reports what happened to the themes', async () => {
    saveCustomTheme.mockImplementation(async (saved: Theme) => {
      order.push(saved.id);
      if (saved.id === 'big') throw new Error('QUOTA_BYTES quota exceeded');
    });
    const { host, model } = mount();
    await pick(
      host,
      backupFile({
        format: BACKUP_FORMAT,
        version: 1,
        settings: { locale: 'es', viewer: { tabSize: 3 } },
        customCss: 'b{}',
        customThemes: [theme('mine'), theme('big'), { id: 'Bad' }],
      }),
    );
    expect(confirm).toHaveBeenCalledWith(
      'Replace your settings and custom CSS with the ones in “backup.json”? Its custom themes are added, replacing yours that have the same id.',
    );
    expect(model.settings.value.viewer.tabSize).toBe(3);
    expect(model.customCss.value).toBe('b{}');
    // The settings are saved (and awaited) before the themes take storage space.
    expect(order).toEqual(['settings', 'mine', 'big']);
    expect(texts(host, 'status')).toEqual([
      'Settings imported from “backup.json”.',
      '1 custom theme added or updated.',
      '1 theme in the file was left out.',
    ]);
    expect(texts(host, 'alert')).toEqual([
      '1 theme could not be saved: sync storage is full or busy. Try again in a minute, or remove other custom themes.',
    ]);
  });

  it('stops and says so when the settings cannot be saved', async () => {
    const { host, model } = mount();
    vi.mocked(model.replace).mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'));
    await pick(host, backupFile({ format: BACKUP_FORMAT, version: 1, settings: {}, customThemes: [theme('mine')] }));
    expect(texts(host, 'alert')).toEqual(['The settings could not be saved: QUOTA_BYTES quota exceeded']);
    expect(texts(host, 'status')).toEqual([]);
    expect(saveCustomTheme).not.toHaveBeenCalled();
  });

  it('changes nothing when the confirmation is declined', async () => {
    confirm.mockReturnValue(false);
    const { host, model } = mount();
    const input = host.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', { value: [backupFile({ format: BACKUP_FORMAT, version: 1, settings: { viewer: { tabSize: 3 } } })] });
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(confirm).toHaveBeenCalled());
    await nextTick();
    expect(model.settings.value.viewer.tabSize).toBe(defaultSettings.viewer.tabSize);
    expect(saveCustomTheme).not.toHaveBeenCalled();
  });

  it('refuses a file over the size limit without reading it', async () => {
    const { host } = mount();
    const file = backupFile('{}');
    Object.defineProperty(file, 'size', { value: MAX_BACKUP_BYTES + 1 });
    const read = vi.spyOn(file, 'text');
    await pick(host, file);
    expect(texts(host, 'alert')).toEqual(['That file is too big to be a JSON Viewer Extended settings file.']);
    expect(read).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('resets after confirming', () => {
    const { host, model } = mount();
    [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('Reset'))!.click();
    expect(model.reset).toHaveBeenCalledOnce();
  });
});
