import { useEffect } from "react";
import {
  focusedTile,
  focusTile,
  isField,
  neighbor,
  openTile,
  pageCovered,
  paneOf,
  tileOf,
} from "~/lib/tiles";
import { useOverlayNav } from "./overlayNav";

/** The quick actions a key presses, marked `data-act` on their buttons (features/explore). */
export type Act = "want" | "pass";

const ACTS: Record<string, Act> = { w: "want", W: "want", p: "pass", P: "pass" };

/** The screen's own search field, if it shows one. */
function pageSearch(): HTMLInputElement | null {
  const all = document.querySelectorAll<HTMLInputElement>("main input[type='search']");
  return [...all].find((el) => el.getClientRects().length > 0) ?? null;
}

/**
 * Presses `act` for the card in hand: the focused tile, or the card in the details pane when focus is
 * in it (or nowhere). The pane's own button comes first, so a pick goes to the collection picked there.
 * Then moves on to the next card, so a run of picks goes by key alone. Returns whether there was
 * anything to press.
 */
export function pressAct(act: Act): boolean {
  const pane = paneOf();
  const focus = document.activeElement;
  const inPane = pane !== null && (pane.contains(focus) || focus === document.body);
  const tile = inPane ? null : focusedTile();
  const id = tile?.dataset.sr ?? (inPane ? pane.dataset.for : undefined);
  if (!id) return false;
  const from = tile ?? tileOf(id);
  const button = [pane?.dataset.for === id ? pane : null, from]
    .map((s) => s?.querySelector<HTMLButtonElement>(`[data-act="${act}"]:not(:disabled)`))
    .find((b) => b != null);
  if (!button) return false;
  // Worked out before the press, which can redraw the grid or drop the card from it.
  const next = from ? (neighbor(from, "right") ?? neighbor(from, "left")) : null;
  button.click();
  if (next) {
    if (pane && !document.body.classList.contains("selecting")) openTile(next);
    focusTile(next);
  }
  return true;
}

/**
 * The desktop's keyboard shortcuts beyond the arrow keys (app/useTileKeys.ts): / goes to the screen's
 * search, ? lists the shortcuts, and W and P want or pass on a card in Explore. They're left alone while
 * typing and while a sheet or the photo view is up; Escape in an empty search field leaves it, so the
 * keys work again.
 */
export function useShortcuts(enabled: boolean): void {
  const { open } = useOverlayNav();
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (isField(e.target)) {
        // Before anything else: the details pane keeps Escape from closing it while a field has focus.
        const search = pageSearch();
        if (e.key === "Escape" && search && e.target === search && search.value === "") search.blur();
        return;
      }
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.isComposing || e.repeat) return;
      if (pageCovered()) return;
      if (e.key === "/") {
        const field = pageSearch();
        if (!field) return;
        e.preventDefault();
        field.focus();
        field.select();
      } else if (e.key === "?") {
        e.preventDefault();
        open({ panel: "keys" });
      } else {
        const act = ACTS[e.key];
        if (act && pressAct(act)) e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, open]);
}
