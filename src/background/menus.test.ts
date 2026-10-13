import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { scratchpadInputItem } from '@/scratchpad/input';
import { createMenus, labelExtension, MENU_VIEW_PAGE, MENU_VIEW_SELECTION, onMenuClick } from './menus';
import { SCRATCHPAD_PAGE } from './scratchpad';
import { VIEWER_SCRIPT } from './viewer';

const tab = { id: 7, index: 2 } as Browser.tabs.Tab;
const click = (menuItemId: string, extra: Partial<Browser.contextMenus.OnClickData> = {}) =>
  ({ menuItemId, editable: false, pageUrl: 'https://example.com/', frameId: 0, ...extra }) as Browser.contextMenus.OnClickData;

describe('context menus', () => {
  let executeScript: ReturnType<typeof vi.fn>;
  let createTab: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fakeBrowser.reset();
    executeScript = vi.fn().mockResolvedValue([]);
    vi.spyOn(fakeBrowser.scripting, 'executeScript').mockImplementation(executeScript as never);
    createTab = vi.fn().mockResolvedValue({});
    vi.spyOn(fakeBrowser.tabs, 'create').mockImplementation(createTab as never);
  });

  it('creates "View as JSON" for pages and "View selection as JSON" for selections', async () => {
    const removeAll = vi.spyOn(fakeBrowser.contextMenus, 'removeAll').mockResolvedValue(undefined);
    const create = vi.spyOn(fakeBrowser.contextMenus, 'create').mockReturnValue(1);
    await createMenus('en');
    expect(removeAll).toHaveBeenCalledOnce();
    expect(create.mock.calls.map(([props]) => props)).toEqual([
      { id: MENU_VIEW_PAGE, title: 'View as JSON', contexts: ['page'] },
      { id: MENU_VIEW_SELECTION, title: 'View selection as JSON', contexts: ['selection'] },
    ]);
  });

  it('names the menus in the given language', async () => {
    vi.spyOn(fakeBrowser.contextMenus, 'removeAll').mockResolvedValue(undefined);
    const create = vi.spyOn(fakeBrowser.contextMenus, 'create').mockReturnValue(1);
    await createMenus('es');
    expect(create.mock.calls.map(([props]) => props.title)).toEqual(['Ver como JSON', 'Ver la selección como JSON']);
  });

  it('relabels the menus and the toolbar icon when the language changes', async () => {
    const update = vi.spyOn(fakeBrowser.contextMenus, 'update').mockResolvedValue(undefined);
    await labelExtension('es');
    expect(update.mock.calls).toEqual([
      [MENU_VIEW_PAGE, { title: 'Ver como JSON' }],
      [MENU_VIEW_SELECTION, { title: 'Ver la selección como JSON' }],
    ]);
    expect(await fakeBrowser.action.getTitle({})).toBe('Abrir el bloc de JSON');
  });

  it('still labels the toolbar icon when the menus do not exist yet', async () => {
    vi.spyOn(fakeBrowser.contextMenus, 'update').mockRejectedValue(new Error('Cannot find menu item'));
    await labelExtension('en');
    expect(await fakeBrowser.action.getTitle({})).toBe('Open the JSON scratchpad');
  });

  it('forces the viewer into the clicked frame', async () => {
    await onMenuClick(click(MENU_VIEW_PAGE, { frameId: 4 }), tab);
    expect(executeScript).toHaveBeenCalledTimes(2);
    expect(executeScript.mock.calls[1]![0]).toEqual({ target: { tabId: 7, frameIds: [4] }, files: [VIEWER_SCRIPT] });
  });

  it('opens the selection in a scratchpad next to the tab', async () => {
    executeScript.mockResolvedValue([{ result: '{"a":\n1}' }]);
    await onMenuClick(click(MENU_VIEW_SELECTION, { selectionText: '{"a": 1}' }), tab);
    expect(await scratchpadInputItem.getValue()).toBe('{"a":\n1}');
    expect(createTab).toHaveBeenCalledWith({ url: fakeBrowser.runtime.getURL(SCRATCHPAD_PAGE), index: 3 });
  });

  it('falls back to the menu selection text when the frame cannot be read', async () => {
    executeScript.mockRejectedValue(new Error('Cannot access contents of the page'));
    await onMenuClick(click(MENU_VIEW_SELECTION, { selectionText: '[1, 2]' }), tab);
    expect(await scratchpadInputItem.getValue()).toBe('[1, 2]');
  });

  it('marks the toolbar icon when the viewer cannot run on the page', async () => {
    // Explicit: on auto, the language would come from the machine running the tests.
    await fakeBrowser.storage.sync.set({ settings: { locale: 'en' } });
    executeScript.mockRejectedValue(new Error('Cannot access a chrome:// URL'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await onMenuClick(click(MENU_VIEW_PAGE), tab);
    expect(await fakeBrowser.action.getBadgeText({ tabId: 7 })).toBe('!');
    expect(await fakeBrowser.action.getTitle({ tabId: 7 })).toBe("JSON Viewer can't open this page: Cannot access a chrome:// URL");
  });

  it('explains the failure in the chosen language', async () => {
    await fakeBrowser.storage.sync.set({ settings: { locale: 'es' } });
    executeScript.mockRejectedValue(new Error('Cannot access a chrome:// URL'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await onMenuClick(click(MENU_VIEW_PAGE), tab);
    expect(await fakeBrowser.action.getTitle({ tabId: 7 })).toBe(
      'JSON Viewer no puede abrir esta página: Cannot access a chrome:// URL',
    );
  });

  it('says when the page is not HTML', async () => {
    await fakeBrowser.storage.sync.set({ settings: { locale: 'en' } });
    executeScript.mockResolvedValueOnce([{ result: 'no-body' }]);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await onMenuClick(click(MENU_VIEW_PAGE), tab);
    expect(await fakeBrowser.action.getTitle({ tabId: 7 })).toBe(
      "JSON Viewer can't open this page: it isn't an HTML page (XML, SVG…)",
    );
  });

  it('clears the mark once the viewer opens', async () => {
    await fakeBrowser.storage.sync.set({ settings: { locale: 'en' } });
    executeScript.mockRejectedValueOnce(new Error('Cannot access a chrome:// URL'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await onMenuClick(click(MENU_VIEW_PAGE), tab);
    expect(await fakeBrowser.action.getBadgeText({ tabId: 7 })).toBe('!');
    await onMenuClick(click(MENU_VIEW_PAGE), tab);
    expect(await fakeBrowser.action.getBadgeText({ tabId: 7 })).toBe('');
    expect(await fakeBrowser.action.getTitle({ tabId: 7 })).toBe('Open the JSON scratchpad');
  });

  it('names the selection when it cannot be opened', async () => {
    await fakeBrowser.storage.sync.set({ settings: { locale: 'en' } });
    createTab.mockRejectedValueOnce(new Error('Tabs cannot be edited right now'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await onMenuClick(click(MENU_VIEW_SELECTION, { selectionText: '[1]' }), tab);
    expect(await fakeBrowser.action.getTitle({ tabId: 7 })).toBe(
      "JSON Viewer can't open the selection: Tabs cannot be edited right now",
    );
  });

  it('ignores clicks without a tab', async () => {
    await onMenuClick(click(MENU_VIEW_PAGE), undefined);
    expect(executeScript).not.toHaveBeenCalled();
  });
});
