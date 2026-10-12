import { describe, expect, it } from 'vitest';
import { detect, isJsonContentType, isNdjson, normalizeContentType, sniffKind } from './detect';

const BOM = String.fromCharCode(0xfeff);

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
    ['text/plain', BOM + '  {"a":1}  '],
    ['application/javascript', '{"a":1}'],
  ])('detects %s with %j as JSON', (type, text) => {
    expect(detect(type, text)).toEqual({ kind: 'json' });
  });

  it.each([
    ['application/json', 'cb({"a":1})'],
    ['application/javascript', 'cb({"a":1});'],
    ['text/javascript; charset=utf-8', '/**/ jQuery123.cb([1, 2]);'],
    ['application/x-javascript', 'cb([1])'],
    ['text/plain', 'cb({"a":1})'],
    ['text/javascript', "/**/ typeof cb === 'function' && cb({\"a\":1});"],
  ])('detects %s with %j as JSONP', (type, text) => {
    expect(detect(type, text)).toEqual({ kind: 'jsonp' });
  });

  it.each([
    ['application/x-ndjson', '{"a":1}\n{"a":2}\n'],
    ['application/jsonl', 'anything'],
    ['text/plain', '{"a":1}\n\n{"a":2}\r\n[3]\n'],
  ])('detects %s with %j as NDJSON', (type, text) => {
    expect(detect(type, text)).toEqual({ kind: 'ndjson' });
  });

  it.each([
    ['text/plain', '[INFO] server started'],
    ['text/plain', '{ not json'],
    ['text/plain', 'hello'],
    ['text/plain', '42'],
    ['text/plain', ''],
    ['text/plain', '{"a":1}\n{oops}'],
    ['text/plain', 'cb({oops})'],
    ['text/html', '{"a":1}'],
    ['application/javascript', 'console.log("hi");'],
    ['application/javascript', 'cb({oops})'],
    ['application/javascript', '{"a":1}\n{"a":2}'],
    ['application/octet-stream', '{}'],
  ])('ignores %s with %j', (type, text) => {
    expect(detect(type, text)).toBeNull();
  });
});

describe('isNdjson', () => {
  it('needs two or more objects or arrays, one per line', () => {
    expect(isNdjson('{"a":1}\n{"b":2}')).toBe(true);
    expect(isNdjson(BOM + '[1]\n[2]\n')).toBe(true);
    expect(isNdjson('{"a":1}')).toBe(false);
    expect(isNdjson('1\n2')).toBe(false);
    expect(isNdjson('{\n  "a": 1\n}')).toBe(false);
    expect(isNdjson('')).toBe(false);
  });
});

describe('sniffKind', () => {
  it('tells JSONP and NDJSON from JSON without a content type', () => {
    expect(sniffKind('cb({"a":1})')).toBe('jsonp');
    expect(sniffKind('{"a":1}\n{"a":2}')).toBe('ndjson');
    expect(sniffKind('{"a":1}')).toBe('json');
    expect(sniffKind('not json')).toBe('json');
    expect(sniffKind('')).toBe('json');
  });
});
