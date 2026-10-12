import type { Extension } from '@codemirror/state';
import { hoverTooltip, type EditorView, type Tooltip } from '@codemirror/view';
import { valueTokenAt } from './jsonToken';

const MIN_MS = Date.UTC(1990, 0, 1);
const MAX_MS = Date.UTC(2100, 0, 1);

export interface DetectedDate {
  ms: number;
  /** How the value was read; shown in the tooltip. */
  source: 'seconds' | 'milliseconds' | 'iso';
}

/** An integer read as Unix time in seconds or milliseconds, when it lands in 1990–2099. */
export function epochDate(value: number): DetectedDate | null {
  if (!Number.isSafeInteger(value)) return null;
  if (value * 1000 >= MIN_MS && value * 1000 < MAX_MS) return { ms: value * 1000, source: 'seconds' };
  if (value >= MIN_MS && value < MAX_MS) return { ms: value, source: 'milliseconds' };
  return null;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

/** An ISO 8601 date or date-time string (e.g. "2024-10-12", "2024-10-12T09:30:00Z"). */
export function isoDate(value: string): DetectedDate | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // Date.parse rolls "2024-02-30" over to March 1st; reject days the month doesn't have.
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : { ms, source: 'iso' };
}

/** "2024-10-12 09:30:00" (milliseconds only when present) for a time already shifted to the wanted zone. */
function formatClock(ms: number): string {
  const iso = new Date(ms).toISOString();
  const clock = iso.slice(0, 19).replace('T', ' ');
  return iso.slice(20, 23) === '000' ? clock : `${clock}.${iso.slice(20, 23)}`;
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

const SOURCE_LABELS: Record<DetectedDate['source'], string | null> = {
  seconds: 'Unix time in seconds',
  milliseconds: 'Unix time in milliseconds',
  iso: null,
};

/**
 * The tooltip lines for a date: local time (with its UTC offset), UTC, and how a number was read.
 * `offsetMinutes` is the local offset east of UTC (Europe/Madrid in summer: 120).
 */
export function describeDate(date: DetectedDate, offsetMinutes: number): string[] {
  const lines = [
    `${formatClock(date.ms + offsetMinutes * 60_000)} (${formatOffset(offsetMinutes)})`,
    `${formatClock(date.ms)} UTC`,
  ];
  const label = SOURCE_LABELS[date.source];
  return label === null ? lines : [...lines, label];
}

/** The date tooltip for the value at `pos`, if it is one. */
export function dateTooltipAt(view: EditorView, pos: number, side: -1 | 1): Tooltip | null {
  const token = valueTokenAt(view.state, pos, side);
  if (token === null) return null;
  const date = token.kind === 'number' ? epochDate(Number(token.value)) : isoDate(token.value);
  if (date === null) return null;
  const lines = describeDate(date, -new Date(date.ms).getTimezoneOffset());
  return {
    pos: token.from,
    end: token.to,
    above: true,
    create() {
      const dom = document.createElement('div');
      dom.className = 'cm-jv-date';
      for (const line of lines) {
        const row = document.createElement('div');
        row.textContent = line;
        dom.append(row);
      }
      return { dom };
    },
  };
}

/** Hovering a Unix time (1990–2099) or an ISO 8601 string shows it in local time and UTC. */
export function dateTooltips(): Extension {
  return hoverTooltip(dateTooltipAt);
}
