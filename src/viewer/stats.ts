const KB = 1024;
const MB = KB * 1024;

/** UTF-8 bytes, counted without encoding the text (documents can be tens of MB). */
export function byteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
      bytes += 4;
      i++;
    } else {
      // Other BMP characters, and lone surrogates (encoded as U+FFFD).
      bytes += 3;
    }
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

export function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? singular : plural}`;
}

/** Light mode: the document is bigger than the threshold (in MiB, like the status bar). */
export function isLightMode(bytes: number, thresholdMB: number): boolean {
  return bytes > thresholdMB * MB;
}
