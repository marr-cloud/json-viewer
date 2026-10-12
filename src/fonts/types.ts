import { isRecord } from '@/shared/guards';

export interface StoredFontFace {
  /** A single weight ("400") or a range for variable fonts ("300 700"). */
  weight: string;
  /** Empty when the face covers every character. */
  unicodeRange: string;
  subset: string;
  dataBase64: string;
}

export interface StoredFont {
  family: string;
  faces: StoredFontFace[];
  /** Downloaded file bytes (before base64). */
  bytes: number;
  subsets: string[];
  downloadedAt: string;
}

export type FontSummary = Omit<StoredFont, 'faces'>;

const isString = (value: unknown): value is string => typeof value === 'string';

function isStoredFace(value: unknown): value is StoredFontFace {
  return (
    isRecord(value) &&
    isString(value.weight) &&
    isString(value.unicodeRange) &&
    isString(value.subset) &&
    isString(value.dataBase64)
  );
}

export function isStoredFont(value: unknown): value is StoredFont {
  return (
    isRecord(value) &&
    isString(value.family) &&
    Array.isArray(value.faces) &&
    value.faces.every(isStoredFace) &&
    typeof value.bytes === 'number' &&
    Array.isArray(value.subsets) &&
    value.subsets.every(isString) &&
    isString(value.downloadedAt)
  );
}
