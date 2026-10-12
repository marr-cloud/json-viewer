export interface FormatOptions {
  indent: number;
  sortKeys: boolean;
  cStyle: boolean;
}

/**
 * Pretty-prints a parsed JSON value. Values created with JSON.rawJSON
 * (big numbers) are emitted verbatim. Throws RangeError on extreme nesting.
 */
export function formatJson(value: unknown, options: FormatOptions): string {
  if (!options.sortKeys && !options.cStyle) {
    return JSON.stringify(value, null, options.indent);
  }

  const unit = ' '.repeat(options.indent);
  const out: string[] = [];

  const write = (node: unknown, pad: string): void => {
    const inner = pad + unit;
    if (Array.isArray(node)) {
      if (node.length === 0) {
        out.push('[]');
        return;
      }
      out.push('[\n');
      node.forEach((item, i) => {
        out.push(inner);
        write(item, inner);
        out.push(i < node.length - 1 ? ',\n' : '\n');
      });
      out.push(`${pad}]`);
      return;
    }
    if (isObject(node)) {
      const keys = Object.keys(node);
      if (options.sortKeys) keys.sort();
      if (keys.length === 0) {
        out.push('{}');
        return;
      }
      out.push('{\n');
      keys.forEach((key, i) => {
        const child = node[key];
        out.push(`${inner}${JSON.stringify(key)}:`);
        out.push(options.cStyle && isNonEmptyContainer(child) ? `\n${inner}` : ' ');
        write(child, inner);
        out.push(i < keys.length - 1 ? ',\n' : '\n');
      });
      out.push(`${pad}}`);
      return;
    }
    out.push(JSON.stringify(node));
  };

  write(value, '');
  return out.join('');
}

function isObject(node: unknown): node is Record<string, unknown> {
  return typeof node === 'object' && node !== null && !JSON.isRawJSON(node);
}

function isNonEmptyContainer(node: unknown): boolean {
  if (Array.isArray(node)) return node.length > 0;
  return isObject(node) && Object.keys(node).length > 0;
}
