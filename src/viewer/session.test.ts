// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createViewerSession, type ViewerSession } from './session';

/** A MediaQueryList whose `matches` the test flips. */
function fakeMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  return {
    matches,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    change(next: boolean) {
      for (const listener of listeners) listener({ matches: next } as MediaQueryListEvent);
    },
    listeners,
  };
}

const fonts = { add: () => undefined, delete: () => true };

describe('createViewerSession', () => {
  let session: ViewerSession | undefined;
  beforeEach(() => fakeBrowser.reset());
  afterEach(() => {
    session?.stop();
    session = undefined;
  });

  const open = async (media = fakeMedia(false)) => {
    session = await createViewerSession(fonts, media as unknown as MediaQueryList);
    return { session, media };
  };

  it('loads the stored settings and custom CSS', async () => {
    await fakeBrowser.storage.sync.set({ settings: { themeMode: 'light', viewer: { tabSize: 4 } } });
    await fakeBrowser.storage.local.set({ customCss: '.cm-editor { color: red }' });
    const { session } = await open();
    expect(session.state.settings.viewer.tabSize).toBe(4);
    expect(session.state.customCss).toBe('.cm-editor { color: red }');
    expect(session.kind.value).toBe('light');
    expect(session.theme.value.id).toBe('light-plus');
  });

  it('follows storage changes by replacing the settings object', async () => {
    const { session } = await open();
    const before = session.state.settings;
    await fakeBrowser.storage.sync.set({ settings: { viewer: { tabSize: 8 } } });
    await vi.waitFor(() => expect(session.state.settings.viewer.tabSize).toBe(8));
    expect(session.state.settings).not.toBe(before);
  });

  it('follows the system color scheme and the toolbar toggle', async () => {
    const { session, media } = await open(fakeMedia(true));
    expect(session.kind.value).toBe('dark');
    media.change(false);
    expect(session.kind.value).toBe('light');
    session.toggleTheme();
    expect(session.kind.value).toBe('dark');
  });

  it('stops listening when stopped', async () => {
    const { session, media } = await open();
    expect(media.listeners.size).toBe(1);
    session.stop();
    expect(media.listeners.size).toBe(0);
    await fakeBrowser.storage.sync.set({ settings: { viewer: { tabSize: 8 } } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(session.state.settings.viewer.tabSize).toBe(2);
  });
});
