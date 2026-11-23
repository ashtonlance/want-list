import { useEffect, useRef, type RefObject } from "react";

/**
 * Open overlays (sheets, the photo view), topmost last. While any is open, Escape closes the topmost
 * one and the page behind doesn't scroll. An overlay that names its element also keeps focus to
 * itself: everything outside the topmost one is inert, focus moves into it as it opens, and goes back
 * to where it was when it closes.
 */
interface Entry {
  close: () => void;
  /** The dialog itself; focused on open unless something inside already has focus. */
  el: HTMLElement | null;
  /** Where focus goes back to on close. */
  returnTo: Element | null;
}

const stack: Entry[] = [];

/** Elements this module made inert, given back whenever the topmost overlay changes. */
let inerted: HTMLElement[] = [];

/** Left live behind an overlay: the toast, so its Undo still works, and elements that draw nothing. */
const KEEP = ".toast, datalist, script, style, template";

/**
 * Where an overlay that closed in this update sent focus back to. An overlay opened in the same update
 * from inside it (the photo's Details button opening the card's sheet) inherits it, since what had
 * focus before is gone.
 */
let handoff: Element | null = null;

function sync() {
  document.body.classList.toggle("sheet-open", stack.length > 0);
  for (const el of inerted) el.inert = false;
  inerted = [];
  // Outside the topmost overlay means the siblings of it and of each of its ancestors.
  for (let node = stack.at(-1)?.el; node?.parentElement; node = node.parentElement) {
    for (const sib of node.parentElement.children) {
      if (sib === node || !(sib instanceof HTMLElement) || sib.inert || sib.matches(KEEP)) continue;
      sib.inert = true;
      inerted.push(sib);
    }
  }
}

/** Puts focus back after `entry` closed, unless it has already landed somewhere still on screen. */
function restoreFocus(entry: Entry) {
  const active = document.activeElement;
  const lost = !active || active === document.body || !active.isConnected || !!entry.el?.contains(active);
  const to = entry.returnTo;
  if (lost && to instanceof HTMLElement && to.isConnected && !to.closest("[inert]"))
    to.focus({ preventScroll: true });
}

if (typeof document !== "undefined") {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") stack.at(-1)?.close();
  });
}

interface OverlayOptions {
  /** The dialog element. Without it the overlay leaves focus and the page behind alone. */
  el?: RefObject<HTMLElement | null>;
  /** What had focus before it opened, read as it opens. */
  returnTo?: () => Element | null;
}

/** Registers an open overlay. `onClose` may change between renders. */
export function useOverlay(open: boolean, onClose: () => void, options: OverlayOptions = {}): void {
  const closeRef = useRef(onClose);
  const optionsRef = useRef(options);
  useEffect(() => {
    closeRef.current = onClose;
    optionsRef.current = options;
  });
  useEffect(() => {
    if (!open) return;
    const { el, returnTo } = optionsRef.current;
    const opener = returnTo?.() ?? null;
    const entry: Entry = {
      close: () => closeRef.current(),
      el: el?.current ?? null,
      // With nothing focused (Safari doesn't focus a tapped button), body is no opener: use the handoff.
      returnTo:
        opener?.isConnected && opener !== document.body && opener !== document.documentElement
          ? opener
          : handoff,
    };
    stack.push(entry);
    sync();
    if (entry.el && !entry.el.contains(document.activeElement)) entry.el.focus({ preventScroll: true });
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      sync();
      if (!entry.el) return;
      restoreFocus(entry);
      handoff = entry.returnTo;
      queueMicrotask(() => (handoff = null));
    };
  }, [open]);
}
