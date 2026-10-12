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
import type { Theme } from '@/themes/types';
import type { ViewerOptions } from '@/viewer/options';

const props = defineProps<{
  doc: string;
  options: ViewerOptions;
  theme: Theme;
  error: ErrorLocation | null;
}>();
const emit = defineEmits<{ path: [path: string] }>();

const host = ref<HTMLDivElement>();
const config = new Compartment();
let view: EditorView | undefined;

function currentExtensions() {
  return buildExtensions({ options: props.options, theme: props.theme, error: props.error });
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
watch(
  () => [props.options, props.theme, props.error] as const,
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
