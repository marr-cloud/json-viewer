import { scratchpadInputItem } from '@/scratchpad/input';

export const SCRATCHPAD_PAGE = '/scratchpad.html';

/** Opens a scratchpad tab, optionally with text to show (`index` places the tab, e.g. next to the current one). */
export async function openScratchpad(text = '', index?: number): Promise<void> {
  if (text !== '') await scratchpadInputItem.setValue(text);
  await browser.tabs.create({ url: browser.runtime.getURL(SCRATCHPAD_PAGE), index });
}
