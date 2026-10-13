const KB = 1024;
const MB = KB * 1024;

const CHUNK = 1 << 20;
let encoder: TextEncoder | undefined;
let buffer: Uint8Array | undefined;

/** UTF-8 bytes, counted in chunks without encoding the whole text at once (documents can be tens of MB). */
export function byteLength(text: string): number {
  encoder ??= new TextEncoder();
  // A UTF-16 unit takes at most 3 bytes, so a chunk always fits.
  buffer ??= new Uint8Array(3 * CHUNK);
  let bytes = 0;
  for (let start = 0; start < text.length; ) {
    let end = Math.min(start + CHUNK, text.length);
    if (end < text.length) {
      // Keep a surrogate pair in one slice.
      const last = text.charCodeAt(end - 1);
      if (last >= 0xd800 && last <= 0xdbff) end--;
    }
    bytes += encoder.encodeInto(text.slice(start, end), buffer).written;
    start = end;
  }
  return bytes;
}

export function formatBytes(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

/** Lines as CodeMirror counts them: \n, \r\n and a lone \r each end one. */
export function countLines(text: string): number {
  let lines = 1;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 10 || (code === 13 && text.charCodeAt(i + 1) !== 10)) lines++;
  }
  return lines;
}

/** Light mode: the document is bigger than the threshold (in MiB, like the status bar). */
export function isLightMode(bytes: number, thresholdMB: number): boolean {
  return bytes > thresholdMB * MB;
}
