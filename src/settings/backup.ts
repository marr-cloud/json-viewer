import { isRecord } from '@/shared/guards';
import { getBuiltinTheme } from '@/themes/builtin';
import type { Theme } from '@/themes/types';
import { parseCompactTheme } from '@/themes/validate';
import { validateSettings, type Settings } from './schema';

export const BACKUP_FORMAT = 'json-viewer-settings';
export const BACKUP_VERSION = 1;
/** Settings, CSS and a few dozen themes are well under this; anything bigger is not a backup. */
export const MAX_BACKUP_BYTES = 1_000_000;

/** The exported file. Downloaded fonts are left out (spec 6.8): the settings keep the family name only. */
export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  settings: Settings;
  customCss: string;
  customThemes: Theme[];
}

export interface ImportedBackup {
  settings: Settings;
  customCss: string;
  customThemes: Theme[];
  /** Themes left out: invalid, a built-in id, or an id seen earlier in the file. */
  skippedThemes: number;
}

export type BackupError = 'too-large' | 'not-json' | 'not-a-backup' | 'newer-version';

export type BackupParse = { ok: true; backup: ImportedBackup } | { ok: false; error: BackupError };

export function createBackup(input: {
  settings: Settings;
  customCss: string;
  customThemes: Theme[];
  now: Date;
}): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: input.now.toISOString(),
    settings: input.settings,
    customCss: input.customCss,
    customThemes: input.customThemes,
  };
}

/** `json-viewer-settings-YYYY-MM-DD.json`, in local time. */
export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `json-viewer-settings-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

function readThemes(input: unknown): { themes: Theme[]; skipped: number } {
  const themes: Theme[] = [];
  let skipped = 0;
  for (const item of Array.isArray(input) ? input : []) {
    const result = parseCompactTheme(item);
    if (!result.ok || getBuiltinTheme(result.theme.id) || themes.some((t) => t.id === result.theme.id)) skipped++;
    else themes.push(result.theme);
  }
  return { themes, skipped };
}

/** Reads an exported file. Settings are validated like stored ones: bad fields fall back to their defaults. */
export function parseBackup(text: string): BackupParse {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: 'too-large' };
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not-json' };
  }
  if (!isRecord(input) || input.format !== BACKUP_FORMAT || !Number.isInteger(input.version)) {
    return { ok: false, error: 'not-a-backup' };
  }
  if ((input.version as number) > BACKUP_VERSION) return { ok: false, error: 'newer-version' };
  const { themes, skipped } = readThemes(input.customThemes);
  return {
    ok: true,
    backup: {
      settings: validateSettings(input.settings),
      customCss: typeof input.customCss === 'string' ? input.customCss : '',
      customThemes: themes,
      skippedThemes: skipped,
    },
  };
}
