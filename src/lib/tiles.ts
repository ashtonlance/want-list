import { prefersReducedMotion } from "./motion";

/**
 * Moving between card tiles from the keyboard and the desktop details pane. A tile is any element on
 * the screen with `data-sr` (its anchor id, lib/scroll.ts) whose `.card-open` button opens it: the list's
 * tiles and rows and Explore's cards. Everything is read from the page, so it follows whatever the grid
 * shows at the moment, sorted and filtered as it is.
 */

export type Direction = "left" | "right" | "up" | "down";

const OPEN = ":scope > .card-open";

/** Anything open over the page, like the photo view, a sheet or a menu; the details pane doesn't count. */
const COVERED = [
  "[role='dialog'][data-state='open']:not(.pane)",
  "[role='alertdialog'][data-state='open']",
  "[role='menu'][data-state='open']",
  "[role='listbox'][data-state='open']",
].join(", ");

/** Whether a sheet, menu or the photo view covers the page, so keys meant for the page leave it be. */
export const pageCovered = (): boolean => document.querySelector(COVERED) !== null;

/** Whether `el` takes typing: a field, a select or editable text. */
export const isField = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement && el.matches("input, textarea, select, [contenteditable='true']");

/** The tiles on the screen, in reading order. */
function tiles(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("main [data-sr]")].filter(
    (el) => el.querySelector(OPEN) !== null,
  );
}

/** The tile anchored as `id`, if it's drawn. */
export function tileOf(id: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`main [data-sr="${CSS.escape(id)}"]`);
  return el?.querySelector(OPEN) ? el : null;
}

/** The tile focus is on or inside (its photo button, say), if any. Never one with a field focused. */
export function focusedTile(): HTMLElement | null {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement) || isField(el)) return null;
  const tile = el.closest<HTMLElement>("main [data-sr]");
  return tile?.querySelector(OPEN) ? tile : null;
}

/**
 * The tile next to `from`: before or after it in reading order for left and right, and in the row above
 * or below, nearest across, for up and down. Rows are told apart by where each tile starts.
 */
export function neighbor(from: HTMLElement, dir: Direction): HTMLElement | null {
  const all = tiles();
  const at = all.indexOf(from);
  if (at < 0) return null;
  if (dir === "left") return all[at - 1] ?? null;
  if (dir === "right") return all[at + 1] ?? null;
  const r = from.getBoundingClientRect();
  const across = r.left + r.width / 2;
  let best: HTMLElement | null = null;
  let bestRow = Infinity;
  let bestAcross = Infinity;
  for (const el of all) {
    const q = el.getBoundingClientRect();
    const rowGap = dir === "down" ? q.top - r.top : r.top - q.top;
    if (rowGap < 4) continue;
    const off = Math.abs(q.left + q.width / 2 - across);
    // The nearest row first (allowing for tiles a few pixels apart), then the nearest tile in it.
    if (rowGap < bestRow - 4 || (Math.abs(rowGap - bestRow) <= 4 && off < bestAcross)) {
      best = el;
      bestRow = Math.min(rowGap, bestRow);
      bestAcross = off;
    }
  }
  return best;
}

/** Brings a tile into view and gives it focus, so the arrow keys carry on from it. */
export function focusTile(el: HTMLElement): void {
  el.querySelector<HTMLElement>(OPEN)?.focus({ preventScroll: true });
  el.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

/** Opens a tile, just as clicking it would. */
export function openTile(el: HTMLElement): void {
  el.querySelector<HTMLElement>(OPEN)?.click();
}

/** The desktop details pane, if one is open. */
export const paneOf = (): HTMLElement | null => document.querySelector<HTMLElement>(".pane[data-for]");

/** The card shown in the desktop details pane, if one is open. */
export const paneCard = (): string | undefined => paneOf()?.dataset.for;

/**
 * Shows the card next to the one in the details pane, and moves to its tile. Does nothing at either
 * end, or while cards are being selected (a click would select instead of opening).
 */
export function stepPane(dir: Direction): void {
  const id = paneCard();
  const from = id ? tileOf(id) : null;
  if (!from || document.body.classList.contains("selecting")) return;
  const next = neighbor(from, dir);
  if (!next) return;
  openTile(next);
  focusTile(next);
}
