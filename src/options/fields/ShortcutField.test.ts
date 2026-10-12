// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, ref, type App } from 'vue';
import ShortcutField from './ShortcutField.vue';

let app: App | undefined;

afterEach(() => {
  app?.unmount();
  document.body.innerHTML = '';
});

function mount(initial = 'Alt+R', conflict?: string) {
  const value = ref(initial);
  const host = document.createElement('div');
  document.body.append(host);
  app = createApp({
    render: () =>
      h(ShortcutField, {
        label: 'Toggle Raw',
        defaultValue: 'Alt+R',
        conflict,
        modelValue: value.value,
        'onUpdate:modelValue': (next: string) => {
          value.value = next;
        },
      }),
  });
  app.mount(host);
  const button = host.querySelector<HTMLButtonElement>('[aria-label="Toggle Raw shortcut"]')!;
  return { host, value, button };
}

function press(target: HTMLElement, code: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

const text = (element: Element) => element.textContent?.trim();

describe('ShortcutField', () => {
  it('records a combination after a click', async () => {
    const { button, value } = mount();
    expect(text(button)).toBe('Alt+R');
    button.click();
    await nextTick();
    expect(text(button)).toBe('Press keys…');
    press(button, 'ControlLeft', { ctrlKey: true });
    press(button, 'KeyY', { ctrlKey: true, altKey: true });
    await nextTick();
    expect(value.value).toBe('Ctrl+Alt+Y');
    expect(text(button)).toBe('Ctrl+Alt+Y');
  });

  it('rejects keys without Ctrl, Alt, Meta or a function key and keeps recording', async () => {
    const { host, button, value } = mount();
    button.click();
    await nextTick();
    press(button, 'KeyK');
    await nextTick();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Use Ctrl, Alt or a function key');
    expect(value.value).toBe('Alt+R');
    expect(text(button)).toBe('Press keys…');
  });

  it('cancels with Esc and clears with Backspace', async () => {
    const { button, value } = mount();
    button.click();
    await nextTick();
    press(button, 'Escape');
    await nextTick();
    expect(value.value).toBe('Alt+R');
    expect(text(button)).toBe('Alt+R');
    button.click();
    await nextTick();
    press(button, 'Backspace');
    await nextTick();
    expect(value.value).toBe('');
    expect(text(button)).toBe('None');
  });

  it('lets Tab move focus and ignores keys when not recording', async () => {
    const { button, value } = mount();
    expect(press(button, 'KeyY', { ctrlKey: true, altKey: true }).defaultPrevented).toBe(false);
    button.click();
    await nextTick();
    expect(press(button, 'Tab').defaultPrevented).toBe(false);
    await nextTick();
    expect(text(button)).toBe('Alt+R');
    expect(value.value).toBe('Alt+R');
  });

  it('offers Reset when the value differs from the default', async () => {
    const { host, value } = mount('Ctrl+Q');
    host.querySelector<HTMLButtonElement>('[aria-label="Reset Toggle Raw shortcut"]')!.click();
    await nextTick();
    expect(value.value).toBe('Alt+R');
    expect(host.querySelector('[aria-label="Reset Toggle Raw shortcut"]')).toBeNull();
  });

  it('shows a conflict', () => {
    const { host } = mount('Alt+R', 'JSONPath filter');
    expect(host.textContent).toContain('Also assigned to JSONPath filter.');
  });
});
