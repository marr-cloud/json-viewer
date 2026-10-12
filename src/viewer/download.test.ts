// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadName, downloadText } from './download';

describe('downloadName', () => {
  it('uses the last path segment and adds .json', () => {
    expect(downloadName('https://api.test/v1/users')).toBe('users.json');
    expect(downloadName('https://api.test/data.json?page=2#x')).toBe('data.json');
    expect(downloadName('https://api.test/a%20b.JSON')).toBe('a b.JSON');
  });

  it('falls back to data.json', () => {
    for (const url of ['', 'not a url', 'https://api.test/', 'https://api.test/...', 'https://api.test/%E0%A4%A']) {
      expect(downloadName(url)).toBe('data.json');
    }
  });

  it('replaces characters that are not allowed in file names', () => {
    expect(downloadName('https://api.test/a%2Fb%3Ac')).toBe('a_b_c.json');
  });

  it('keeps names short', () => {
    expect(downloadName(`https://api.test/${'x'.repeat(300)}`)).toBe(`${'x'.repeat(100)}.json`);
  });
});

describe('downloadText', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('clicks a temporary link to a JSON blob and revokes it later', () => {
    vi.useFakeTimers();
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    let clicked: HTMLAnchorElement | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked = this;
    });

    downloadText('{"a":1}', 'users.json');

    const blob = create.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe('application/json');
    expect(clicked?.href).toBe('blob:test');
    expect(clicked?.download).toBe('users.json');
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });
});
