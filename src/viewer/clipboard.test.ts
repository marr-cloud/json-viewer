// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

let container: HTMLElement;

function setClipboard(value: unknown): void {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

function setExecCommand(impl: (command: string) => boolean): ReturnType<typeof vi.fn> {
  const fn = vi.fn(impl);
  Object.defineProperty(document, 'execCommand', { value: fn, configurable: true });
  return fn;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('copyText', () => {
  it('uses the Clipboard API when it is available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    const exec = setExecCommand(() => true);
    expect(await copyText('$.a', container)).toBe(true);
    expect(writeText).toHaveBeenCalledWith('$.a');
    expect(exec).not.toHaveBeenCalled();
  });

  it('falls back to a selected textarea without the Clipboard API (plain http pages)', async () => {
    setClipboard(undefined);
    let copied: string | undefined;
    const exec = setExecCommand((command) => {
      copied = container.querySelector('textarea')?.value;
      return command === 'copy';
    });
    expect(await copyText('{"a":1}', container)).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(copied).toBe('{"a":1}');
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('falls back when the Clipboard API rejects', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('Document is not focused')) });
    const exec = setExecCommand(() => true);
    expect(await copyText('x', container)).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('reports failure when both ways fail', async () => {
    setClipboard(undefined);
    setExecCommand(() => {
      throw new Error('not allowed');
    });
    expect(await copyText('x', container)).toBe(false);
    setExecCommand(() => false);
    expect(await copyText('x', container)).toBe(false);
  });

  it('gives focus back to the element that had it', async () => {
    setClipboard(undefined);
    setExecCommand(() => true);
    const button = document.createElement('button');
    container.append(button);
    button.focus();
    await copyText('x', container);
    expect(document.activeElement).toBe(button);
  });
});
