import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { takeScratchpadInput } from '@/scratchpad/input';
import { openScratchpad, SCRATCHPAD_PAGE } from './scratchpad';

describe('openScratchpad', () => {
  let createTab: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fakeBrowser.reset();
    createTab = vi.fn().mockResolvedValue({});
    vi.spyOn(fakeBrowser.tabs, 'create').mockImplementation(createTab as never);
  });

  const openedUrl = () => new URL((createTab.mock.calls[0]![0] as { url: string }).url);

  it('opens the scratchpad page at the given position', async () => {
    await openScratchpad('', 4);
    expect(createTab).toHaveBeenCalledWith({ url: fakeBrowser.runtime.getURL(SCRATCHPAD_PAGE), index: 4 });
    expect(await fakeBrowser.storage.session.get(null)).toEqual({});
  });

  it('hands text over to the page it opens, through an id in its URL', async () => {
    await openScratchpad('[1, 2]');
    expect(createTab).toHaveBeenCalledOnce();
    const id = openedUrl().searchParams.get('input');
    expect(id).not.toBeNull();
    expect(await takeScratchpadInput(id)).toBe('[1, 2]');
  });
});
