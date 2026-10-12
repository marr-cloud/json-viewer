export interface TokenColorRule {
  scope?: unknown;
  settings?: { foreground?: unknown };
}

type Score = readonly [depth: number, segments: number, parts: number];

const matchesScope = (selector: string, scope: string): boolean =>
  scope === selector || scope.startsWith(`${selector}.`);

function selectorsOf(scope: unknown): string[] {
  if (typeof scope === 'string') return scope.split(',');
  if (Array.isArray(scope)) return scope.filter((s): s is string => typeof s === 'string');
  return [];
}

/**
 * Scores a TextMate selector ("a b c"; exclusions unsupported) against a scope
 * stack ordered outermost → innermost. Higher is more specific; null = no match.
 */
export function scoreSelector(selector: string, stack: readonly string[]): Score | null {
  const parts = selector.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part.startsWith('-'))) return null;
  const last = parts[parts.length - 1]!;
  let depth = -1;
  for (let i = stack.length - 1; i >= 0; i--) {
    if (matchesScope(last, stack[i]!)) {
      depth = i;
      break;
    }
  }
  if (depth < 0) return null;
  let j = depth - 1;
  for (let k = parts.length - 2; k >= 0; k--) {
    while (j >= 0 && !matchesScope(parts[k]!, stack[j]!)) j--;
    if (j < 0) return null;
    j--;
  }
  return [depth, last.split('.').length, parts.length];
}

const compare = (a: Score, b: Score): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** Foreground of the most specific matching rule; later rules win ties, as in VS Code. */
export function resolveScopeColor(rules: readonly TokenColorRule[], stack: readonly string[]): string | null {
  let best: Score | null = null;
  let color: string | null = null;
  for (const rule of rules) {
    const foreground = rule.settings?.foreground;
    if (typeof foreground !== 'string') continue;
    for (const selector of selectorsOf(rule.scope)) {
      const score = scoreSelector(selector, stack);
      if (score && (best === null || compare(score, best) >= 0)) {
        best = score;
        color = foreground;
      }
    }
  }
  return color;
}
