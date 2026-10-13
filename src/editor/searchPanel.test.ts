// @vitest-environment happy-dom
import { getSearchQuery, openSearchPanel, search, SearchQuery, searchPanelOpen, setSearchQuery } from '@codemirror/search';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '@/i18n';
import { COUNT_DOC_LIMIT, countMatches, createSearchPanel, describeCount, MAX_COUNTED_MATCHES } from './searchPanel';

const DOC = '{"a": "x", "b": "X", "c": "xx"}';

describe('countMatches', () => {
  const state = EditorState.create({ doc: DOC });

  it('counts the matches and finds the one that is selected', () => {
    expect(countMatches(state, new SearchQuery({ search: 'x' }))).toEqual({ current: 0, total: 4, more: false });
    const at = DOC.indexOf('X');
    const second = state.update({ selection: { anchor: at, head: at + 1 } }).state;
    expect(countMatches(second, new SearchQuery({ search: 'x' }))).toEqual({ current: 2, total: 4, more: false });
    expect(countMatches(state, new SearchQuery({ search: 'x', caseSensitive: true }))?.total).toBe(3);
  });

  it('stops at the limit', () => {
    const many = EditorState.create({ doc: 'x'.repeat(MAX_COUNTED_MATCHES + 5) });
    expect(countMatches(many, new SearchQuery({ search: 'x' }))).toEqual({
      current: 0,
      total: MAX_COUNTED_MATCHES,
      more: true,
    });
  });

  it('counts nothing for empty or invalid queries and for huge documents', () => {
    expect(countMatches(state, new SearchQuery({ search: '' }))).toBeNull();
    expect(countMatches(state, new SearchQuery({ search: '(', regexp: true }))).toBeNull();
    const huge = EditorState.create({ doc: 'x'.repeat(COUNT_DOC_LIMIT + 1) });
    expect(countMatches(huge, new SearchQuery({ search: 'x' }))).toBeNull();
  });
});

describe('describeCount', () => {
  it('reads like VS Code', () => {
    expect(describeCount(null)).toBe('');
    expect(describeCount({ current: 0, total: 0, more: false })).toBe('No results');
    expect(describeCount({ current: 0, total: 1, more: false })).toBe('1 match');
    expect(describeCount({ current: 0, total: 3, more: false })).toBe('3 matches');
    expect(describeCount({ current: 2, total: 3, more: false })).toBe('2 of 3');
    expect(describeCount({ current: 0, total: 1000, more: true })).toBe('1000+ matches');
    expect(describeCount({ current: 7, total: 1000, more: true })).toBe('7 of 1000+');
  });

  it('speaks the page language', () => {
    setLocale('es');
    try {
      expect(describeCount({ current: 0, total: 0, more: false })).toBe('Sin resultados');
      expect(describeCount({ current: 0, total: 1, more: false })).toBe('1 resultado');
      expect(describeCount({ current: 2, total: 3, more: false })).toBe('2 de 3');
      expect(describeCount({ current: 0, total: 1000, more: true })).toBe('1000+ resultados');
    } finally {
      setLocale('en');
    }
  });
});

describe('createSearchPanel', () => {
  let view: EditorView | undefined;
  afterEach(() => {
    view?.destroy();
    view = undefined;
  });

  const mount = (doc = DOC) => {
    view = new EditorView({
      state: EditorState.create({
        doc,
        extensions: [EditorState.allowMultipleSelections.of(true), search({ top: true, createPanel: createSearchPanel })],
      }),
      parent: document.body,
    });
    openSearchPanel(view);
    const panel = view.dom.querySelector<HTMLElement>('.cm-search')!;
    const input = panel.querySelector<HTMLInputElement>('[main-field]')!;
    const count = panel.querySelector<HTMLElement>('.cm-jv-search-count')!;
    const button = (label: string) => panel.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
    const type = (text: string) => {
      input.value = text;
      input.dispatchEvent(new Event('input'));
    };
    const press = (key: string, init: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
      input.dispatchEvent(event);
      return event;
    };
    return { view, panel, input, count, button, type, press };
  };

  it('relabels itself and its count when the page language changes', () => {
    const { input, count, button, type } = mount();
    type('zzz');
    expect(count.textContent).toBe('No results');
    setLocale('es');
    try {
      expect(input.placeholder).toBe('Buscar');
      expect(button('Cerrar')).not.toBeNull();
      expect(count.textContent).toBe('Sin resultados');
    } finally {
      setLocale('en');
    }
  });

  it('replaces the default panel, keeps its class and focuses the field', () => {
    const { panel, input } = mount();
    expect(panel.classList.contains('cm-jv-search')).toBe(true);
    expect(input.getAttribute('aria-label')).toBe('Find');
    expect(document.activeElement).toBe(input);
  });

  it('updates the query as you type and shows the match count', () => {
    const { view, count, type } = mount();
    type('x');
    expect(getSearchQuery(view.state).search).toBe('x');
    expect(count.textContent).toBe('4 matches');
    type('zzz');
    expect(count.textContent).toBe('No results');
    expect(count.classList.contains('cm-jv-search-none')).toBe(true);
  });

  it('switches match case, regexp and whole word', () => {
    const { view, button, type, count } = mount();
    type('x');
    const caseButton = button('Match case');
    caseButton.click();
    expect(caseButton.getAttribute('aria-pressed')).toBe('true');
    expect(getSearchQuery(view.state).caseSensitive).toBe(true);
    expect(count.textContent).toBe('3 matches');
    button('Match whole word').click();
    expect(getSearchQuery(view.state).wholeWord).toBe(true);
    expect(count.textContent).toBe('1 match');
    button('Use regular expression').click();
    expect(getSearchQuery(view.state).regexp).toBe(true);
  });

  it('marks an invalid regular expression', () => {
    const { input, button, type, count } = mount();
    button('Use regular expression').click();
    type('(');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(count.textContent).toBe('');
    type('x+');
    expect(input.getAttribute('aria-invalid')).toBe('false');
  });

  it('goes to the next and previous match with Enter and Shift+Enter', () => {
    const { view, count, type, press, button } = mount();
    type('x');
    expect(press('Enter').defaultPrevented).toBe(true);
    expect(view.state.selection.main.from).toBe(DOC.indexOf('x'));
    expect(count.textContent).toBe('1 of 4');
    button('Next match').click();
    expect(count.textContent).toBe('2 of 4');
    press('Enter', { shiftKey: true });
    expect(count.textContent).toBe('1 of 4');
    button('Previous match').click();
    expect(count.textContent).toBe('4 of 4');
  });

  it('selects every match', () => {
    const { view, type, button } = mount();
    type('x');
    button('Select all matches').click();
    expect(view.state.selection.ranges).toHaveLength(4);
  });

  it('closes with Escape or the close button and consumes the key', () => {
    const first = mount();
    first.type('x');
    expect(first.press('Escape').defaultPrevented).toBe(true);
    expect(searchPanelOpen(first.view.state)).toBe(false);
    first.view.destroy();
    const second = mount();
    second.button('Close').click();
    expect(searchPanelOpen(second.view.state)).toBe(false);
  });

  it('follows a query set from elsewhere', () => {
    const { view, input, button, count } = mount();
    view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: 'X', caseSensitive: true })) });
    expect(input.value).toBe('X');
    expect(button('Match case').getAttribute('aria-pressed')).toBe('true');
    expect(count.textContent).toBe('1 match');
  });

  it('shows no count on documents too big to count', () => {
    const { count, type } = mount('x'.repeat(COUNT_DOC_LIMIT + 1));
    type('x');
    expect(count.textContent).toBe('');
  });
});
