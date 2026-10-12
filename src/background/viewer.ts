import { isExcludedHost } from '@/settings/hosts';
import { loadSettings } from '@/settings/storage';

export const VIEWER_SCRIPT = '/content-scripts/viewer.js';

export interface FrameTarget {
  tabId: number;
  frameId: number;
}

/** Runs the viewer content script in one frame. */
export async function injectViewer({ tabId, frameId }: FrameTarget): Promise<void> {
  await browser.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files: [VIEWER_SCRIPT] });
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
