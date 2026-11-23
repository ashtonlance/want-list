import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { WriteError } from "~/data/docs";
import { docKeys } from "~/data/keys";
import { useDocsQuery, useDocWrite } from "~/data/useDocs";
import { useAuth } from "~/features/auth/AuthProvider";
import { useCards } from "~/features/cards/api";
import { usePrices } from "~/features/cards/prices";
import { useCollections } from "~/features/cards/useCollections";
import { useCatalog } from "~/features/catalog/catalog";
import { today } from "~/lib/format";
import { useStore } from "~/lib/store";
import { parsePick, withSyncedPrice, type PickCard } from "./picks";
import { keptToday, shownStore } from "./recs/shown";
import { useArtIndex, useWarmedArt } from "./recs/useArtIndex";
import { artWarmup, offThemePicks, refillPicks, type RefillInput } from "./refill";

/**
 * Every saved pick with today's synced prices, but for waiting ones that no longer fit their collection
 * (those are deleted once an editor is signed in), plus refill picks so no collection runs dry.
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
  const hidden = useMemo(() => (input ? offThemePicks(input) : null), [input]);
  useDropPicks(hidden);
  const picks = useMemo(
    () => [...(hidden?.size ? saved.filter((p) => !hidden.has(p.id)) : saved), ...refill],
    [saved, hidden, refill],
  );
  return {
    picks,
    loaded: docs.data !== undefined && !catalog.isPending && (listLoaded || cardsFailed),
    // Refill picks were worked out from the whole list, not an empty one still loading.
    refilled: input !== null,
    day,
  };
}

/** Picks already sent for deleting, once each per visit, whichever screen asked first. */
const dropped = new Set<string>();

/**
 * Deletes waiting picks that no longer fit their collection (a Zekrom left in Mew & Mewtwo), when the
 * signed-in account can edit the list. They're hidden either way; a failed delete is tried again next visit.
 */
function useDropPicks(ids: ReadonlySet<string> | null): void {
  const { canWrite, markReadOnly } = useAuth();
  const { mutate } = useDocWrite("discover");
  const qc = useQueryClient();
  useEffect(() => {
    if (!canWrite || !ids) return;
    for (const id of ids)
      if (!dropped.has(id)) {
        dropped.add(id);
        mutate(
          { kind: "delete", id },
          {
            onError: (e) => {
              if (e instanceof WriteError && e.code === "denied") markReadOnly();
              // A failed delete puts back the table as it was before it, which may hold picks other
              // deletes have since removed; the server's copy settles it.
              void qc.invalidateQueries({ queryKey: docKeys.discover });
            },
          },
        );
      }
  }, [canWrite, ids, mutate, markReadOnly, qc]);
}
