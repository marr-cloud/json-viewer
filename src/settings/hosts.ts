// Settings live in one storage.sync item (8 KB): 50 patterns of up to 100 characters stay well inside it.
export const MAX_EXCLUDED_HOSTS = 50;
export const MAX_HOST_PATTERN_LENGTH = 100;

// Letters, digits, hyphens and * wildcards, in dot-separated labels ("api.example.com", "*.example.com", "10.0.*").
const HOST_PATTERN = /^[a-z0-9*-]+(?:\.[a-z0-9*-]+)*$/;

/**
 * A host pattern in canonical form, or null. Accepts a pasted URL ("https://api.example.com:8080/v1") and keeps
 * only its host; ports are ignored when matching.
 */
export function normalizeHostPattern(input: string): string | null {
  let host = input.trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  host = host.split(/[/?#]/, 1)[0] ?? '';
  host = host.replace(/:\d*$/, '');
  if (host === '' || host.length > MAX_HOST_PATTERN_LENGTH || !HOST_PATTERN.test(host)) return null;
  return host;
}

export interface HostList {
  hosts: string[];
  /** Lines that aren't host patterns, as typed. */
  invalid: string[];
  /** Valid patterns dropped because the list is full. */
  dropped: number;
}

/** Reads one pattern per line: normalized, without duplicates, and at most MAX_EXCLUDED_HOSTS. */
export function parseHostList(text: string): HostList {
  const hosts: string[] = [];
  const invalid: string[] = [];
  let dropped = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const host = normalizeHostPattern(line);
    if (host === null) invalid.push(line.trim());
    else if (hosts.includes(host)) continue;
    else if (hosts.length === MAX_EXCLUDED_HOSTS) dropped++;
    else hosts.push(host);
  }
  return { hosts, invalid, dropped };
}

/** The settings validator: keeps the valid, distinct patterns of an array (at most MAX_EXCLUDED_HOSTS). */
export function validateExcludedHosts(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return parseHostList(value.filter((item): item is string => typeof item === 'string').join('\n')).hosts;
}

/** `*` matches any characters; a leading "*." also matches the bare domain ("*.example.com" matches example.com). */
export function hostMatches(hostname: string, pattern: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  const body = (glob: string) => glob.split('*').map((part) => part.replace(/\./g, '\\.')).join('.*');
  const source = pattern.startsWith('*.') ? `^(?:.*\\.)?${body(pattern.slice(2))}$` : `^${body(pattern)}$`;
  return new RegExp(source).test(host);
}

export function isExcludedHost(hostname: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => hostMatches(hostname, pattern));
}
