<script setup lang="ts">
import { unfoldAll } from '@codemirror/language';
import { openSearchPanel } from '@codemirror/search';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { cursorPath } from '@/editor/cursorPath';
import { errorPosition, type ErrorLocation } from '@/editor/errorLine';
import { cancelPendingFold, foldFromLevel } from '@/editor/foldLevel';
import { buildExtensions } from '@/editor/setup';
import { getLocale } from '@/i18n';
import type { Theme } from '@/themes/types';
import type { RichValues, ViewerOptions } from '@/viewer/options';

const props = defineProps<{
  doc: string;
  options: ViewerOptions;
  theme: Theme;
  error: ErrorLocation | null;
  /** Color swatches and date/image tooltips; replace the object to change them. */
  rich?: RichValues;
  /** The page the document came from: root-relative paths link against it. */
  pageUrl?: string;
}>();
const emit = defineEmits<{ path: [path: string] }>();

const host = ref<HTMLDivElement>();
const config = new Compartment();
let view: EditorView | undefined;

function currentExtensions() {
  return buildExtensions({
    options: props.options,
    theme: props.theme,
    error: props.error,
    rich: props.rich,
    pageUrl: props.pageUrl,
  });
}

function revealError(): void {
  if (!view || props.error === null) return;
  const position = errorPosition(view.state.doc, props.error);
  if (position === null) return;
  view.dispatch({
    selection: { anchor: position },
    effects: EditorView.scrollIntoView(position, { y: 'center', x: 'center' }),
  });
}

function applyFoldOnOpen(): void {
  // An invalid document opens on its error; folding could hide it.
  if (!view || props.error !== null) return;
  foldFromLevel(view, props.options.foldFromLevel);
}

onMounted(() => {
  view = new EditorView({
    state: EditorState.create({
      doc: props.doc,
      // Outside the compartment so reconfiguring never recreates the path listener.
      extensions: [config.of(currentExtensions()), cursorPath((path) => emit('path', path))],
    }),
    parent: host.value!,
  });
  applyFoldOnOpen();
  revealError();
  // Without focus Ctrl+F opens the browser find, which misses virtualized content.
  view.focus();
});

// One watcher so a document and fold level that change together fold once, not twice.
watch(
  [() => props.doc, () => props.options.foldFromLevel],
  ([doc], [previous]) => {
    if (!view) return;
    if (doc !== previous) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: doc } });
    }
    applyFoldOnOpen();
  },
);

// Reconfigure in place so scroll position, folds and selection survive option and theme changes.
// The language is listed because CodeMirror's own texts (fold arrows, go to line) come from it.
watch(
  () => [props.options, props.theme, props.error, props.rich, props.pageUrl, getLocale()] as const,
  () => view?.dispatch({ effects: config.reconfigure(currentExtensions()) }),
);

watch(
  () => [props.doc, props.error] as const,
  () => revealError(),
  { flush: 'post' },
);

onBeforeUnmount(() => {
  if (view) cancelPendingFold(view);
  view?.destroy();
});

defineExpose({
  foldFromLevel(level: number): void {
    if (view) foldFromLevel(view, level);
  },
  unfoldAll(): void {
    if (!view) return;
    cancelPendingFold(view);
    unfoldAll(view);
  },
  openSearch(): void {
    if (view) openSearchPanel(view);
  },
  focus(): void {
    view?.focus();
  },
});
</script>

<template>
  <div ref="host" class="jv-code" />
</template>
