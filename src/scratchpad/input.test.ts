import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { scratchpadInputItem, takeScratchpadInput } from './input';

describe('takeScratchpadInput', () => {
  beforeEach(() => fakeBrowser.reset());

  it('returns the handed-over text once', async () => {
    await scratchpadInputItem.setValue('{"a":1}');
    expect(await takeScratchpadInput()).toBe('{"a":1}');
    expect(await takeScratchpadInput()).toBe('');
  });

  it('keeps the text in session storage only', async () => {
    await scratchpadInputItem.setValue('[1]');
    expect(await fakeBrowser.storage.session.get('scratchpadInput')).toEqual({ scratchpadInput: '[1]' });
    expect(await fakeBrowser.storage.local.get(null)).toEqual({});
  });
});
