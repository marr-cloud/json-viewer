import { describe, expect, it } from 'vitest';
import { isJsonDetectedMessage, JSON_DETECTED } from './messages';

describe('isJsonDetectedMessage', () => {
  it('accepts the detector message only', () => {
    expect(isJsonDetectedMessage({ type: JSON_DETECTED })).toBe(true);
    expect(isJsonDetectedMessage({ type: 'other' })).toBe(false);
    expect(isJsonDetectedMessage(null)).toBe(false);
    expect(isJsonDetectedMessage('json-detected')).toBe(false);
  });
});
