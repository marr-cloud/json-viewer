import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { FORCE_VIEWER_FLAG } from '@/messages';
import { injectViewer, onJsonDetected, VIEWER_SCRIPT } from './viewer';

describe('background viewer injection', () => {
  let executeScript: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fakeBrowser.reset();
    executeScript = vi.fn().mockResolvedValue([]);
    vi.spyOn(fakeBrowser.scripting, 'executeScript').mockImplementation(executeScript as never);
  });

  const target = { tabId: 7, frameId: 3 };

  it('injects the viewer into the frame', async () => {
    await injectViewer(target);
    expect(executeScript).toHaveBeenCalledTimes(1);
    expect(executeScript).toHaveBeenCalledWith({ target: { tabId: 7, frameIds: [3] }, files: [VIEWER_SCRIPT] });
  });

  it('sets the force flag first when forced', async () => {
    await injectViewer(target, true);
    expect(executeScript).toHaveBeenCalledTimes(2);
    const [flag, viewer] = executeScript.mock.calls.map(([details]) => details);
    expect(flag).toMatchObject({ target: { tabId: 7, frameIds: [3] }, args: [FORCE_VIEWER_FLAG] });
    // In the browser the function runs in the page's isolated world; run it here to see what it sets.
    const scope = globalThis as unknown as Record<string, unknown>;
    (flag.func as (name: string) => void)(FORCE_VIEWER_FLAG);
    expect(scope[FORCE_VIEWER_FLAG]).toBe(true);
    delete scope[FORCE_VIEWER_FLAG];
    expect(viewer).toEqual({ target: { tabId: 7, frameIds: [3] }, files: [VIEWER_SCRIPT] });
  });

  it('skips excluded sites', async () => {
    await fakeBrowser.storage.sync.set({ settings: { excludedHosts: ['*.example.com'] } });
    await onJsonDetected(target, 'https://api.example.com/v1/items');
    expect(executeScript).not.toHaveBeenCalled();
    await onJsonDetected(target, 'https://example.org/items');
    expect(executeScript).toHaveBeenCalledTimes(1);
  });

  it('injects when the frame URL is unknown or not a URL', async () => {
    await fakeBrowser.storage.sync.set({ settings: { excludedHosts: ['*'] } });
    await onJsonDetected(target, undefined);
    await onJsonDetected(target, 'not a url');
    expect(executeScript).toHaveBeenCalledTimes(2);
  });
});
