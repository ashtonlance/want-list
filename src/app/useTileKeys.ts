import { useEffect } from "react";
import {
  focusedTile,
  focusTile,
  neighbor,
  openTile,
  pageCovered,
  paneCard,
  tileOf,
  type Direction,
} from "~/lib/tiles";

const DIRECTIONS: Record<string, Direction> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

/**
 * The arrow keys on a desktop: from a card tile they move to the next one, left and right in reading
 * order, up and down by row. While the details pane is open they also show that card in it. They're
 * left alone in fields and controls, inside the pane, and while a sheet or the photo view is up.
 */
export function useTileKeys(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const dir = DIRECTIONS[e.key];
      if (!dir || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (pageCovered()) return;
      const shown = paneCard();
      const from =
        focusedTile() ??
        // Nothing in particular has focus (it was in the pane, say, and the pane changed): carry on from
        // the card the pane shows.
        (shown && document.activeElement === document.body ? tileOf(shown) : null);
      if (!from) return;
      const next = neighbor(from, dir);
      if (!next) return;
      e.preventDefault();
      if (shown && !document.body.classList.contains("selecting")) openTile(next);
      focusTile(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
