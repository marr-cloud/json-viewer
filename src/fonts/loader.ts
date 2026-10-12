import { base64ToBytes } from './base64';
import type { StoredFont } from './types';

export interface FontFaceTarget {
  add(face: FontFace): unknown;
  delete(face: FontFace): unknown;
}

export type FontFaceFactory = (family: string, data: Uint8Array, descriptors: FontFaceDescriptors) => FontFace;

// Faces built from bytes aren't fetched, so the page's CSP (font-src) doesn't apply to them.
const createFace: FontFaceFactory = (family, data, descriptors) => {
  const face = new FontFace(family, data as Uint8Array<ArrayBuffer>, descriptors);
  face.loaded.catch((error: unknown) => console.warn('[json-viewer] font face failed to load', family, error));
  return face;
};

/** Registers one downloaded family at a time on a FontFaceSet (document.fonts), replacing the previous one. */
export function createFontLoader(target: FontFaceTarget, factory: FontFaceFactory = createFace) {
  let current: FontFace[] = [];
  return {
    apply(font: StoredFont | null): void {
      for (const face of current) target.delete(face);
      current = [];
      if (!font) return;
      for (const face of font.faces) {
        const descriptors: FontFaceDescriptors = { weight: face.weight, style: 'normal' };
        if (face.unicodeRange) descriptors.unicodeRange = face.unicodeRange;
        const fontFace = factory(font.family, base64ToBytes(face.dataBase64), descriptors);
        target.add(fontFace);
        current.push(fontFace);
      }
    },
  };
}

export type FontLoader = ReturnType<typeof createFontLoader>;
