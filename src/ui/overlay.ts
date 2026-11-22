import { useEffect, useRef } from "react";

/** Open overlays, topmost last. Escape closes the topmost one; the page behind doesn't scroll while any is open. */
const stack: { close: () => void }[] = [];

function sync() {
  document.body.classList.toggle("sheet-open", stack.length > 0);
}

if (typeof document !== "undefined") {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") stack.at(-1)?.close();
  });
}

/** Registers an open overlay. `onClose` may change between renders. */
export function useOverlay(open: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const entry = { close: () => closeRef.current() };
    stack.push(entry);
    sync();
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      sync();
    };
  }, [open]);
}
