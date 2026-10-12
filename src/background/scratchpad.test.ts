import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { scratchpadInputItem } from '@/scratchpad/input';
import { openScratchpad, SCRATCHPAD_PAGE } from './scratchpad';

describe('openScratchpad', () => {
  let createTab: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fakeBrowser.reset();
    createTab = vi.fn().mockResolvedValue({});
    vi.spyOn(fakeBrowser.tabs, 'create').mockImplementation(createTab as never);
  });

  it('opens the scratchpad page at the given position', async () => {
    await openScratchpad('', 4);
    expect(createTab).toHaveBeenCalledWith({ url: fakeBrowser.runtime.getURL(SCRATCHPAD_PAGE), index: 4 });
    expect(await scratchpadInputItem.getValue()).toBe('');
  });

  it('hands text over to the page', async () => {
    await openScratchpad('[1, 2]');
    expect(await scratchpadInputItem.getValue()).toBe('[1, 2]');
    expect(createTab).toHaveBeenCalledOnce();
  });
});
