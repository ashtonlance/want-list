/**
 * Where focus goes when an overlay closes. Normally back to whatever had focus as it opened. When one
 * overlay opens another as it closes (the photo's Details button opening the card's sheet), what had
 * focus is gone, so the closing one hands its own opener on to the next.
 */
let handoff: { to: Element | null; at: number } | null = null;

/**
 * How long a handoff waits for the next overlay. Long enough for one opened inside a view transition, whose
 * update runs a frame or two later; short enough that a stray one can't catch an unrelated overlay.
 */
const HANDOFF_MS = 1000;

/** Called by an overlay closing into another: the next overlay to open returns focus here. */
export function handOffFocus(to: Element | null): void {
  handoff = { to, at: performance.now() };
}

/** Read as an overlay opens: what should get focus back when it closes. */
export function takeOpener(): Element | null {
  const h = handoff && performance.now() - handoff.at < HANDOFF_MS ? handoff.to : null;
  handoff = null;
  const active = document.activeElement;
  return h ?? (active && active !== document.body ? active : null);
}

/** Gives focus back to `to` if it's still on screen and reachable. */
export function returnFocus(to: Element | null): void {
  if (to instanceof HTMLElement && to.isConnected && !to.closest("[inert],[aria-hidden='true']"))
    to.focus({ preventScroll: true });
}
