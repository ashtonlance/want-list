import { prefs } from "~/app/prefs";
import { useCards } from "~/features/cards/api";
import { allCollections } from "~/features/cards/collections";
import { useStore } from "~/lib/store";
import { useMemo } from "react";

/** The collection the list is showing, or null for every card. A collection that no longer exists falls back to null. */
export function useActiveCollection(): string | null {
  const stored = useStore(prefs.coll);
  const { cards, loaded } = useCards();
  const names = useMemo(() => new Set(allCollections(cards).map((c) => c.name)), [cards]);
  if (!stored) return null;
  return !loaded || names.has(stored) ? stored : null;
}
