import { useEffect, useLayoutEffect, useRef } from "react";
import { isRecord } from "./json";
import { storage } from "./storage";

/**
 * Scroll restoration per view. Each view has a key (a collection, a search, a binder); leaving and
 * coming back, or reopening the app within two hours (as when the phone closed it in the background),
 * lands on the same card.
 *
 * The position is anchored to the first card on screen (any element with `data-sr`), not just a pixel
 * offset, so it survives images loading at different heights. Elements carry their own ids in `data-sr`.
 */

interface Spot {
  /** The anchor card's id and its distance from the top of the window. */
  id?: string;
  off?: number;
  /** Window scroll, for views without anchors or when the anchor is gone. */
  y: number;
  /** How many rows an endless list had loaded, so it can load as many again before restoring. */
  shown?: number;
  /** The anchor's place in a list that only draws the rows near the screen (see `findRowsWith`). */
  item?: number;
}

const isSpot = (v: unknown): v is Spot =>
  isRecord(v) &&
  typeof v.y === "number" &&
  (v.item === undefined || (typeof v.item === "number" && Number.isInteger(v.item) && v.item >= 0));

/**
 * Lists that only draw the rows near the screen (ui/VirtualGrid), by scroll key: where the row holding
 * an item starts on the page, so an anchor that isn't drawn yet can be scrolled to and then found.
 * Such a list marks each row with `data-item`, the place of the row's first item.
 */
const rowFinders = new Map<string, (item: number) => number | undefined>();

/** Tells restoration where the row holding each of `key`'s items starts; returns the undo. */
export function findRowsWith(key: string, find: (item: number) => number | undefined): () => void {
  rowFinders.set(key, find);
  return () => {
    if (rowFinders.get(key) === find) rowFinders.delete(key);
  };
}

/** An anchor's place in a list marked with `data-item` rows, or undefined in any other list. */
function itemOf(el: HTMLElement): number | undefined {
  const row = el.closest<HTMLElement>("[data-item]");
  let tile: Element = el;
  while (row && tile.parentElement && tile.parentElement !== row) tile = tile.parentElement;
  const first = Number(row?.dataset.item);
  const at = row ? Array.prototype.indexOf.call(row.children, tile) : -1;
  return Number.isInteger(first) && at >= 0 ? first + at : undefined;
}

const STORE_KEY = "wl-scroll";
/** How long scrolling has to pause before the position is saved. */
const SAVE_IDLE_MS = 120;
const TTL = 2 * 60 * 60_000;

function loadSpots(): Map<string, Spot> {
  try {
    const raw: unknown = JSON.parse(storage.get(STORE_KEY) ?? "null");
    if (raw && typeof raw === "object" && "t" in raw && "pos" in raw) {
      const { t, pos } = raw;
      if (typeof t === "number" && Date.now() - t < TTL && isRecord(pos)) {
        return new Map(Object.entries(pos).flatMap(([k, v]) => (isSpot(v) ? [[k, v] as const] : [])));
      }
    }
  } catch {
    /* unreadable: start fresh */
  }
  return new Map();
}

const spots = loadSpots();
let persistTimer: ReturnType<typeof setTimeout> | undefined;

function persist(): void {
  clearTimeout(persistTimer);
  storage.set(STORE_KEY, JSON.stringify({ t: Date.now(), pos: Object.fromEntries(spots) }));
}

function persistSoon(): void {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persist, 250);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", persist);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) persist();
  });
}

/** Forgets the positions saved for every view whose key starts with `prefix`, so they open at the top. */
export function forgetScroll(prefix: string): void {
  for (const key of [...spots.keys()]) if (key.startsWith(prefix)) spots.delete(key);
  persistSoon();
}

/** How many rows an endless list had loaded when it was last seen under `key`. */
export const savedRowCount = (key: string): number | undefined => spots.get(key)?.shown;

/** The topmost anchor visible below the sticky top bar. */
function currentSpot(shown: number | undefined): Spot {
  const top = (document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0) + 4;
  const y = window.scrollY;
  for (const el of document.querySelectorAll<HTMLElement>("[data-sr]")) {
    const r = el.getBoundingClientRect();
    if (r.bottom > top) {
      const item = itemOf(el);
      return { id: el.dataset.sr, off: r.top, y, shown, ...(item === undefined ? {} : { item }) };
    }
  }
  return { y, shown };
}

function findAnchor(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-sr="${CSS.escape(id)}"]`);
}

/**
 * Restores the scroll position saved for `key` once `ready` (the view's content is on screen),
 * and keeps saving it while the person scrolls. `shown` is the endless list's loaded row count.
 */
export function useScrollRestoration(key: string, ready: boolean, shown?: number): void {
  const restoring = useRef<string | null>(null);
  const activeKey = useRef(key);
  const shownRef = useRef(shown);

  useLayoutEffect(() => {
    shownRef.current = shown;
  });

  // A new view: stop saving until its own position is back.
  useLayoutEffect(() => {
    activeKey.current = key;
    restoring.current = key;
  }, [key]);

  useEffect(() => {
    if (!ready || restoring.current !== key) return;
    const spot = spots.get(key);
    let frame = 0;
    let tries = 0;
    let cancelled = false;
    const done = () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (restoring.current === key) restoring.current = null;
      for (const ev of ["touchstart", "wheel", "keydown"] as const) window.removeEventListener(ev, done);
    };
    for (const ev of ["touchstart", "wheel", "keydown"] as const)
      window.addEventListener(ev, done, { passive: true });
    const attempt = () => {
      if (cancelled) return;
      if (!spot) {
        window.scrollTo(0, 0);
        done();
        return;
      }
      const el = spot.id ? findAnchor(spot.id) : null;
      // An anchor not drawn yet: head for its row, where it'll be drawn and found on a later try.
      const rowTop = !el && spot.item !== undefined ? rowFinders.get(key)?.(spot.item) : undefined;
      const target = el
        ? window.scrollY + el.getBoundingClientRect().top - (spot.off ?? 0)
        : rowTop !== undefined
          ? rowTop - (spot.off ?? 0)
          : spot.y;
      const reachable = document.documentElement.scrollHeight - window.innerHeight >= target - 1;
      if (reachable || tries > 120) {
        window.scrollTo(0, Math.max(0, target));
        // Pictures above the anchor may still be loading, or (in a grid that only draws the rows near the
        // screen) the anchor's row is only drawn once scrolled to: check again for a moment.
        if ((el || spot.id) && tries < 20) {
          tries += 1;
          frame = requestAnimationFrame(attempt);
          return;
        }
        done();
        return;
      }
      tries += 1;
      frame = requestAnimationFrame(attempt);
    };
    attempt();
    return done;
  }, [key, ready]);

  // Saved once scrolling pauses rather than every frame: finding the anchor reads the layout, which
  // mid-fling would force the browser to lay the page out again on every frame. Leaving the view with
  // a save still due makes it at once, while the old screen is still there to read.
  useLayoutEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      timer = undefined;
      if (restoring.current === activeKey.current) return;
      spots.set(activeKey.current, currentSpot(shownRef.current));
      persistSoon();
    };
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(save, SAVE_IDLE_MS);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timer !== undefined) {
        clearTimeout(timer);
        save();
      }
    };
  }, []);
}
