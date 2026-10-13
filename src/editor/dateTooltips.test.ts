// @vitest-environment happy-dom
import { json } from '@codemirror/lang-json';
import { ensureSyntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '@/i18n';
import { dateTooltipAt, describeDate, epochDate, isoDate } from './dateTooltips';

describe('epochDate', () => {
  it('reads seconds and milliseconds between 1990 and 2099', () => {
    expect(epochDate(1728691200)).toEqual({ ms: 1728691200000, source: 'seconds' });
    expect(epochDate(1728691200123)).toEqual({ ms: 1728691200123, source: 'milliseconds' });
    expect(epochDate(631152000)).toEqual({ ms: 631152000000, source: 'seconds' });
  });

  it('ignores numbers outside the range, fractions and unsafe integers', () => {
    for (const value of [631151999, 4102444800, 42, 0, -1728691200, 1728691200.5, 12345678901234567890]) {
      expect(epochDate(value), String(value)).toBeNull();
    }
  });
});

describe('isoDate', () => {
  it('reads dates and date-times', () => {
    expect(isoDate('2024-10-12')).toEqual({ ms: Date.UTC(2024, 9, 12), source: 'date' });
    expect(isoDate('2024-10-12T09:30:00Z')).toEqual({ ms: Date.UTC(2024, 9, 12, 9, 30), source: 'iso' });
    expect(isoDate('2024-10-12T09:30:00+02:00')).toEqual({ ms: Date.UTC(2024, 9, 12, 7, 30), source: 'iso' });
    expect(isoDate('2024-10-12T09:30:00.123456789Z')?.ms).toBe(Date.UTC(2024, 9, 12, 9, 30, 0, 123));
  });

  it('rejects impossible dates and other strings', () => {
    for (const value of ['2024-02-30', '2024-13-01', '2024-10-12T25:00:00Z', '2024-10-12 09:30', '12/10/2024', 'x']) {
      expect(isoDate(value), value).toBeNull();
    }
  });
});

describe('describeDate', () => {
  it('shows local time with its offset, UTC and how a number was read', () => {
    expect(describeDate({ ms: Date.UTC(2024, 9, 12), source: 'seconds' }, 120)).toEqual([
      '2024-10-12 02:00:00 (UTC+02:00)',
      '2024-10-12 00:00:00 UTC',
      'Unix time in seconds',
    ]);
    expect(describeDate({ ms: Date.UTC(2024, 9, 12, 0, 0, 0, 5), source: 'iso' }, -330)).toEqual([
      '2024-10-11 18:30:00.005 (UTC-05:30)',
      '2024-10-12 00:00:00.005 UTC',
    ]);
  });

  it('shows a date without time as a calendar date in any zone', () => {
    const date = { ms: Date.UTC(2024, 9, 12), source: 'date' } as const;
    for (const offset of [-300, 600]) {
      expect(describeDate(date, offset)).toEqual(['2024-10-12 (Saturday)', 'Calendar date, no time zone']);
    }
  });

  it('speaks the page language', () => {
    setLocale('es');
    try {
      expect(describeDate({ ms: Date.UTC(2024, 9, 12), source: 'date' }, 0)).toEqual([
        '2024-10-12 (sábado)',
        'Fecha de calendario, sin zona horaria',
      ]);
      expect(describeDate({ ms: Date.UTC(2024, 9, 12), source: 'milliseconds' }, 0)[2]).toBe(
        'Tiempo Unix en milisegundos',
      );
    } finally {
      setLocale('en');
    }
  });
});

describe('dateTooltipAt', () => {
  let view: EditorView | undefined;
  afterEach(() => {
    view?.destroy();
    view = undefined;
  });

  const DOC = '{\n  "createdAt": 1728691200,\n  "at": "2024-10-12T00:00:00Z",\n  "2024-10-12": 42\n}';
  const mount = () => {
    const state = EditorState.create({ doc: DOC, extensions: [json()] });
    ensureSyntaxTree(state, DOC.length, 5000);
    view = new EditorView({ state: state.update({}).state, parent: document.body });
    return view;
  };
  const textAt = (v: EditorView, needle: string) => {
    const tooltip = dateTooltipAt(v, DOC.indexOf(needle) + 2, 1);
    return tooltip ? tooltip.create(v).dom.textContent : null;
  };

  it('describes Unix times and ISO strings', () => {
    const v = mount();
    expect(textAt(v, '1728691200')).toContain('2024-10-12 00:00:00 UTC');
    expect(textAt(v, '1728691200')).toContain('Unix time in seconds');
    expect(textAt(v, '"2024-10-12T00')).toContain('2024-10-12 00:00:00 UTC');
  });

  it('ignores keys and other values', () => {
    const v = mount();
    expect(textAt(v, '"2024-10-12":')).toBeNull();
    expect(textAt(v, '42')).toBeNull();
  });

  it('covers the whole token', () => {
    const v = mount();
    const tooltip = dateTooltipAt(v, DOC.indexOf('1728691200') + 3, 1)!;
    expect(DOC.slice(tooltip.pos, tooltip.end)).toBe('1728691200');
  });
});
