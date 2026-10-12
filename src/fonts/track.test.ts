import { beforeEach, describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { saveFont } from './store';
import { trackStoredFont } from './track';
import type { StoredFont } from './types';

const font = (family: string): StoredFont => ({
  family,
  faces: [{ weight: '400', unicodeRange: '', subset: 'latin', dataBase64: 'AQID' }],
  bytes: 3,
  subsets: ['latin'],
  downloadedAt: '2026-10-12T00:00:00.000Z',
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

describe('trackStoredFont', () => {
  beforeEach(() => fakeBrowser.reset());

  it('applies the stored font for the family and follows changes', async () => {
    const applied: (string | null)[] = [];
    const loader = { apply: (stored: StoredFont | null) => void applied.push(stored?.family ?? null) };
    await saveFont(font('Fira Code'));
    const family = ref('Fira Code');
    const stop = trackStoredFont(family, loader);
    await settle();
    expect(applied).toEqual(['Fira Code']);

    family.value = '';
    await settle();
    expect(applied).toEqual(['Fira Code', null]);

    // Chosen on another device, not downloaded here yet.
    family.value = 'JetBrains Mono';
    await settle();
    expect(applied).toEqual(['Fira Code', null, null]);

    await saveFont(font('JetBrains Mono'));
    await settle();
    expect(applied).toEqual(['Fira Code', null, null, 'JetBrains Mono']);

    stop();
    family.value = 'Fira Code';
    await saveFont(font('JetBrains Mono'));
    await settle();
    expect(applied).toHaveLength(4);
  });
});
