import { describe, expect, it } from 'vitest';
import {
  hostMatches,
  isExcludedHost,
  MAX_EXCLUDED_HOSTS,
  normalizeHostPattern,
  parseHostList,
  validateExcludedHosts,
} from './hosts';

describe('normalizeHostPattern', () => {
  it('keeps host patterns, lowercased', () => {
    expect(normalizeHostPattern('  API.Example.com ')).toBe('api.example.com');
    expect(normalizeHostPattern('*.example.com')).toBe('*.example.com');
    expect(normalizeHostPattern('localhost')).toBe('localhost');
    expect(normalizeHostPattern('127.0.0.1')).toBe('127.0.0.1');
    expect(normalizeHostPattern('10.0.*')).toBe('10.0.*');
  });

  it('takes the host out of a pasted URL', () => {
    expect(normalizeHostPattern('https://api.example.com:8080/v1?x=1')).toBe('api.example.com');
    expect(normalizeHostPattern('example.com/path')).toBe('example.com');
    expect(normalizeHostPattern('localhost:3000')).toBe('localhost');
  });

  it('rejects anything else', () => {
    for (const value of ['', '   ', 'a b.com', 'exa_mple.com', '.example.com', 'example..com', 'user@example.com', '[::1]']) {
      expect(normalizeHostPattern(value), value).toBeNull();
    }
    expect(normalizeHostPattern(`${'a'.repeat(101)}.com`)).toBeNull();
  });
});

describe('parseHostList', () => {
  it('reads one pattern per line, without duplicates, and lists the invalid lines', () => {
    expect(parseHostList('example.com\n\n EXAMPLE.com\nnot a host\n*.test\r\n')).toEqual({
      hosts: ['example.com', '*.test'],
      invalid: ['not a host'],
      dropped: 0,
    });
  });

  it(`keeps at most ${MAX_EXCLUDED_HOSTS} patterns`, () => {
    const text = Array.from({ length: MAX_EXCLUDED_HOSTS + 3 }, (_, i) => `h${i}.com`).join('\n');
    const list = parseHostList(text);
    expect(list.hosts).toHaveLength(MAX_EXCLUDED_HOSTS);
    expect(list.dropped).toBe(3);
  });
});

describe('validateExcludedHosts', () => {
  it('keeps the valid strings of an array', () => {
    expect(validateExcludedHosts(['a.com', 42, 'bad host', 'A.com', '*.b.com'], [])).toEqual(['a.com', '*.b.com']);
  });

  it('falls back when the value is not an array', () => {
    expect(validateExcludedHosts('a.com', ['x.com'])).toEqual(['x.com']);
    expect(validateExcludedHosts(undefined, [])).toEqual([]);
  });
});

describe('hostMatches', () => {
  it('matches exactly, case-insensitively and ignoring a trailing dot', () => {
    expect(hostMatches('api.example.com', 'api.example.com')).toBe(true);
    expect(hostMatches('API.Example.com.', 'api.example.com')).toBe(true);
    expect(hostMatches('example.com', 'api.example.com')).toBe(false);
    expect(hostMatches('xapi.example.com', 'api.example.com')).toBe(false);
  });

  it('treats a leading *. as the domain and its subdomains', () => {
    expect(hostMatches('example.com', '*.example.com')).toBe(true);
    expect(hostMatches('a.b.example.com', '*.example.com')).toBe(true);
    expect(hostMatches('notexample.com', '*.example.com')).toBe(false);
  });

  it('lets * match anything elsewhere', () => {
    expect(hostMatches('10.0.3.4', '10.0.*')).toBe(true);
    expect(hostMatches('api-staging.example.com', 'api-*.example.com')).toBe(true);
    expect(hostMatches('api.example.com', 'api-*.example.com')).toBe(false);
  });
});

describe('isExcludedHost', () => {
  it('is true when any pattern matches', () => {
    expect(isExcludedHost('127.0.0.1', ['example.com', '127.0.0.1'])).toBe(true);
    expect(isExcludedHost('127.0.0.1', [])).toBe(false);
  });
});
