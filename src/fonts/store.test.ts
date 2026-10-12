import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { deleteFont, getFont, listFonts, saveFont, watchFont, watchFontIndex } from './store';
import type { StoredFont } from './types';

const font = (family: string, bytes = 3): StoredFont => ({
  family,
  faces: [{ weight: '400', unicodeRange: '', subset: 'latin', dataBase64: 'AQID' }],
  bytes,
  subsets: ['latin'],
  downloadedAt: '2026-10-12T00:00:00.000Z',
});
const summary = (family: string, bytes = 3) => ({
  family,
  bytes,
  subsets: ['latin'],
  downloadedAt: '2026-10-12T00:00:00.000Z',
});

describe('font store', () => {
  beforeEach(() => fakeBrowser.reset());

  it('saves, lists and reads fonts by family in local storage', async () => {
    await saveFont(font('Fira Code', 10));
    await saveFont(font('JetBrains Mono', 20));
    expect(await listFonts()).toEqual([summary('Fira Code', 10), summary('JetBrains Mono', 20)]);
    expect(await getFont('Fira Code')).toEqual(font('Fira Code', 10));
    expect((await fakeBrowser.storage.local.get('fonts/Fira Code'))['fonts/Fira Code']).toEqual(font('Fira Code', 10));
    expect((await fakeBrowser.storage.local.get('fontFamilies')).fontFamilies).toEqual(['Fira Code', 'JetBrains Mono']);
  });

  it('replaces a font downloaded again without listing it twice', async () => {
    await saveFont(font('Fira Code', 10));
    await saveFont(font('Fira Code', 30));
    expect(await listFonts()).toEqual([summary('Fira Code', 30)]);
  });

  it('deletes fonts', async () => {
    await saveFont(font('Fira Code'));
    await deleteFont('Fira Code');
    expect(await getFont('Fira Code')).toBeNull();
    expect(await listFonts()).toEqual([]);
  });

  it('ignores missing, empty and corrupted entries', async () => {
    expect(await getFont('')).toBeNull();
    expect(await getFont('Nope')).toBeNull();
    await fakeBrowser.storage.local.set({ 'fonts/Bad': { family: 'Bad', faces: 'x' }, fontFamilies: ['Bad', 42] });
    expect(await getFont('Bad')).toBeNull();
    expect(await listFonts()).toEqual([]);
  });

  it('notifies watchers of one family and of the index', async () => {
    let family = 0;
    let index = 0;
    const stopFamily = watchFont('Fira Code', () => family++);
    const stopIndex = watchFontIndex(() => index++);
    await saveFont(font('Fira Code'));
    await saveFont(font('Other'));
    stopFamily();
    stopIndex();
    await saveFont(font('Fira Code', 99));
    expect(family).toBe(1);
    expect(index).toBe(2);
  });
});
