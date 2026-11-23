/** Runs fn once the browser is idle (or after a short wait where it can't tell, as in Safari); returns a cancel. */
export function whenIdle(fn: () => void, timeout: number): () => void {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(fn, { timeout });
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 50);
  return () => clearTimeout(id);
}

/**
 * Runs each step in its own idle moment, in order, so a batch of background work never holds up a tap
 * or a scroll for longer than one step. Returns a cancel that stops the steps not yet run.
 */
export function idleSteps(steps: readonly (() => void)[], timeout = 2000): () => void {
  let i = 0;
  const next = () => {
    const step = steps[i++];
    if (!step) return;
    step();
    cancel = whenIdle(next, timeout);
  };
  let cancel = whenIdle(next, timeout);
  return () => cancel();
}
