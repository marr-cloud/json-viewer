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
};

/** Fold levels offered in the UI; level 1 would fold the whole document into one line. */
export const FOLD_LEVELS = [2, 3, 4, 5, 6] as const;

/** "Fold all" keeps the top-level value open and folds everything inside it. */
export const FOLD_ALL_LEVEL = 2;

/** How a fold level reads in the UI: level 2 shows one level of the document. */
export function foldLevelLabel(level: number): string {
  const shown = level - 1;
  return `Show ${shown} level${shown === 1 ? '' : 's'}`;
}
