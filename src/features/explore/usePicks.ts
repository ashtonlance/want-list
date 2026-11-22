import { useMemo } from "react";
import { useDocsQuery } from "~/data/useDocs";
import { useCards } from "~/features/cards/api";
import { usePrices } from "~/features/cards/prices";
import { useCatalog } from "~/features/catalog/catalog";
import { today } from "~/lib/format";
import { parsePick, withSyncedPrice, type PickCard } from "./picks";
import { refillPicks } from "./refill";
import { useCollections } from "~/features/cards/useCollections";

/** Every saved pick with today's synced prices, plus refill picks so no collection runs dry. */
export function usePicks(): { picks: PickCard[]; loaded: boolean } {
  const docs = useDocsQuery("discover");
  const prices = usePrices();
  const catalog = useCatalog();
  const { cards } = useCards();
  const { collections } = useCollections();
  const saved = useMemo(
    () => (docs.data ?? []).map((d) => withSyncedPrice(parsePick(d.id, d.data), prices.data)),
    [docs.data, prices.data],
  );
  const refill = useMemo(
    () =>
      catalog.data && docs.data
        ? refillPicks({
            catalog: catalog.data,
            cards,
            picks: saved,
            collections: collections.map((c) => c.name),
            day: today(),
          })
        : [],
    [catalog.data, docs.data, cards, saved, collections],
  );
  const picks = useMemo(() => [...saved, ...refill], [saved, refill]);
  return { picks, loaded: docs.data !== undefined && !catalog.isPending };
}
