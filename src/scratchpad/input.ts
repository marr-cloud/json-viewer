import { storage } from '#imports';

/**
 * Text handed to the next scratchpad that opens ("View selection as JSON"). Session storage: it never reaches
 * disk or sync, and only extension pages and the background can read it.
 */
export const scratchpadInputItem = storage.defineItem<string>('session:scratchpadInput', { fallback: '' });

/** Reads and clears the handed-over text, so a reload or a second scratchpad starts empty. */
export async function takeScratchpadInput(): Promise<string> {
  const text = await scratchpadInputItem.getValue();
  if (text !== '') await scratchpadInputItem.removeValue();
  return text;
}
