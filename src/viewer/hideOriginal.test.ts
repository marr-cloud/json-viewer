// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { hideOriginal } from './hideOriginal';

describe('hideOriginal', () => {
  it('hides current children and restores their previous inline display', () => {
    document.body.innerHTML = '<pre id="a"></pre><div id="b" style="display: inline"></div>';
    const a = document.getElementById('a')!;
    const b = document.getElementById('b')!;
    const restore = hideOriginal(document.body);
    expect(a.style.display).toBe('none');
    expect(b.style.display).toBe('none');
    restore();
    expect(a.style.display).toBe('');
    expect(b.style.display).toBe('inline');
  });

  it('does not touch children added after the call', () => {
    document.body.innerHTML = '<pre></pre>';
    const restore = hideOriginal(document.body);
    const late = document.createElement('div');
    document.body.appendChild(late);
    restore();
    expect(late.style.display).toBe('');
  });
});
