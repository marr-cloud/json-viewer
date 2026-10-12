/**
 * Copies `text`, falling back to a selected textarea plus execCommand where the Clipboard API is
 * missing (plain-http pages aren't secure contexts) or refuses. Both need the click or key press
 * that triggered the copy, so no clipboard permission is required.
 */
export async function copyText(text: string, container: HTMLElement): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Not focused, or blocked by a permissions policy: try the old way.
  }
  return copyWithSelection(text, container);
}

function copyWithSelection(text: string, container: HTMLElement): boolean {
  const root = container.getRootNode() as Document | ShadowRoot;
  const previous = root.activeElement instanceof HTMLElement ? root.activeElement : null;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
  container.append(area);
  area.focus();
  area.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  previous?.focus({ preventScroll: true });
  return copied;
}
