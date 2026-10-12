<script setup lang="ts">
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ErrorLocation } from '@/editor/errorLine';
import { buildExtensions } from '@/editor/setup';
import type { Theme } from '@/themes/types';
import type { ViewerOptions } from '@/viewer/options';

const props = defineProps<{
  doc: string;
  options: ViewerOptions;
  theme: Theme;
  error: ErrorLocation | null;
}>();

const host = ref<HTMLDivElement>();
let view: EditorView | undefined;

function createState(): EditorState {
  return EditorState.create({
    doc: props.doc,
    extensions: buildExtensions({ options: props.options, theme: props.theme, error: props.error }),
  });
}

function revealError(): void {
  const error = props.error;
  if (!view || error === null) return;
  const doc = view.state.doc;
  if (error.offset !== null) {
    const anchor = Math.min(Math.max(error.offset, 0), doc.length);
    view.dispatch({
      selection: { anchor },
      effects: EditorView.scrollIntoView(anchor, { y: 'center', x: 'center' }),
    });
  } else if (error.line !== null) {
    const line = doc.line(Math.min(Math.max(error.line, 1), doc.lines));
    view.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: 'center' }) });
  }
}

onMounted(() => {
  view = new EditorView({ state: createState(), parent: host.value! });
  revealError();
  // Without focus Ctrl+F opens the browser find, which misses virtualized content.
  view.focus();
});

watch(
  () => [props.doc, props.options, props.theme, props.error],
  () => {
    view?.setState(createState());
    revealError();
    view?.focus();
  },
);

onBeforeUnmount(() => view?.destroy());
</script>

<template>
  <div ref="host" class="jv-code" />
</template>
