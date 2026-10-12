/** Monospaced Google Fonts families offered as suggestions (all verified on fonts.googleapis.com, 2026-10-12). */
export const FONT_CATALOG: readonly string[] = [
  'JetBrains Mono',
  'Fira Code',
  'Source Code Pro',
  'IBM Plex Mono',
  'Roboto Mono',
  'Ubuntu Mono',
  'Inconsolata',
  'Space Mono',
  'Red Hat Mono',
  'DM Mono',
  'Geist Mono',
  'Martian Mono',
  'Victor Mono',
  'Cascadia Code',
  'Noto Sans Mono',
  'Azeret Mono',
  'Sometype Mono',
  'Fragment Mono',
  'Spline Sans Mono',
  'Reddit Mono',
];

/** Google Fonts family names are case-sensitive; maps a typed name onto a known spelling when one matches. */
export function canonicalFamily(input: string, known: readonly string[]): string {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  return known.find((name) => name.toLowerCase() === lower) ?? trimmed;
}
