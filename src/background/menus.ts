import type { Browser } from 'wxt/browser';
import { translate, type Locale, type MessageKey } from '@/i18n/translate';
import { backgroundLocale } from './locale';
import { openScratchpad } from './scratchpad';
import { injectViewer, NotHtmlPageError, type FrameTarget } from './viewer';

export const MENU_VIEW_PAGE = 'view-page-as-json';
export const MENU_VIEW_SELECTION = 'view-selection-as-json';

const MENU_TITLES: [id: string, key: MessageKey][] = [
  [MENU_VIEW_PAGE, 'menu.viewPage'],
  [MENU_VIEW_SELECTION, 'menu.viewSelection'],
];

/** Menus survive service worker restarts but not updates, so they are rebuilt on install and update. */
export async function createMenus(locale: Locale): Promise<void> {
  await browser.contextMenus.removeAll();
  browser.contextMenus.create({ id: MENU_VIEW_PAGE, title: translate(locale, 'menu.viewPage'), contexts: ['page'] });
  browser.contextMenus.create({
    id: MENU_VIEW_SELECTION,
    title: translate(locale, 'menu.viewSelection'),
    contexts: ['selection'],
  });
}

/** Puts the menus and the toolbar icon's tooltip in `locale` (the manifest's follow the browser). */
export async function labelExtension(locale: Locale): Promise<void> {
  await browser.action.setTitle({ title: translate(locale, 'action.title') });
  for (const [id, key] of MENU_TITLES) {
    // Before the first install finishes there are no menus yet; createMenus names them then.
    await browser.contextMenus.update(id, { title: translate(locale, key) }).catch(() => undefined);
  }
}

/** The selection with its line breaks (info.selectionText may lose them), or the fallback. */
async function selectedText({ tabId, frameId }: FrameTarget, fallback: string): Promise<string> {
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      func: () => getSelection()?.toString() ?? '',
    });
    const text: unknown = injection?.result;
    return typeof text === 'string' && text.trim() !== '' ? text : fallback;
  } catch {
    return fallback;
  }
}

/** Marks the toolbar icon on this tab and says why in its tooltip; the page stays as it was. */
async function reportFailure(tabId: number, error: unknown, what: 'page' | 'selection'): Promise<void> {
  const locale = await backgroundLocale();
  const reason =
    error instanceof NotHtmlPageError
      ? translate(locale, 'action.notHtml')
      : error instanceof Error
        ? error.message
        : String(error);
  console.warn(`[json-viewer] "View ${what} as JSON" failed`, error);
  try {
    await browser.action.setBadgeBackgroundColor({ tabId, color: '#d1242f' });
    await browser.action.setBadgeText({ tabId, text: '!' });
    const key = what === 'page' ? 'action.cantOpen' : 'action.cantOpenSelection';
    await browser.action.setTitle({ tabId, title: translate(locale, key, { reason }) });
  } catch (badgeError) {
    console.warn('[json-viewer] could not mark the toolbar icon', badgeError);
  }
}

/** A later attempt worked: the tab's icon goes back to normal. */
async function clearFailure(tabId: number): Promise<void> {
  try {
    if ((await browser.action.getBadgeText({ tabId })) === '') return;
    await browser.action.setBadgeText({ tabId, text: '' });
    await browser.action.setTitle({ tabId, title: translate(await backgroundLocale(), 'action.title') });
  } catch (error) {
    console.warn('[json-viewer] could not clear the toolbar icon', error);
  }
}

export async function onMenuClick(info: Browser.contextMenus.OnClickData, tab: Browser.tabs.Tab | undefined): Promise<void> {
  if (tab?.id === undefined) return;
  const target = { tabId: tab.id, frameId: info.frameId ?? 0 };
  const what = info.menuItemId === MENU_VIEW_PAGE ? 'page' : 'selection';
  try {
    if (info.menuItemId === MENU_VIEW_PAGE) {
      await injectViewer(target, true);
    } else if (info.menuItemId === MENU_VIEW_SELECTION) {
      await openScratchpad(await selectedText(target, info.selectionText ?? ''), tab.index + 1);
    } else {
      return;
    }
  } catch (error) {
    await reportFailure(tab.id, error, what);
    return;
  }
  await clearFailure(tab.id);
}
