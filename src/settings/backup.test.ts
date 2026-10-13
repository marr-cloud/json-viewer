import { describe, expect, it } from 'vitest';
import type { Theme } from '@/themes/types';
import { BACKUP_FORMAT, BACKUP_VERSION, backupFileName, createBackup, MAX_BACKUP_BYTES, parseBackup } from './backup';
import { defaultSettings, type Settings } from './schema';

const theme = (id: string): Theme => ({
  id,
  name: `Theme ${id}`,
  type: 'dark',
  source: 'custom',
  colors: { background: '#101010', foreground: '#eeeeee' },
});

const settings: Settings = { ...defaultSettings, darkThemeId: 'mine', excludedHosts: ['api.example.com'] };

describe('createBackup', () => {
  it('holds the settings, the custom CSS and the custom themes, tagged with format and version', () => {
    const backup = createBackup({
      settings,
      customCss: '.x{}',
      customThemes: [theme('mine')],
      now: new Date('2026-10-12T10:00:00Z'),
    });
    expect(backup).toEqual({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: '2026-10-12T10:00:00.000Z',
      settings,
      customCss: '.x{}',
      customThemes: [theme('mine')],
    });
  });
});

describe('backupFileName', () => {
  it('names the file after the local date', () => {
    expect(backupFileName(new Date(2026, 9, 2, 23, 59))).toBe('json-viewer-settings-2026-10-02.json');
  });
});

describe('parseBackup', () => {
  const exported = (overrides: Record<string, unknown> = {}) =>
    JSON.stringify({
      ...createBackup({ settings, customCss: '.x{}', customThemes: [theme('mine')], now: new Date(0) }),
      ...overrides,
    });

  it('reads back what createBackup wrote', () => {
    expect(parseBackup(exported())).toEqual({
      ok: true,
      backup: { settings, customCss: '.x{}', customThemes: [theme('mine')], skippedThemes: 0 },
    });
  });

  it('rejects text that is not JSON', () => {
    expect(parseBackup('{oops')).toEqual({ ok: false, error: 'not-json' });
  });

  it('rejects JSON that is not a JSON Viewer backup', () => {
    expect(parseBackup('{"theme": "x"}')).toEqual({ ok: false, error: 'not-a-backup' });
    expect(parseBackup('[1]')).toEqual({ ok: false, error: 'not-a-backup' });
    expect(parseBackup(exported({ version: 'one' }))).toEqual({ ok: false, error: 'not-a-backup' });
  });

  it('rejects a backup from a newer format version', () => {
    expect(parseBackup(exported({ version: BACKUP_VERSION + 1 }))).toEqual({ ok: false, error: 'newer-version' });
  });

  it('rejects files over the size limit before parsing them', () => {
    expect(parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1))).toEqual({ ok: false, error: 'too-large' });
  });

  it('fills invalid or missing settings with defaults, like stored settings', () => {
    const result = parseBackup(exported({ settings: { themeMode: 'sepia', viewer: { tabSize: 4 } } }));
    expect(result.ok && result.backup.settings).toEqual({
      ...defaultSettings,
      viewer: { ...defaultSettings.viewer, tabSize: 4 },
    });
  });

  it('treats a missing or non-string custom CSS as empty', () => {
    const result = parseBackup(exported({ customCss: 42 }));
    expect(result.ok && result.backup.customCss).toBe('');
  });

  it('skips invalid themes and themes that reuse a built-in id, and counts them', () => {
    const result = parseBackup(
      exported({ customThemes: [theme('mine'), { id: 'Bad Id' }, theme('dracula'), 'x', theme('other')] }),
    );
    expect(result.ok && result.backup.customThemes.map((t) => t.id)).toEqual(['mine', 'other']);
    expect(result.ok && result.backup.skippedThemes).toBe(3);
  });

  it('keeps only the first theme with a given id', () => {
    const result = parseBackup(exported({ customThemes: [theme('mine'), { ...theme('mine'), name: 'Twin' }] }));
    expect(result.ok && result.backup.customThemes).toEqual([theme('mine')]);
    expect(result.ok && result.backup.skippedThemes).toBe(1);
  });

  it('treats a missing theme list as empty', () => {
    const result = parseBackup(exported({ customThemes: undefined }));
    expect(result.ok && result.backup.customThemes).toEqual([]);
  });
});
