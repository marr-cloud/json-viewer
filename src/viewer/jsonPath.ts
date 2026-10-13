import { JSONPath } from 'jsonpath-plus';
import { t } from '@/i18n';
import { formatJson, type FormatOptions } from '@/parse/format';

export type FilterResult =
  | { ok: true; text: string; value: unknown[]; count: number }
  | { ok: false; message: string };

/** Runs a JSONPath query and formats the array of matches like the document. Never throws. */
export function filterDocument(value: unknown, path: string, format: FormatOptions): FilterResult {
  let matches: unknown;
  try {
    // 'safe' interprets filter expressions itself: no eval or Function, so it is CSP-safe.
    matches = JSONPath({ path, json: value as Parameters<typeof JSONPath>[0]['json'], eval: 'safe', wrap: true });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
  const list = Array.isArray(matches) ? (matches as unknown[]) : [];
  try {
    return { ok: true, text: formatJson(list, format), value: list, count: list.length };
  } catch (e) {
    return { ok: false, message: e instanceof RangeError ? t('viewer.filter.tooDeep') : String(e) };
  }
}
