import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { handOffScratchpadInput, takeScratchpadInput } from './input';

describe('scratchpad hand-off', () => {
  beforeEach(() => fakeBrowser.reset());

  it('gives the text to the scratchpad opened with its id, once', async () => {
    const id = await handOffScratchpadInput('{"a":1}');
    expect(await takeScratchpadInput(id)).toBe('{"a":1}');
    expect(await takeScratchpadInput(id)).toBe('');
  });

  it('keeps two hand-offs apart', async () => {
    const first = await handOffScratchpadInput('[1]');
    const second = await handOffScratchpadInput('[2]');
    expect(first).not.toBe(second);
    expect(await takeScratchpadInput(second)).toBe('[2]');
    expect(await takeScratchpadInput(first)).toBe('[1]');
  });

  it('gives nothing without an id or for an unknown one', async () => {
    await handOffScratchpadInput('[1]');
    expect(await takeScratchpadInput(null)).toBe('');
    expect(await takeScratchpadInput('nope')).toBe('');
  });

  it('keeps the text in session storage only', async () => {
    const id = await handOffScratchpadInput('[1]');
    expect(await fakeBrowser.storage.session.get(null)).toEqual({ [`scratchpadInput:${id}`]: '[1]' });
    expect(await fakeBrowser.storage.local.get(null)).toEqual({});
  });
});
