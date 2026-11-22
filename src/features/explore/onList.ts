import { pidOf } from "~/features/cards/pricing";
import type { Card } from "~/features/cards/types";
import type { LiveCard } from "./tcgdex";

type Wanted = Pick<LiveCard, "pid" | "name" | "number" | "set">;

const strip = (s: string) => s.replace(/^0+/, "").toLowerCase();
const keyOf = (name: string, number: string, set: string) =>
  `${name.toLowerCase()}|${strip(number)}|${set.toLowerCase()}`;

/**
 * The same answer as `findOnList`, built once for a grid of thousands of tiles: the first card on the
 * list with the same TCGplayer product, or the same name, number and set.
 */
export function listLookup(cards: readonly Card[]): (d: Wanted) => Card | null {
  const byPid = new Map<number, number>();
  const byKey = new Map<string, number>();
  cards.forEach((c, i) => {
    const pid = pidOf(c);
    if (pid != null && !byPid.has(pid)) byPid.set(pid, i);
    const k = keyOf(c.name, c.number, c.set);
    if (!byKey.has(k)) byKey.set(k, i);
  });
  return (d) => {
    const a = d.pid != null ? byPid.get(d.pid) : undefined;
    const b = byKey.get(keyOf(d.name, d.number, d.set));
    const i = a === undefined ? b : b === undefined ? a : Math.min(a, b);
    return i === undefined ? null : (cards[i] ?? null);
  };
}
