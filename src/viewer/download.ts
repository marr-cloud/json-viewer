const FALLBACK_NAME = 'data.json';
const MAX_NAME_LENGTH = 100;
// Revoking right away can cancel the download in some browsers.
const REVOKE_DELAY_MS = 10_000;
const UNSAFE_CHARS = /[\\/:*?"<>|\u0000-\u001f]+/g;

/** File name for saving `url`'s JSON: its last path segment, ending in .json. */
export function downloadName(url: string): string {
  let segment: string;
  try {
    const path = new URL(url).pathname;
    segment = decodeURIComponent(path.slice(path.lastIndexOf('/') + 1));
  } catch {
    return FALLBACK_NAME;
  }
  const name = segment
    .replace(UNSAFE_CHARS, '_')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, MAX_NAME_LENGTH);
  if (name === '') return FALLBACK_NAME;
  return /\.json$/i.test(name) ? name : `${name}.json`;
}

/** Saves `text` as a file through a temporary blob link. */
export function downloadText(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
