export const JSON_DETECTED = 'json-detected';

export interface JsonDetectedMessage {
  type: typeof JSON_DETECTED;
}

export function isJsonDetectedMessage(value: unknown): value is JsonDetectedMessage {
  return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === JSON_DETECTED;
}

export const OPEN_OPTIONS = 'open-options';

export interface OpenOptionsMessage {
  type: typeof OPEN_OPTIONS;
}

export function isOpenOptionsMessage(value: unknown): value is OpenOptionsMessage {
  return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === OPEN_OPTIONS;
}

/**
 * Set by the background on the content scripts' isolated world before injecting the viewer for "View as JSON":
 * the viewer then opens even though the page wasn't detected as JSON.
 */
export const FORCE_VIEWER_FLAG = '__jsonViewerForced';
