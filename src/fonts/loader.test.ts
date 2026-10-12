import { describe, expect, it } from 'vitest';
import { createFontLoader, type FontFaceFactory } from './loader';
import type { StoredFont } from './types';

const demo: StoredFont = {
  family: 'Demo Mono',
  faces: [
    { weight: '300 700', unicodeRange: 'U+0000-00FF', subset: 'latin', dataBase64: 'AQID' },
    { weight: '400', unicodeRange: '', subset: 'cyrillic', dataBase64: 'BAU=' },
  ],
  bytes: 5,
  subsets: ['latin', 'cyrillic'],
  downloadedAt: '2026-10-12T00:00:00.000Z',
};

function setup() {
  const registered = new Set<unknown>();
  const created: { family: string; data: Uint8Array; descriptors: FontFaceDescriptors }[] = [];
  const factory: FontFaceFactory = (family, data, descriptors) => {
    const face = { family, data, descriptors };
    created.push(face);
    return face as unknown as FontFace;
  };
  const target = {
    add: (face: FontFace) => registered.add(face),
    delete: (face: FontFace) => registered.delete(face),
  };
  return { registered, created, loader: createFontLoader(target, factory) };
}

describe('createFontLoader', () => {
  it('registers every face with its descriptors and decoded bytes', () => {
    const { registered, created, loader } = setup();
    loader.apply(demo);
    expect(registered.size).toBe(2);
    expect(created[0]).toEqual({
      family: 'Demo Mono',
      data: new Uint8Array([1, 2, 3]),
      descriptors: { weight: '300 700', style: 'normal', unicodeRange: 'U+0000-00FF' },
    });
    expect(created[1]).toEqual({ family: 'Demo Mono', data: new Uint8Array([4, 5]), descriptors: { weight: '400', style: 'normal' } });
  });

  it('replaces the previous font and clears with null', () => {
    const { registered, created, loader } = setup();
    loader.apply(demo);
    loader.apply({ ...demo, family: 'Other', faces: [demo.faces[0]!] });
    expect(registered.size).toBe(1);
    expect([...registered]).toEqual([created[2]]);
    loader.apply(null);
    expect(registered.size).toBe(0);
  });
});
