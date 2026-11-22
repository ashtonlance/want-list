import { useMemo } from "react";
import { prefs } from "~/app/prefs";
import { useCollections } from "~/features/cards/useCollections";
import { useStore } from "~/lib/store";

/** The collection the list is showing, or null for every card. A collection that no longer exists falls back to null. */
export function useActiveCollection(): string | null {
  const stored = useStore(prefs.coll);
  const { collections, loaded } = useCollections();
  const names = useMemo(() => new Set(collections.map((c) => c.name)), [collections]);
  if (!stored) return null;
  return !loaded || names.has(stored) ? stored : null;
}
