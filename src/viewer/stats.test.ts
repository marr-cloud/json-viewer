import { describe, expect, it } from 'vitest';
import { byteLength, countLines, formatBytes, formatCount } from './stats';

describe('byteLength', () => {
  it('counts UTF-8 bytes', () => {
    expect(byteLength('')).toBe(0);
    expect(byteLength('{"a":1}')).toBe(7);
    expect(byteLength('ñ')).toBe(2);
    expect(byteLength('こ')).toBe(3);
    expect(byteLength('😀')).toBe(4);
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

describe('formatCount', () => {
  it('pluralizes and groups digits', () => {
    expect(formatCount(1, 'line')).toBe('1 line');
    expect(formatCount(0, 'line')).toBe('0 lines');
    expect(formatCount(450_002, 'line')).toBe('450,002 lines');
    expect(formatCount(3, 'match', 'matches')).toBe('3 matches');
    expect(formatCount(1, 'match', 'matches')).toBe('1 match');
  });
});
