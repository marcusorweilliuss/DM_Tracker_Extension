/** Wait for a selector to appear in the DOM. */
export function waitForElement(selector: string, timeout = 10000): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLElement>(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

/** Scroll an element to the top/bottom and wait for new content to load. Returns true if new content appeared. */
export async function scrollAndWait(
  container: HTMLElement,
  direction: 'up' | 'down',
  waitMs = 1500
): Promise<boolean> {
  const childCountBefore = container.children.length;
  const scrollHeightBefore = container.scrollHeight;

  if (direction === 'up') {
    container.scrollTop = 0;
  } else {
    container.scrollTop = container.scrollHeight;
  }

  await sleep(waitMs);

  return (
    container.children.length !== childCountBefore ||
    container.scrollHeight !== scrollHeightBefore
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
