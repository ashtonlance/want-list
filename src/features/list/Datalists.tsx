import { useMemo } from "react";
import { useCards } from "~/features/cards/api";
import { knownSets } from "~/features/cards/collections";
import { useCollections } from "~/features/cards/useCollections";

export const SET_LIST = "setList";
export const COLL_LIST = "collList";

/** Suggestions for set and collection fields anywhere in the app. */
export function Datalists() {
  const { cards } = useCards();
  const sets = useMemo(() => knownSets(cards), [cards]);
  const colls = useCollections().collections;
  return (
    <>
      <datalist id={SET_LIST}>
        {sets.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <datalist id={COLL_LIST}>
        {colls.map((c) => (
          <option key={c.name} value={c.name} />
        ))}
      </datalist>
    </>
  );
}
