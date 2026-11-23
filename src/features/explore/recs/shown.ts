import { isRecord, num, str } from "~/lib/json";
import { createPersistedStore } from "~/lib/store";
import type { KeptPick } from "../refill";
import type { PickCard } from "../picks";

/** Refill picks shown on a day. Saved, so reopening the app the same day shows the same picks. */
interface Shown {
  day: string;
  picks: KeptPick[];
}

function parse(raw: string | null): Shown {
  try {
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (!isRecord(v) || !Array.isArray(v.picks)) return { day: "", picks: [] };
    const picks = v.picks.flatMap((p): KeptPick[] => {
      if (!isRecord(p)) return [];
      const coll = str(p.coll);
      const pid = num(p.pid);
      return coll && pid ? [{ coll, pid, reason: str(p.reason) ?? "" }] : [];
    });
    return { day: str(v.day) ?? "", picks };
  } catch {
    return { day: "", picks: [] };
  }
}

export const shownStore = createPersistedStore<Shown>("poke-cards:shown-picks", parse, JSON.stringify);

const NONE: readonly KeptPick[] = Object.freeze([]);

/** The refill picks to keep today: those shown earlier today, oldest first. Stable when there are none. */
export const keptToday = (s: Shown, day: string): readonly KeptPick[] => (s.day === day ? s.picks : NONE);

/** Remembers the refill picks on screen, so a pass, an add or newly loaded art doesn't reshuffle them. */
export function rememberShown(picks: readonly PickCard[], day: string): void {
  shownStore.set((prev) => {
    const kept = prev.day === day ? prev.picks : [];
    const known = new Set(kept.map((k) => `${k.coll}|${String(k.pid)}`));
    const fresh = picks.flatMap((p): KeptPick[] =>
      p.auto && p.tcgProduct && !known.has(`${p.coll}|${String(p.tcgProduct)}`)
        ? [{ coll: p.coll, pid: p.tcgProduct, reason: p.reason }]
        : [],
    );
    return fresh.length || prev.day !== day ? { day, picks: [...kept, ...fresh] } : prev;
  });
}
