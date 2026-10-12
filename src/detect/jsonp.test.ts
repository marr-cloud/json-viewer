import { describe, expect, it } from 'vitest';
import { jsonpBounds } from './jsonp';

const BOM = String.fromCharCode(0xfeff);

const inner = (text: string) => {
  const bounds = jsonpBounds(text);
  return bounds && { callback: bounds.callback, json: text.slice(bounds.from, bounds.to) };
};

describe('jsonpBounds', () => {
  it('finds the JSON inside a callback call', () => {
    expect(inner('cb({"a":1})')).toEqual({ callback: 'cb', json: '{"a":1}' });
    expect(inner('  jQuery.cb_1 ( [1, 2] ) ;\n')).toEqual({ callback: 'jQuery.cb_1', json: ' [1, 2] ' });
    expect(inner('/**/ $cb({"a":1});')).toEqual({ callback: '$cb', json: '{"a":1}' });
    expect(inner(BOM + 'cb(1)')).toEqual({ callback: 'cb', json: '1' });
  });

  it('rejects JSON and other text', () => {
    for (const text of ['{"a":1}', '[1]', 'cb', 'cb(1', 'cb(1) + 2', '1cb(1)', 'cb()x', 'a-b(1)', '']) {
      expect(jsonpBounds(text), text).toBeNull();
    }
  });

  it('accepts an empty call, which then fails to parse', () => {
    expect(inner('cb()')).toEqual({ callback: 'cb', json: '' });
  });
});
