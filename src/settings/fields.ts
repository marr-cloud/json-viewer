import { isRecord, nonEmptyString } from '@/shared/guards';

/** Reads one field: returns the value when it is valid, otherwise the fallback. */
export type FieldValidator<T> = (value: unknown, fallback: T) => T;

export type ObjectValidators<T> = { [K in keyof T]-?: FieldValidator<T[K]> };

export const bool: FieldValidator<boolean> = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

export function intInRange(min: number, max: number): FieldValidator<number> {
  return (value, fallback) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}

export function numberInRange(min: number, max: number, decimals: number): FieldValidator<number> {
  return (value, fallback) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.min(max, Math.max(min, Number(value.toFixed(decimals))))
      : fallback;
}

export function oneOf<T extends string | number>(allowed: readonly T[]): FieldValidator<T> {
  return (value, fallback) => (allowed.includes(value as T) ? (value as T) : fallback);
}

export const nonEmptyId: FieldValidator<string> = (value, fallback) => nonEmptyString(value) ?? fallback;

/** Validates every known field; unknown fields are dropped here (storage keeps them, see mergeUnknown). */
export function validateFields<T extends object>(input: unknown, defaults: T, validators: ObjectValidators<T>): T {
  const raw = isRecord(input) ? input : {};
  const result = { ...defaults };
  for (const key of Object.keys(validators) as (keyof T)[]) {
    result[key] = validators[key](raw[key as string], defaults[key]);
  }
  return result;
}
