import { describe, expect, it } from 'vitest';
import { defaultFeatures, NO_RICH_VALUES, richValues } from './options';

describe('richValues', () => {
  it('draws the enabled value decorations', () => {
    expect(richValues(defaultFeatures, false)).toEqual({ colorSwatches: true, dateTooltips: true, imagePreview: true });
    expect(richValues({ ...defaultFeatures, dateTooltips: false, jsonPath: false }, false)).toEqual({
      colorSwatches: true,
      dateTooltips: false,
      imagePreview: true,
    });
  });

  it('draws none in light mode', () => {
    expect(richValues(defaultFeatures, true)).toBe(NO_RICH_VALUES);
  });
});

describe('defaultFeatures', () => {
  it('turns everything on', () => {
    expect(defaultFeatures).toEqual({ jsonPath: true, colorSwatches: true, dateTooltips: true, imagePreview: true });
  });
});
