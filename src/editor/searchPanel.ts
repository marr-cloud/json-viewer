import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  SearchQuery,
  selectMatches,
  setSearchQuery,
} from '@codemirror/search';
import type { EditorState } from '@codemirror/state';
import { runScopeHandlers, type EditorView, type Panel, type ViewUpdate } from '@codemirror/view';
import { n, onLocaleChange, t, tc, type MessageKey } from '@/i18n';

/** Counting stops here; the panel then shows "1000+". */
export const MAX_COUNTED_MATCHES = 1000;
/** Bigger documents get no count: a search with few matches would scan all of it on every key press. */
export const COUNT_DOC_LIMIT = 4_000_000;

export interface MatchCount {
  /** 1-based position of the selected match, or 0 when the selection is not on a match. */
  current: number;
  total: number;
  /** More matches than MAX_COUNTED_MATCHES. */
  more: boolean;
}

/** How many matches the query has and which one is selected; null when there is nothing to count. */
export function countMatches(state: EditorState, query: SearchQuery): MatchCount | null {
  if (!query.valid || state.doc.length > COUNT_DOC_LIMIT) return null;
  const { from, to } = state.selection.main;
  const cursor = query.getCursor(state);
  let total = 0;
  let current = 0;
  for (let match = cursor.next(); !match.done; match = cursor.next()) {
    if (total === MAX_COUNTED_MATCHES) return { current, total, more: true };
    total++;
    if (match.value.from === from && match.value.to === to) current = total;
  }
  return { current, total, more: false };
}

/** "2 of 12", "12 matches", "No results"; empty when there is no count. */
export function describeCount(count: MatchCount | null): string {
  if (count === null) return '';
  if (count.total === 0) return t('search.none');
  const total = count.more ? `${n(count.total)}+` : n(count.total);
  if (count.current > 0) return t('search.position', { current: count.current, total });
  return count.more ? t('search.manyMatches', { total }) : tc('viewer.status.matches', count.total);
}

type ToggleKey = 'caseSensitive' | 'regexp' | 'wholeWord';

/** Gives an element its label (title and aria-label) in the current language. */
function label(element: HTMLElement, key: MessageKey): void {
  element.title = t(key);
  element.setAttribute('aria-label', t(key));
}

function button(key: MessageKey, text: string, onClick: () => void, className = 'cm-jv-search-button'): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = text;
  element.dataset.label = key;
  label(element, key);
  // Keep focus in the input, as VS Code does.
  element.addEventListener('mousedown', (event) => event.preventDefault());
  element.addEventListener('click', onClick);
  return element;
}

/** A compact, VS Code-like search panel: toggles inside the field, a match count and icon buttons. */
export function createSearchPanel(view: EditorView): Panel {
  let query = getSearchQuery(view.state);

  const dom = document.createElement('div');
  dom.className = 'cm-search cm-jv-search';

  const field = document.createElement('div');
  field.className = 'cm-jv-search-field';
  const input = document.createElement('input');
  input.className = 'cm-jv-search-input';

  // openSearchPanel focuses and selects the element with this attribute.
  input.setAttribute('main-field', 'true');
  input.spellcheck = false;

  const toggles: Record<ToggleKey, HTMLButtonElement> = {
    caseSensitive: button('search.matchCase', 'Aa', () => toggle('caseSensitive'), 'cm-jv-search-toggle'),
    wholeWord: button('search.wholeWord', 'ab', () => toggle('wholeWord'), 'cm-jv-search-toggle'),
    regexp: button('search.regexp', '.*', () => toggle('regexp'), 'cm-jv-search-toggle'),
  };
  toggles.wholeWord.classList.add('cm-jv-search-word');
  field.append(input, toggles.caseSensitive, toggles.wholeWord, toggles.regexp);

  const count = document.createElement('span');
  count.className = 'cm-jv-search-count';
  count.setAttribute('aria-live', 'polite');

  dom.append(
    field,
    count,
    button('search.previous', '↑', () => findPrevious(view)),
    button('search.next', '↓', () => findNext(view)),
    button('search.selectAll', '≡', () => selectMatches(view)),
    button('search.close', '×', () => close()),
  );

  /** Puts the labels in the current language; runs again when the language changes. */
  function relabel(): void {
    input.placeholder = t('search.find');
    input.setAttribute('aria-label', t('search.find'));
    for (const element of dom.querySelectorAll<HTMLElement>('[data-label]')) {
      label(element, element.dataset.label as MessageKey);
    }
  }
  relabel();
  const stopRelabel = onLocaleChange(() => {
    relabel();
    refreshCount(view.state);
  });

  function show(): void {
    if (input.value !== query.search) input.value = query.search;
    for (const key of Object.keys(toggles) as ToggleKey[]) {
      toggles[key].setAttribute('aria-pressed', String(query[key]));
    }
    input.setAttribute('aria-invalid', String(query.search !== '' && !query.valid));
    refreshCount(view.state);
  }

  function refreshCount(state: EditorState): void {
    const result = countMatches(state, query);
    count.textContent = describeCount(result);
    count.classList.toggle('cm-jv-search-none', result?.total === 0);
  }

  function commit(next: SearchQuery): void {
    if (next.eq(query)) return;
    query = next;
    view.dispatch({ effects: setSearchQuery.of(next) });
    show();
  }

  function withChanges(changes: Partial<Record<ToggleKey, boolean> & { search: string }>): SearchQuery {
    return new SearchQuery({
      search: query.search,
      caseSensitive: query.caseSensitive,
      regexp: query.regexp,
      wholeWord: query.wholeWord,
      literal: query.literal,
      replace: query.replace,
      ...changes,
    });
  }

  function toggle(key: ToggleKey): void {
    const changes: Partial<Record<ToggleKey, boolean>> = { [key]: !query[key] };
    commit(withChanges(changes));
  }

  function close(): void {
    closeSearchPanel(view);
    view.focus();
  }

  input.addEventListener('input', () => commit(withChanges({ search: input.value })));
  input.addEventListener('keydown', (event) => {
    // F3, Mod-g and the other search-panel bindings.
    if (runScopeHandlers(view, event, 'search-panel')) {
      event.preventDefault();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.altKey) selectMatches(view);
      else if (event.shiftKey) findPrevious(view);
      else findNext(view);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  });

  show();

  return {
    dom,
    top: true,
    mount() {
      // openSearchPanel only focuses the field of a panel that is already open.
      input.focus();
      input.select();
    },
    destroy() {
      stopRelabel();
    },
    update(update: ViewUpdate) {
      let changed = false;
      for (const tr of update.transactions) {
        for (const effect of tr.effects) {
          if (effect.is(setSearchQuery) && !effect.value.eq(query)) {
            query = effect.value;
            changed = true;
          }
        }
      }
      if (changed) show();
      else if (update.docChanged || update.selectionSet || update.transactions.some((tr) => tr.effects.length > 0)) {
        refreshCount(update.state);
      }
    },
  };
}
