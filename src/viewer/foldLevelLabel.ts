import { tc } from '@/i18n';

/** How a fold level reads in the UI: level 2 shows one level of the document. */
export function foldLevelLabel(level: number): string {
  return tc('viewer.foldLevel', level - 1);
}
