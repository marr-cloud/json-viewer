import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCss2, selectFaces } from './css2';

const recorded = readFileSync(new URL('./__fixtures__/jetbrains-mono.css', import.meta.url), 'utf8');

const sample = `/* latin */
@font-face {
  font-family: 'Demo Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/demo/v1/regular.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131;
}
/* latin */
@font-face {
  font-family: 'Demo Mono';
  font-style: italic;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/demo/v1/italic.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
/* latin */
@font-face {
  font-family: 'Demo Mono';
  font-style: normal;
  font-weight: 700;
  src: url(https://fonts.gstatic.com/s/demo/v1/bold.ttf) format('truetype');
}
/* latin */
@font-face {
  font-family: 'Demo Mono';
  font-style: normal;
  font-weight: 700;
  src: url(https://example.com/evil.woff2) format('woff2');
}
@font-face {
  font-family: 'Demo Mono';
  font-style: normal;
  font-weight: 500;
  src: url(https://fonts.gstatic.com/s/demo/v1/nocomment.woff2) format('woff2');
}`;

describe('parseCss2', () => {
  it('parses a recorded Google Fonts response', () => {
    const faces = parseCss2(recorded);
    expect(faces).toHaveLength(30);
    expect(new Set(faces.map((face) => face.subset))).toEqual(
      new Set(['cyrillic', 'cyrillic-ext', 'greek', 'latin', 'latin-ext', 'vietnamese']),
    );
    expect(new Set(faces.map((face) => face.weight))).toEqual(new Set([300, 400, 500, 600, 700]));
    for (const face of faces) {
      expect(face.family).toBe('JetBrains Mono');
      expect(face.url).toMatch(/^https:\/\/fonts\.gstatic\.com\/.+\.woff2$/);
      expect(face.unicodeRange).not.toBe('');
    }
  });

  it('keeps only gstatic woff2 faces that carry a subset comment', () => {
    expect(parseCss2(sample)).toEqual([
      {
        subset: 'latin',
        family: 'Demo Mono',
        weight: 400,
        style: 'normal',
        unicodeRange: 'U+0000-00FF, U+0131',
        url: 'https://fonts.gstatic.com/s/demo/v1/regular.woff2',
      },
      {
        subset: 'latin',
        family: 'Demo Mono',
        weight: 400,
        style: 'italic',
        unicodeRange: 'U+0000-00FF',
        url: 'https://fonts.gstatic.com/s/demo/v1/italic.woff2',
      },
    ]);
  });
});

describe('selectFaces', () => {
  it('keeps the requested subsets and normal style only', () => {
    expect(selectFaces(parseCss2(sample), ['latin'])).toEqual([
      {
        subset: 'latin',
        weight: '400',
        unicodeRange: 'U+0000-00FF, U+0131',
        url: 'https://fonts.gstatic.com/s/demo/v1/regular.woff2',
      },
    ]);
    expect(selectFaces(parseCss2(sample), ['greek'])).toEqual([]);
  });

  it('merges the weights of a variable font into one face per file', () => {
    const files = selectFaces(parseCss2(recorded), ['latin', 'latin-ext']);
    expect(files.map((file) => `${file.subset} ${file.weight}`).sort()).toEqual(['latin 300 700', 'latin-ext 300 700']);
  });
});
