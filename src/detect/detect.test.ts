import { describe, expect, it } from 'vitest';
import { detect, isJsonContentType, normalizeContentType } from './detect';

describe('normalizeContentType', () => {
  it('drops parameters and lowercases', () => {
    expect(normalizeContentType('Application/JSON; charset=utf-8')).toBe('application/json');
  });
});

describe('isJsonContentType', () => {
  it.each([
    ['application/json', true],
    ['text/json', true],
    ['application/ld+json', true],
    ['application/vnd.api+json; charset=utf-8', true],
    ['text/plain', false],
    ['text/html', false],
    ['application/javascript', false],
  ])('%s → %s', (type, expected) => {
    expect(isJsonContentType(type)).toBe(expected);
  });
});

describe('detect', () => {
  it.each([
    ['application/json', '{}'],
    ['application/json; charset=utf-8', 'not json at all'],
    ['APPLICATION/JSON', '[]'],
    ['application/ld+json', '{"@context":"x"}'],
    ['text/json', '[1]'],
    ['text/plain', '[{"a":1}]'],
    ['text/plain', '\uFEFF  {"a":1}  '],
  ])('detects %s with %j', (type, text) => {
    expect(detect(type, text)).toEqual({ kind: 'json' });
  });

  it.each([
    ['text/plain', '[INFO] server started'],
    ['text/plain', '{ not json'],
    ['text/plain', 'hello'],
    ['text/plain', '42'],
    ['text/plain', ''],
    ['text/html', '{"a":1}'],
    ['application/javascript', '{}'],
  ])('ignores %s with %j', (type, text) => {
    expect(detect(type, text)).toBeNull();
  });
});
