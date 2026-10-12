import { syntaxTree } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import {
  Decoration,
  MatchDecorator,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from '@codemirror/view';

const NUMBER = String.raw`[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?`;
const NUMBER_OR_PERCENT = `${NUMBER}%?`;
const PERCENT = `${NUMBER}%`;
const HUE = `${NUMBER}(?:deg|grad|rad|turn)?`;
// Legacy comma syntax and modern space syntax ("rgb(1 2 3 / 50%)").
const RGB =
  `rgba?\\(\\s*(?:${NUMBER_OR_PERCENT}\\s*,\\s*${NUMBER_OR_PERCENT}\\s*,\\s*${NUMBER_OR_PERCENT}(?:\\s*,\\s*${NUMBER_OR_PERCENT})?` +
  `|${NUMBER_OR_PERCENT}\\s+${NUMBER_OR_PERCENT}\\s+${NUMBER_OR_PERCENT}(?:\\s*\\/\\s*${NUMBER_OR_PERCENT})?)\\s*\\)`;
const HSL =
  `hsla?\\(\\s*(?:${HUE}\\s*,\\s*${PERCENT}\\s*,\\s*${PERCENT}(?:\\s*,\\s*${NUMBER_OR_PERCENT})?` +
  `|${HUE}\\s+${NUMBER_OR_PERCENT}\\s+${NUMBER_OR_PERCENT}(?:\\s*\\/\\s*${NUMBER_OR_PERCENT})?)\\s*\\)`;
const HEX = '#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})';
const COLOR = `${HEX}|${RGB}|${HSL}`;

const WHOLE_COLOR = new RegExp(`^(?:${COLOR})$`, 'i');
/** A JSON string whose whole content is a color, quotes included. */
export const COLOR_STRING = new RegExp(`"(${COLOR})"`, 'gi');

/** The value itself when it is a #rgb/#rrggbb/#rrggbbaa, rgb()/rgba() or hsl()/hsla() color, else null. */
export function cssColor(value: string): string | null {
  return WHOLE_COLOR.test(value) ? value : null;
}

class SwatchWidget extends WidgetType {
  constructor(readonly color: string) {
    super();
  }

  override eq(other: SwatchWidget): boolean {
    return other.color === this.color;
  }

  override toDOM(): HTMLElement {
    const swatch = document.createElement('span');
    swatch.className = 'cm-jv-swatch';
    swatch.setAttribute('aria-hidden', 'true');
    // A CSSOM property, not markup or a style attribute: nothing else can be injected.
    swatch.style.backgroundColor = this.color;
    return swatch;
  }
}

const decorator = new MatchDecorator({
  regexp: COLOR_STRING,
  decorate(add, from, _to, match, view) {
    // Keys are PropertyName nodes: only string values get a swatch.
    if (syntaxTree(view.state).resolveInner(from + 1, 1).name !== 'String') return;
    add(from + 1, from + 1, Decoration.widget({ widget: new SwatchWidget(match[1]!), side: -1 }));
  },
});

/** A small color square inside string values that are CSS colors. Only the visible lines are scanned. */
export function colorSwatches(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = decorator.createDeco(view);
      }

      update(update: ViewUpdate) {
        // The parser may reach the visible lines after they were first decorated.
        if (syntaxTree(update.state) !== syntaxTree(update.startState) && !update.docChanged) {
          this.decorations = decorator.createDeco(update.view);
        } else {
          this.decorations = decorator.updateDeco(update, this.decorations);
        }
      }
    },
    { decorations: (instance) => instance.decorations },
  );
}
