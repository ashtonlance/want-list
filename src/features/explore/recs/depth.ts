import { isRecord, num } from "~/lib/json";
import { createPersistedStore } from "~/lib/store";
import { ALL_PICKS } from "../search";

/**
 * How far down each For You tab he has scrolled today, as the number of open picks it shows per
 * collection. Saved, so a tab comes back as long as he left it, and a pick far down still opens after a
 * reload. A new day starts every tab from the top again.
 */
interface Depth {
  day: string;
  tabs: Readonly<Record<string, number>>;
}

function parse(raw: string | null): Depth {
  try {
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!isRecord(v) || typeof v.day !== "string" || !isRecord(v.tabs)) return { day: "", tabs: {} };
    const tabs: Record<string, number> = {};
    for (const [k, n] of Object.entries(v.tabs)) {
      const d = num(n);
      if (d && d > 0) tabs[k] = d;
    }
    return { day: v.day, tabs };
  } catch {
    return { day: "", tabs: {} };
  }
}

export const depthStore = createPersistedStore<Depth>("poke-cards:picks-depth", parse, JSON.stringify);

const NONE: Readonly<Record<string, number>> = Object.freeze({});

/** Each tab's depth today; stable while nothing has been scrolled. */
export const depthToday = (s: Depth, day: string): Readonly<Record<string, number>> =>
  s.day === day ? s.tabs : NONE;

/**
 * Shows `step` more picks per collection in a tab than the `from` it shows now, up to `max`. Asking twice
 * from the same depth adds one page, not two.
 */
export function showDeeper(tab: string, day: string, from: number, step: number, max: number): void {
  depthStore.set((prev) => {
    const tabs = prev.day === day ? prev.tabs : {};
    if ((tabs[tab] ?? 0) > from) return prev;
    const next = Math.min(from + step, max);
    return next === tabs[tab] ? prev : { day, tabs: { ...tabs, [tab]: next } };
  });
}

/** How many open picks a collection shows: as far as its own tab or "All picks" was scrolled, whichever is further. */
export const depthOf = (tabs: Readonly<Record<string, number>>, coll: string): number =>
  Math.max(tabs[coll] ?? 0, tabs[ALL_PICKS] ?? 0);
