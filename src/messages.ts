export const JSON_DETECTED = 'json-detected';

export interface JsonDetectedMessage {
  type: typeof JSON_DETECTED;
}

export function isJsonDetectedMessage(value: unknown): value is JsonDetectedMessage {
  return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === JSON_DETECTED;
}
