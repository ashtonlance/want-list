import { useState } from "react";
import { createPersistedStore } from "~/lib/store";

/** How many recently opened collections to remember. */
const KEEP = 30;

function parse(raw: string | null): readonly string[] {
  try {
    const v: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((n): n is string => typeof n === "string") : [];
  } catch {
    return [];
  }
}

/** Collections opened on this device, most recent first. Shared by My list and For you. */
const recent = createPersistedStore<readonly string[]>("wl-recent-colls", parse, (v) => JSON.stringify(v));

/** Notes that a collection was just opened, so its chip comes first next time. */
export function noteCollectionUse(name: string): void {
  const cur = recent.get();
  if (cur[0] === name) return;
  recent.set([name, ...cur.filter((n) => n !== name)].slice(0, KEEP));
}

/**
 * Puts recently used collections first, most recent first; the rest keep their order. Pure, so it's
 * easy to test.
 */
export function byRecentUse<T>(
  items: readonly T[],
  nameOf: (item: T) => string,
  used: readonly string[],
): T[] {
  const rank = new Map(used.map((n, i) => [n, i]));
  const at = (t: T) => rank.get(nameOf(t)) ?? Infinity;
  return items
    .map((t, i) => ({ t, i }))
    .sort((a, b) => at(a.t) - at(b.t) || a.i - b.i)
    .map(({ t }) => t);
}

/**
 * The recent order as it was when the screen opened. Taken once, so a chip doesn't jump to the front
 * under your finger; the new order shows on the next visit.
 */
export function useRecentCollections(): readonly string[] {
  const [used] = useState(() => recent.get());
  return used;
}
