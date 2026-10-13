/** Viewer behaviour; mirrors the original extension's "Add-ons" and "Structure" options. */
export interface ViewerOptions {
  showHeader: boolean;
  sortKeys: boolean;
  clickableUrls: boolean;
  wrapLinkWithAnchorTag: boolean;
  openLinksInNewWindow: boolean;
  autoHighlight: boolean;
  lineNumbers: boolean;
  lineWrapping: boolean;
  foldGutter: boolean;
  tabSize: number;
  indentCStyle: boolean;
  showArraySize: boolean;
  /** Fold containers this deep or deeper on open (top-level value = 1); 0 = off. Replaces "alwaysFold". */
  foldFromLevel: number;
  /** Above this size (MiB) the viewer skips color swatches and date and image previews. Replaces "maxJsonSize". */
  lightModeThresholdMB: number;
}

export const defaultViewerOptions: ViewerOptions = {
  showHeader: true,
  sortKeys: false,
  clickableUrls: true,
  wrapLinkWithAnchorTag: false,
  openLinksInNewWindow: true,
  autoHighlight: true,
  lineNumbers: true,
  lineWrapping: true,
  foldGutter: true,
  tabSize: 2,
  indentCStyle: false,
  showArraySize: false,
  foldFromLevel: 0,
  lightModeThresholdMB: 20,
};

/** Fold levels offered in the UI; level 1 would fold the whole document into one line. */
export const FOLD_LEVELS = [2, 3, 4, 5, 6] as const;

/** "Fold all" keeps the top-level value open and folds everything inside it. */
export const FOLD_ALL_LEVEL = 2;


export const LIGHT_MODE_MIN_MB = 1;
export const LIGHT_MODE_MAX_MB = 1000;

/** Optional viewer features (the options page's Features section). */
export interface Features {
  jsonPath: boolean;
  colorSwatches: boolean;
  dateTooltips: boolean;
  imagePreview: boolean;
}

export const defaultFeatures: Features = {
  jsonPath: true,
  colorSwatches: true,
  dateTooltips: true,
  imagePreview: true,
};

/** The decorations CodeMirror draws for values: color swatches, date tooltips and image previews. */
export type RichValues = Pick<Features, 'colorSwatches' | 'dateTooltips' | 'imagePreview'>;

export const NO_RICH_VALUES: RichValues = { colorSwatches: false, dateTooltips: false, imagePreview: false };

/** The value decorations to draw: the enabled ones, or none in light mode. */
export function richValues(features: Features, lightMode: boolean): RichValues {
  if (lightMode) return NO_RICH_VALUES;
  const { colorSwatches, dateTooltips, imagePreview } = features;
  return { colorSwatches, dateTooltips, imagePreview };
}
