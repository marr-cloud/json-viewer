import { describe, expect, it } from 'vitest';
import { byteLength, countLines, formatBytes, isLightMode } from './stats';

describe('byteLength', () => {
  it('counts UTF-8 bytes', () => {
    expect(byteLength('')).toBe(0);
    expect(byteLength('{"a":1}')).toBe(7);
    expect(byteLength('ñ')).toBe(2);
    expect(byteLength('こ')).toBe(3);
    expect(byteLength('😀')).toBe(4);
  });

  it('counts a lone surrogate as the 3-byte replacement character, like TextEncoder', () => {
    expect(byteLength('\ud800')).toBe(3);
    expect(byteLength('a\udc00b')).toBe(5);
    expect(byteLength('😀\ud83d')).toBe(7);
  });

  it('matches TextEncoder on mixed text', () => {
    const text = 'aé€😀\ud800z'.repeat(100);
    expect(byteLength(text)).toBe(new TextEncoder().encode(text).length);
  });

  it('does not split a surrogate pair at a chunk boundary', () => {
    const text = 'a'.repeat((1 << 20) - 1) + '😀' + 'b';
    expect(byteLength(text)).toBe(new TextEncoder().encode(text).length);
  });
});

describe('isLightMode', () => {
  it('is on above the threshold, in MiB', () => {
    expect(isLightMode(20 * 1024 * 1024, 20)).toBe(false);
    expect(isLightMode(20 * 1024 * 1024 + 1, 20)).toBe(true);
    expect(isLightMode(0, 1)).toBe(false);
  });
});

describe('formatBytes', () => {
  it('uses B below 1 KB and one decimal above', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(12_697)).toBe('12.4 KB');
    expect(formatBytes(4_166_671)).toBe('4.0 MB');
  });
});

describe('countLines', () => {
  it('counts lines like CodeMirror does', () => {
    expect(countLines('')).toBe(1);
    expect(countLines('a')).toBe(1);
    expect(countLines('a\nb')).toBe(2);
    expect(countLines('a\r\nb')).toBe(2);
    expect(countLines('a\rb')).toBe(2);
    expect(countLines('a\n')).toBe(2);
  });
});

