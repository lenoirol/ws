import { flushSync } from 'react-dom';

type Transition = { skipTransition: () => void; finished: Promise<unknown> };

/**
 * While a View Transition plays the browser shows a snapshot and the real page cannot be clicked, so a
 * press during the fade would be lost. Pressing skips the rest of the fade; the page is then live at once.
 */
function skipOnPress(t: Transition): void {
  const skip = () => t.skipTransition();
  window.addEventListener('pointerdown', skip, { capture: true, once: true });
  void t.finished.then(
    () => window.removeEventListener('pointerdown', skip, { capture: true }),
    () => window.removeEventListener('pointerdown', skip, { capture: true }),
  );
}

/** Runs a state update inside a View Transition when the browser supports it and motion is allowed. */
export function withViewTransition(update: () => void): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => Transition };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduce) {
    update();
    return;
  }
  skipOnPress(doc.startViewTransition(() => flushSync(update)));
}
