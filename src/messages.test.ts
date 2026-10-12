import { describe, expect, it } from 'vitest';
import { isJsonDetectedMessage, isOpenOptionsMessage, JSON_DETECTED, OPEN_OPTIONS } from './messages';

describe('isJsonDetectedMessage', () => {
  it('accepts the detector message only', () => {
    expect(isJsonDetectedMessage({ type: JSON_DETECTED })).toBe(true);
    expect(isJsonDetectedMessage({ type: 'other' })).toBe(false);
    expect(isJsonDetectedMessage(null)).toBe(false);
    expect(isJsonDetectedMessage('json-detected')).toBe(false);
  });
});

describe('isOpenOptionsMessage', () => {
  it('accepts the open-options message only', () => {
    expect(isOpenOptionsMessage({ type: OPEN_OPTIONS })).toBe(true);
    expect(isOpenOptionsMessage({ type: 'json-detected' })).toBe(false);
    expect(isOpenOptionsMessage(undefined)).toBe(false);
  });
});
