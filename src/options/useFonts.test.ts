// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, type App } from 'vue';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { FontDownloadError } from '@/fonts/download';
import { setLocale } from '@/i18n';
import { useFonts, type FontsModel } from './useFonts';

const downloadFont = vi.hoisted(() => vi.fn());
vi.mock('@/fonts/download', async (original) => ({ ...(await original<object>()), downloadFont }));

let app: App | undefined;

function mountModel(): FontsModel {
  let model!: FontsModel;
  app = createApp({
    setup() {
      model = useFonts();
      return () => null;
    },
  });
  app.mount(document.createElement('div'));
  return model;
}

beforeEach(() => {
  fakeBrowser.reset();
  downloadFont.mockReset();
});

afterEach(() => {
  app?.unmount();
  app = undefined;
  setLocale('en');
});

describe('useFonts', () => {
  it('words a download error in the current language, and follows a change', async () => {
    downloadFont.mockRejectedValue(new FontDownloadError('options.fonts.error.unknownFamily', { family: 'Nope' }));
    const model = mountModel();
    expect(await model.download('Nope', ['latin'])).toBeNull();
    expect(model.error.value).toBe('"Nope" is not a Google Fonts family. Names are case-sensitive, e.g. "JetBrains Mono".');
    setLocale('es');
    expect(model.error.value).toBe(
      '«Nope» no es una familia de Google Fonts. Los nombres distinguen mayúsculas, p. ej. «JetBrains Mono».',
    );
  });

  it('wraps other failures with their reason', async () => {
    downloadFont.mockRejectedValue(new Error('QUOTA_BYTES quota exceeded'));
    const model = mountModel();
    await model.download('Fira Code', ['latin']);
    setLocale('es');
    expect(model.error.value).toBe('No se pudo guardar la fuente: QUOTA_BYTES quota exceeded');
  });
});
