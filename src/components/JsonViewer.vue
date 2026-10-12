<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import CodeView from './CodeView.vue';
import ViewerStatusBar from './ViewerStatusBar.vue';
import ViewerToolbar from './ViewerToolbar.vue';
import { fontCssVars } from '@/fonts/css';
import type { FontSettings } from '@/settings/font';
import { toCssVars } from '@/themes/css';
import { resolveColors } from '@/themes/resolve';
import type { Theme } from '@/themes/types';
import { copyText } from '@/viewer/clipboard';
import type { ParseError } from '@/parse/parse';
import { downloadName, downloadText } from '@/viewer/download';
import { FOLD_ALL_LEVEL, type ViewerOptions } from '@/viewer/options';
import { prepareDocument } from '@/viewer/prepare';
import { byteLength, countLines, formatBytes, formatCount } from '@/viewer/stats';

const props = withDefaults(
  defineProps<{
    raw: string;
    options: ViewerOptions;
    theme: Theme;
    /** Resolved light/dark mode in effect; drives the toolbar toggle. Defaults to the theme's type. */
    kind?: 'light' | 'dark';
    customCss?: string;
    source?: { url: string; loadedAt: Date };
    toggleLabel?: string;
    font?: FontSettings;
    /** Shown in the status bar. */
    format?: string;
  }>(),
  { customCss: '', kind: undefined, source: undefined, toggleLabel: undefined, font: undefined, format: 'JSON' },
);
const emit = defineEmits<{ toggleTheme: []; openSettings: [] }>();

const FLASH_MS = 2000;

// Primitive computeds only notify when their value changes, so replacing the options
// object with unrelated changes (e.g. lineNumbers) doesn't re-run the formatter.
const tabSize = computed(() => props.options.tabSize);
// The toolbar's Sort keys button overrides the setting for this tab only.
const sortOverride = ref<boolean | null>(null);
const sortKeys = computed(() => sortOverride.value ?? props.options.sortKeys);
const indentCStyle = computed(() => props.options.indentCStyle);
const prepared = computed(() =>
  prepareDocument(props.raw, { tabSize: tabSize.value, sortKeys: sortKeys.value, indentCStyle: indentCStyle.value }),
);
/** What the Code tab shows and what copy/download act on. */
const shown = computed<{ text: string; value: unknown; valid: boolean; error: ParseError | null }>(() => {
  const doc = prepared.value;
  return doc.ok
    ? { text: doc.text, value: doc.value, valid: true, error: null }
    : { text: doc.text, value: undefined, valid: false, error: doc.error };
});
const cssVars = computed(() => ({
  ...toCssVars(resolveColors(props.theme)),
  ...(props.font ? fontCssVars(props.font) : {}),
}));
// autoHighlight=false starts on Raw; the Code tab still formats on demand.
const mode = ref<'code' | 'raw'>(props.options.autoHighlight ? 'code' : 'raw');

const root = ref<HTMLElement>();
const cursorPath = ref('$');
const size = computed(() => formatBytes(byteLength(props.raw)));
const lines = computed(() => formatCount(countLines(mode.value === 'code' ? shown.value.text : props.raw), 'line'));

const message = ref('');
let flashTimer: ReturnType<typeof setTimeout> | undefined;
function flash(text: string): void {
  message.value = text;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    message.value = '';
  }, FLASH_MS);
}
onBeforeUnmount(() => clearTimeout(flashTimer));

async function copy(text: string | null, what: string): Promise<void> {
  if (text === null || !root.value) return;
  flash((await copyText(text, root.value)) ? `Copied ${what}` : 'Copy failed');
}

function copyPath(): void {
  void copy(cursorPath.value, 'path');
}

const codeView = ref<InstanceType<typeof CodeView>>();

function foldTo(level: number): void {
  codeView.value?.foldFromLevel(level);
}

function unfoldEverything(): void {
  codeView.value?.unfoldAll();
}

function minified(): string | null {
  if (!shown.value.valid) return null;
  try {
    return JSON.stringify(shown.value.value);
  } catch {
    return null;
  }
}

function onCopy(variant: 'formatted' | 'minified'): void {
  void (variant === 'formatted' ? copy(shown.value.text, 'formatted JSON') : copy(minified(), 'minified JSON'));
}

function onDownload(): void {
  downloadText(shown.value.text, downloadName(props.source?.url ?? ''));
}

function toggleSort(): void {
  sortOverride.value = !sortKeys.value;
}
</script>

<template>
  <div ref="root" class="jv-root" :class="`jv-${theme.type}`" :style="cssVars">
    <component :is="'style'" v-if="customCss">{{ customCss }}</component>
    <ViewerToolbar
      v-model:mode="mode"
      :source="options.showHeader ? source : undefined"
      :kind="kind ?? theme.type"
      :toggle-label="toggleLabel"
      :sorted="sortKeys"
      :can-fold="mode === 'code'"
      :can-minify="shown.valid"
      @toggle-theme="emit('toggleTheme')"
      @open-settings="emit('openSettings')"
      @fold-all="foldTo(FOLD_ALL_LEVEL)"
      @unfold-all="unfoldEverything"
      @fold-level="foldTo"
      @copy="onCopy"
      @download="onDownload"
      @toggle-sort="toggleSort"
    />
    <div v-if="!prepared.ok" class="jv-error" role="alert">
      {{ prepared.error.message
      }}<template v-if="prepared.error.line !== null">
        — line {{ prepared.error.line }}, column {{ prepared.error.column }}</template
      >
    </div>
    <CodeView
      v-if="mode === 'code'"
      ref="codeView"
      class="jv-body"
      :doc="shown.text"
      :options="options"
      :theme="theme"
      :error="shown.error"
      @path="cursorPath = $event"
    />
    <pre v-else class="jv-body jv-raw">{{ raw }}</pre>
    <ViewerStatusBar
      :path="mode === 'code' ? cursorPath : null"
      :size="size"
      :lines="lines"
      :format="format"
      :message="message"
      @copy-path="copyPath"
    />
  </div>
</template>
