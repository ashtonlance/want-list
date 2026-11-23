import { numberTag, textMatcher } from "~/lib/textSearch";
import { priceOf } from "./pricing";
import type { Card } from "./types";

export type StatusFilter = "want" | "got" | "all";
export type ListSort = "list" | "old" | "low" | "high" | "set" | "name";

export const LIST_SORTS: { value: ListSort; label: string }[] = [
  { value: "list", label: "Newest added" },
  { value: "old", label: "Oldest added" },
  { value: "low", label: "Price: low to high" },
  { value: "high", label: "Price: high to low" },
  { value: "set", label: "Set" },
  { value: "name", label: "Name" },
];

export interface ListFilter {
  status: StatusFilter;
  /** Only this collection's cards, or every card when null. */
  coll: string | null;
  prio: boolean;
  q: string;
  sort: ListSort;
}

const SORTS: Record<ListSort, (a: Card, b: Card) => number> = {
  list: (a, b) => b.addedAt.localeCompare(a.addedAt) || (a.order ?? 1e9) - (b.order ?? 1e9),
  old: (a, b) => a.addedAt.localeCompare(b.addedAt) || (b.order ?? 0) - (a.order ?? 0),
  low: (a, b) => (priceOf(a) ?? Infinity) - (priceOf(b) ?? Infinity),
  high: (a, b) => (priceOf(b) ?? -1) - (priceOf(a) ?? -1),
  set: (a, b) => a.set.localeCompare(b.set) || (parseInt(a.number) || 0) - (parseInt(b.number) || 0),
  name: (a, b) => a.name.localeCompare(b.name),
};

const haystack = (c: Card): string =>
  [
    c.name,
    c.set,
    c.number.split("/")[0] ?? "",
    numberTag(c.number),
    c.variant,
    c.note,
    c.lang === "JP" ? "japanese" : "",
    ...c.collections,
  ]
    .join(" ")
    .toLowerCase();

/**
 * The cards to show. A search looks through wanted and collected cards alike, since "do I have this
 * already?" is the question it's usually asking; the collection still narrows it.
 */
export function visibleCards(cards: readonly Card[], f: ListFilter): Card[] {
  const match = textMatcher(f.q);
  return cards
    .filter(
      (c) =>
        (match !== null || f.status === "all" || c.status === f.status) &&
        (!f.coll || c.collections.includes(f.coll)) &&
        (!f.prio || c.priority) &&
        (!match || match(haystack(c))),
    )
    .sort(SORTS[f.sort]);
}
