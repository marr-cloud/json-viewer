import { describe, expect, it } from 'vitest';
import { bool, intInRange, nonEmptyId, numberInRange, oneOf, validateFields } from './fields';

describe('field validators', () => {
  it('bool keeps booleans only', () => {
    expect(bool(true, false)).toBe(true);
    expect(bool('true', false)).toBe(false);
  });

  it('intInRange clamps and rounds finite numbers', () => {
    const tab = intInRange(1, 10);
    expect(tab(0, 2)).toBe(1);
    expect(tab(11, 2)).toBe(10);
    expect(tab(3.6, 2)).toBe(4);
    expect(tab(Number.NaN, 2)).toBe(2);
    expect(tab('3', 2)).toBe(2);
  });

  it('numberInRange clamps and keeps the given decimals', () => {
    const lineHeight = numberInRange(1, 3, 2);
    expect(lineHeight(1.234, 1.5)).toBe(1.23);
    expect(lineHeight(0.5, 1.5)).toBe(1);
    expect(lineHeight(9, 1.5)).toBe(3);
    expect(lineHeight(Number.POSITIVE_INFINITY, 1.5)).toBe(1.5);
  });

  it('oneOf accepts listed values only', () => {
    const weight = oneOf([300, 400] as const);
    expect(weight(300, 400)).toBe(300);
    expect(weight(500, 400)).toBe(400);
    expect(weight('300', 400)).toBe(400);
  });

  it('nonEmptyId rejects blank and non-string ids', () => {
    expect(nonEmptyId('dracula', 'x')).toBe('dracula');
    expect(nonEmptyId('  ', 'x')).toBe('x');
    expect(nonEmptyId(5, 'x')).toBe('x');
  });

  it('validateFields validates known fields and drops the rest', () => {
    const defaults = { size: 1, on: true };
    const validators = { size: intInRange(0, 5), on: bool };
    expect(validateFields({ size: 9, on: 'no', extra: 1 }, defaults, validators)).toEqual({ size: 5, on: true });
    const fromJunk = validateFields(null, defaults, validators);
    expect(fromJunk).toEqual(defaults);
    expect(fromJunk).not.toBe(defaults);
  });
});
