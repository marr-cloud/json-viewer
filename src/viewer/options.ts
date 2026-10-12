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
};
