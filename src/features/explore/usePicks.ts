import { useMemo } from "react";
import { useDocsQuery } from "~/data/useDocs";
import { useCards } from "~/features/cards/api";
import { usePrices } from "~/features/cards/prices";
import { useCollections } from "~/features/cards/useCollections";
import { useCatalog } from "~/features/catalog/catalog";
import { today } from "~/lib/format";
import { useStore } from "~/lib/store";
import { parsePick, withSyncedPrice, type PickCard } from "./picks";
import { keptToday, shownStore } from "./recs/shown";
import { useArtIndex, useWarmedArt } from "./recs/useArtIndex";
import { artWarmup, refillPicks, type RefillInput } from "./refill";

/**
 * Every saved pick with today's synced prices, plus refill picks so no collection runs dry.
 * Refill picks show from the catalog alone; art fingerprints sharpen the ones that fill later gaps.
 */
export function usePicks(): { picks: PickCard[]; loaded: boolean; refilled: boolean; day: string } {
  const docs = useDocsQuery("discover");
  const prices = usePrices();
  const catalog = useCatalog();
  const { cards, failed: cardsFailed } = useCards();
  const { collections, loaded: listLoaded } = useCollections();
  const day = today();
  const shown = useStore(shownStore);
  const keep = keptToday(shown, day);
  const saved = useMemo(
    () => (docs.data ?? []).map((d) => withSyncedPrice(parsePick(d.id, d.data), prices.data)),
    [docs.data, prices.data],
  );
  const input = useMemo(
    (): RefillInput | null =>
      catalog.data && docs.data && listLoaded
        ? {
            catalog: catalog.data,
            cards,
            picks: saved,
            collections: collections.map((c) => c.name),
            day,
            keep,
          }
        : null,
    [catalog.data, docs.data, listLoaded, cards, saved, collections, day, keep],
  );
  const art = useWarmedArt(useArtIndex(), input, artWarmup);
  const refill = useMemo(() => (input ? refillPicks({ ...input, art }) : []), [input, art]);
  const picks = useMemo(() => [...saved, ...refill], [saved, refill]);
  return {
    picks,
    loaded: docs.data !== undefined && !catalog.isPending && (listLoaded || cardsFailed),
    // Refill picks were worked out from the whole list, not an empty one still loading.
    refilled: input !== null,
    day,
  };
}
