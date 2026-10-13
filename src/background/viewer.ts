import { FORCE_VIEWER_FLAG, VIEWER_GUARD } from '@/messages';
import { isExcludedHost } from '@/settings/hosts';
import { loadSettings } from '@/settings/storage';

export const VIEWER_SCRIPT = '/content-scripts/viewer.js';

export interface FrameTarget {
  tabId: number;
  frameId: number;
}

/**
 * Runs the viewer content script in one frame. `force` opens it even on a page that wasn't detected as JSON
 * ("View as JSON"): the flag goes on the content scripts' shared isolated world, where the viewer reads it.
 * A page that already shows the viewer is left alone: a second viewer script would invalidate the first one
 * (WXT's content-script-started event) and leave the page blank.
 */
export async function injectViewer({ tabId, frameId }: FrameTarget, force = false): Promise<void> {
  const target = { tabId, frameIds: [frameId] };
  if (force) {
    const [flagged] = await browser.scripting.executeScript({
      target,
      func: (flag: string, guard: string) => {
        (globalThis as unknown as Record<string, unknown>)[flag] = true;
        return document.documentElement.hasAttribute(guard);
      },
      args: [FORCE_VIEWER_FLAG, VIEWER_GUARD],
    });
    if (flagged?.result === true) return;
  }
  await browser.scripting.executeScript({ target, files: [VIEWER_SCRIPT] });
}

function hostnameOf(url: string | undefined): string | null {
  try {
    return url === undefined ? null : new URL(url).hostname;
  } catch {
    return null;
  }
}

/** A detector found JSON in this frame: open the viewer unless the user excluded the site. */
export async function onJsonDetected(target: FrameTarget, url: string | undefined): Promise<void> {
  const hostname = hostnameOf(url);
  if (hostname !== null && isExcludedHost(hostname, (await loadSettings()).excludedHosts)) return;
  await injectViewer(target);
}
