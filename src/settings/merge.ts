import { isRecord } from '@/shared/guards';

/**
 * Returns `next` plus every key of `stored` that `next` lacks, recursively for nested objects.
 * Settings written by a newer version keep their extra fields when an older version saves.
 */
export function mergeUnknown<T extends object>(stored: unknown, next: T): T {
  if (!isRecord(stored)) return next;
  const fresh = next as unknown as Record<string, unknown>;
  const result: Record<string, unknown> = { ...fresh };
  for (const [key, value] of Object.entries(stored)) {
    const known = fresh[key];
    if (!(key in fresh)) result[key] = value;
    else if (isRecord(value) && isRecord(known)) result[key] = mergeUnknown(value, known);
  }
  return result as T;
}
