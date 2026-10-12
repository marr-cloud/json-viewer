const KB = 1024;
const MB = KB * 1024;

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
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
