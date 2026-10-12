/** Hides every current child of `body` and returns a function that restores their previous inline display. */
export function hideOriginal(body: HTMLElement): () => void {
  const saved = Array.from(body.children, (el) => {
    const node = el as HTMLElement;
    const previous = node.style.display;
    node.style.display = 'none';
    return { node, previous };
  });
  return () => {
    for (const { node, previous } of saved) node.style.display = previous;
  };
}
