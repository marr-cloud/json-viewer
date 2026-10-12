// @vitest-environment happy-dom
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { defaultTheme } from '@/themes/builtin';
import { defaultViewerOptions, type ViewerOptions } from '@/viewer/options';
import { buildExtensions } from './setup';

const create = (options: ViewerOptions, errorLine: number | null = null) =>
  EditorState.create({
    doc: '{\n  "a": "https://example.com"\n}',
    extensions: buildExtensions({ options, theme: defaultTheme, errorLine }),
  });

describe('buildExtensions', () => {
  it('creates a read-only state with the configured tab size', () => {
    const state = create({ ...defaultViewerOptions, tabSize: 4 });
    expect(state.readOnly).toBe(true);
    expect(state.tabSize).toBe(4);
  });

  it('accepts every feature switched on', () => {
    const all = { ...defaultViewerOptions, showArraySize: true, wrapLinkWithAnchorTag: true };
    expect(() => create(all, 2)).not.toThrow();
  });

  it('accepts every feature switched off', () => {
    const none: ViewerOptions = {
      ...defaultViewerOptions,
      clickableUrls: false,
      lineNumbers: false,
      lineWrapping: false,
      foldGutter: false,
      showArraySize: false,
    };
    expect(() => create(none)).not.toThrow();
  });
});
