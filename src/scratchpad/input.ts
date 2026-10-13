import { storage } from '#imports';

/** The scratchpad URL parameter naming the text handed to it. */
export const INPUT_PARAM = 'input';

// Session storage: the text never reaches disk or sync, and only extension pages and the background can read it.
const inputKey = (id: string) => `session:scratchpadInput:${id}` as const;

/**
 * Keeps text for one scratchpad ("View selection as JSON") and returns the id to open it with. Each hand-off has
 * its own id, so two quick ones can't swap texts between tabs.
 */
export async function handOffScratchpadInput(text: string): Promise<string> {
  const id = crypto.randomUUID();
  await storage.setItem(inputKey(id), text);
  return id;
}

/** Reads and clears the text handed to this scratchpad, so a reload starts empty. */
export async function takeScratchpadInput(id: string | null): Promise<string> {
  if (id === null || id === '') return '';
  const text = await storage.getItem<string>(inputKey(id));
  if (text === null) return '';
  await storage.removeItem(inputKey(id));
  return text;
}
