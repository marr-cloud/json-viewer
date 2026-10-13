import { handOffScratchpadInput, INPUT_PARAM } from '@/scratchpad/input';

export const SCRATCHPAD_PAGE = '/scratchpad.html';

/** Opens a scratchpad tab, optionally with text to show (`index` places the tab, e.g. next to the current one). */
export async function openScratchpad(text = '', index?: number): Promise<void> {
  const url = new URL(browser.runtime.getURL(SCRATCHPAD_PAGE));
  if (text !== '') url.searchParams.set(INPUT_PARAM, await handOffScratchpadInput(text));
  await browser.tabs.create({ url: url.href, index });
}
