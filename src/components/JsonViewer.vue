<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import CodeView from './CodeView.vue';
import JsonPathFilter from './JsonPathFilter.vue';
import ViewerStatusBar from './ViewerStatusBar.vue';
import ViewerToolbar from './ViewerToolbar.vue';
import { fontCssVars } from '@/fonts/css';
import { getLocale, t, tc, type MessageKey } from '@/i18n';
import type { FontSettings } from '@/settings/font';
import { actionFor, comboFromEvent, defaultShortcuts, type ShortcutAction, type Shortcuts } from '@/settings/shortcuts';
import { toCssVars } from '@/themes/css';
import { resolveColors } from '@/themes/resolve';
import type { Theme } from '@/themes/types';
import { copyText } from '@/viewer/clipboard';
import type { JsonKind } from '@/detect/detect';
import type { ParseError } from '@/parse/parse';
import { downloadName, downloadText } from '@/viewer/download';
import { defaultFeatures, FOLD_ALL_LEVEL, richValues, type Features, type ViewerOptions } from '@/viewer/options';
import { filterDocument } from '@/viewer/jsonPath';
import { prepareDocument } from '@/viewer/prepare';
import { byteLength, countLines, formatBytes, isLightMode } from '@/viewer/stats';

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
    /** How the raw text wraps its JSON. NDJSON sent as JSON is recognized anyway; the status bar shows the result. */
    format?: JsonKind;
    shortcuts?: Shortcuts;
    /** Optional features: the JSONPath filter and the value decorations follow them. */
    features?: Features;
    /**
     * Also catch shortcuts while focus is on the page itself (after a click on a non-focusable part
     * of the viewer). Only for the content script, whose viewer is the whole page.
     */
    documentShortcuts?: boolean;
  }>(),
  {
    customCss: '',
    kind: undefined,
    source: undefined,
    toggleLabel: undefined,
    font: undefined,
    format: 'json',
    shortcuts: () => defaultShortcuts,
    features: () => defaultFeatures,
    documentShortcuts: false,
  },
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
  prepareDocument(
    props.raw,
    { tabSize: tabSize.value, sortKeys: sortKeys.value, indentCStyle: indentCStyle.value },
    props.format,
  ),
);
const FORMAT_LABELS: Record<JsonKind, string> = { json: 'JSON', jsonp: 'JSONP', ndjson: 'NDJSON' };
const formatLabel = computed(() => FORMAT_LABELS[prepared.value.kind]);
const filterText = ref('');
/** The filter in effect; applied on Enter so big documents aren't re-queried on every keystroke. */
const appliedPath = ref<string | null>(null);
const formatOptions = computed(() => ({ indent: tabSize.value, sortKeys: sortKeys.value, cStyle: indentCStyle.value }));
const filtered = computed(() => {
  const doc = prepared.value;
  if (!props.features.jsonPath || appliedPath.value === null || !doc.ok) return null;
  return filterDocument(doc.value, appliedPath.value, formatOptions.value);
});
const filterError = computed(() => (filtered.value && !filtered.value.ok ? filtered.value.message : null));
/** What the Code tab shows and what copy/download act on: the filter result, or the whole document. */
const shown = computed<{ text: string; value: unknown; valid: boolean; error: ParseError | null }>(() => {
  const result = filtered.value;
  if (result?.ok) return { text: result.text, value: result.value, valid: true, error: null };
  const doc = prepared.value;
  return doc.ok
    ? { text: doc.text, value: doc.value, valid: true, error: null }
    : { text: doc.text, value: undefined, valid: false, error: doc.error };
});
// Filter results open unfolded, whatever "Fold on open" says.
const codeOptions = computed(() => (filtered.value?.ok ? { ...props.options, foldFromLevel: 0 } : props.options));
const matches = computed(() => (filtered.value?.ok ? tc('viewer.status.matches', filtered.value.count) : undefined));
const cssVars = computed(() => ({
  ...toCssVars(resolveColors(props.theme)),
  ...(props.font ? fontCssVars(props.font) : {}),
}));
// autoHighlight=false starts on Raw; the Code tab still formats on demand.
const mode = ref<'code' | 'raw'>(props.options.autoHighlight ? 'code' : 'raw');

const root = ref<HTMLElement>();
const cursorPath = ref('$');
const bytes = computed(() => byteLength(props.raw));
const size = computed(() => formatBytes(bytes.value));
/** Huge documents skip the value decorations; the status bar says so. */
const lightMode = computed(() => isLightMode(bytes.value, props.options.lightModeThresholdMB));
const rich = computed(() => richValues(props.features, lightMode.value));
const lines = computed(() => tc('viewer.status.lines', countLines(mode.value === 'code' ? shown.value.text : props.raw)));

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

async function copy(text: string | null, done: MessageKey): Promise<void> {
  if (text === null || !root.value) return;
  flash(t((await copyText(text, root.value)) ? done : 'viewer.copyFailed'));
}

function copyPath(): void {
  void copy(cursorPath.value, 'viewer.copied.path');
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
  void (variant === 'formatted'
    ? copy(shown.value.text, 'viewer.copied.formatted')
    : copy(minified(), 'viewer.copied.minified'));
}

function onDownload(): void {
  downloadText(shown.value.text, downloadName(props.source?.url ?? ''));
}

function toggleSort(): void {
  sortOverride.value = !sortKeys.value;
}

const filter = ref<InstanceType<typeof JsonPathFilter>>();

function applyFilter(path: string): void {
  const trimmed = path.trim();
  appliedPath.value = trimmed === '' ? null : trimmed;
  if (appliedPath.value !== null) mode.value = 'code';
}

function clearFilter(): void {
  filterText.value = '';
  appliedPath.value = null;
}

// Switching the feature off drops the filter, so switching it back on doesn't silently re-apply it.
watch(
  () => props.features.jsonPath,
  (on) => {
    if (!on) clearFilter();
  },
);

/** Esc anywhere in the viewer clears the filter, unless something (the search panel) already used it. */
function onEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.defaultPrevented || appliedPath.value === null) return;
  event.preventDefault();
  clearFilter();
}

const rawPre = ref<HTMLPreElement>();

async function setMode(next: 'code' | 'raw'): Promise<void> {
  mode.value = next;
  // CodeView focuses itself on mount; the Raw text needs focus so the next shortcut still reaches us.
  if (next === 'raw') {
    await nextTick();
    rawPre.value?.focus();
  }
}

/**
 * Runs a shortcut's action; false when it doesn't apply here, so the key keeps its usual meaning.
 * A held key (`repeat`) is consumed without running the action again.
 */
function runShortcut(action: ShortcutAction, repeat: boolean): boolean {
  const onCode = mode.value === 'code';
  switch (action) {
    case 'search':
      if (onCode && !repeat) codeView.value?.openSearch();
      return onCode;
    case 'filter':
      if (!props.features.jsonPath) return false;
      if (!repeat) filter.value?.focus();
      return true;
    case 'toggleRaw':
      if (!repeat) void setMode(onCode ? 'raw' : 'code');
      return true;
    case 'foldAll':
      if (onCode && !repeat) foldTo(FOLD_ALL_LEVEL);
      return onCode;
    case 'unfoldAll':
      if (onCode && !repeat) unfoldEverything();
      return onCode;
    case 'copyPath':
      if (onCode && !repeat) copyPath();
      return onCode;
  }
}

/** Capture phase: configured shortcuts win over CodeMirror's own key bindings. */
function onShortcut(event: KeyboardEvent): void {
  if (event.isComposing) return;
  const combo = comboFromEvent(event);
  const action = combo === null ? null : actionFor(props.shortcuts, combo);
  if (action === null || !runShortcut(action, event.repeat)) return;
  event.preventDefault();
  event.stopPropagation();
}

/** Focus on <body> means key events never reach the root; catch those on the document instead. */
function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.target !== document.body && event.target !== document.documentElement) return;
  onShortcut(event);
  onEscape(event);
}

onMounted(() => {
  if (props.documentShortcuts) document.addEventListener('keydown', onDocumentKeydown, true);
});
onBeforeUnmount(() => document.removeEventListener('keydown', onDocumentKeydown, true));
</script>

<template>
  <div
    ref="root"
    class="jv-root"
    :class="`jv-${theme.type}`"
    :style="cssVars"
    :lang="getLocale()"
    @keydown.capture="onShortcut"
    @keydown="onEscape"
  >
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
    >
      <template #filter>
        <JsonPathFilter
          v-if="features.jsonPath"
          ref="filter"
          v-model="filterText"
          :active="appliedPath !== null"
          :error="filterError"
          :disabled="!prepared.ok"
          @apply="applyFilter"
          @clear="clearFilter"
        />
      </template>
    </ViewerToolbar>
    <div v-if="!prepared.ok" class="jv-error" role="alert">
      {{ prepared.error.message
      }}<template v-if="prepared.error.line !== null">{{
        t('viewer.error.at', { line: prepared.error.line, column: prepared.error.column ?? '' })
      }}</template>
    </div>
    <CodeView
      v-if="mode === 'code'"
      ref="codeView"
      class="jv-body"
      :doc="shown.text"
      :options="codeOptions"
      :theme="theme"
      :error="shown.error"
      :rich="rich"
      :page-url="source?.url"
      @path="cursorPath = $event"
    />
    <pre v-else ref="rawPre" class="jv-body jv-raw" tabindex="0">{{ raw }}</pre>
    <ViewerStatusBar
      :path="mode === 'code' ? cursorPath : null"
      :size="size"
      :lines="lines"
      :format="formatLabel"
      :message="message"
      :note="matches"
      :light-mode="lightMode ? options.lightModeThresholdMB : null"
      @copy-path="copyPath"
    />
  </div>
</template>
