import { describe, expect, it } from 'vitest';
import { mergeUnknown } from './merge';

describe('mergeUnknown', () => {
  it('returns the new value when nothing usable is stored', () => {
    expect(mergeUnknown(undefined, { a: 1 })).toEqual({ a: 1 });
    expect(mergeUnknown([1], { a: 1 })).toEqual({ a: 1 });
  });

  it('keeps stored keys the new value does not know, nested ones included', () => {
    const stored = { a: 0, future: 'x', nested: { b: 0, later: true } };
    expect(mergeUnknown(stored, { a: 1, nested: { b: 2 } })).toEqual({
      a: 1,
      future: 'x',
      nested: { b: 2, later: true },
    });
  });

  it('lets the new value win for known keys, arrays included', () => {
    expect(mergeUnknown({ list: [1, 2], obj: 'old' }, { list: [3], obj: { k: 1 } })).toEqual({
      list: [3],
      obj: { k: 1 },
    });
  });

  it('does not mutate its inputs', () => {
    const stored = { nested: { later: true } };
    const next = { nested: { b: 1 } };
    mergeUnknown(stored, next);
    expect(stored).toEqual({ nested: { later: true } });
    expect(next).toEqual({ nested: { b: 1 } });
  });
});
