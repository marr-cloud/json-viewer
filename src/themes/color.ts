export interface Rgba {
  r: number;
  g: number;
  b: number;
  /** 0..1 */
  a: number;
}

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function parseHex(hex: string): Rgba {
  const match = HEX.exec(hex.trim());
  if (!match) throw new Error(`Invalid hex color: ${hex}`);
  let digits = match[1] ?? '';
  if (digits.length <= 4) digits = [...digits].map((d) => d + d).join('');
  const channel = (i: number) => parseInt(digits.slice(i, i + 2), 16);
  return { r: channel(0), g: channel(2), b: channel(4), a: digits.length === 8 ? channel(6) / 255 : 1 };
}

export function toHex({ r, g, b, a }: Rgba): string {
  const hex = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}${a < 1 ? hex(a * 255) : ''}`;
}

export function withAlpha(hex: string, alpha: number): string {
  return toHex({ ...parseHex(hex), a: alpha });
}

/** Linear RGB mix of `hex` toward `target`; keeps the alpha of `hex`. */
export function mix(hex: string, target: string, amount: number): string {
  const from = parseHex(hex);
  const to = parseHex(target);
  const lerp = (x: number, y: number) => x + (y - x) * amount;
  return toHex({ r: lerp(from.r, to.r), g: lerp(from.g, to.g), b: lerp(from.b, to.b), a: from.a });
}
