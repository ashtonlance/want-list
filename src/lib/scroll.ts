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
}

const isSpot = (v: unknown): v is Spot => isRecord(v) && typeof v.y === "number";

const STORE_KEY = "wl-scroll";
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
    if (r.bottom > top) return { id: el.dataset.sr, off: r.top, y, shown };
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
      const target = el ? window.scrollY + el.getBoundingClientRect().top - (spot.off ?? 0) : spot.y;
      const reachable = document.documentElement.scrollHeight - window.innerHeight >= target - 1;
      if (reachable || tries > 120) {
        window.scrollTo(0, Math.max(0, target));
        // Pictures above the anchor may still be loading; check again for a moment.
        if (el && tries < 20) {
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

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (restoring.current === activeKey.current) return;
        spots.set(activeKey.current, currentSpot(shownRef.current));
        persistSoon();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
}
