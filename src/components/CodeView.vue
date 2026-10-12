<script setup lang="ts">
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { buildExtensions } from '@/editor/setup';
import type { Theme } from '@/themes/types';
import type { ViewerOptions } from '@/viewer/options';

const props = defineProps<{
  doc: string;
  options: ViewerOptions;
  theme: Theme;
  errorLine: number | null;
}>();

const host = ref<HTMLDivElement>();
let view: EditorView | undefined;

function createState(): EditorState {
  return EditorState.create({
    doc: props.doc,
    extensions: buildExtensions({ options: props.options, theme: props.theme, errorLine: props.errorLine }),
  });
}

function revealErrorLine(): void {
  if (!view || props.errorLine === null) return;
  const doc = view.state.doc;
  const line = doc.line(Math.min(Math.max(props.errorLine, 1), doc.lines));
  view.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: 'center' }) });
}

onMounted(() => {
  view = new EditorView({ state: createState(), parent: host.value! });
  revealErrorLine();
});

watch(
  () => [props.doc, props.options, props.theme, props.errorLine],
  () => {
    view?.setState(createState());
    revealErrorLine();
  },
);

onBeforeUnmount(() => view?.destroy());
</script>

<template>
  <div ref="host" class="jv-code" />
</template>
