import { useQueries, useQuery } from "@tanstack/react-query";
import { queryKeys } from "~/data/keys";
import { tcgImage } from "~/lib/images";
import {
  artistOf,
  cleanCatalogName,
  rarityOf,
  realPrice,
  setOf,
  useCatalog,
  type Catalog,
  type CatalogCard,
} from "~/features/catalog/catalog";
import { fetchTdCard, fetchTdSetCards, fetchTdSets, type LiveCard } from "./tcgdex";

const HOUR = 60 * 60_000;

/** A catalog printing shown like a live card, so the same sheet and tiles work for both. */
export function catalogLiveCard(cat: Catalog, c: CatalogCard): LiveCard {
  const st = setOf(cat, c);
  return {
    id: `cat:${c.pid}`,
    name: c.name,
    set: st.name,
    setId: "",
    number: c.number,
    rarity: rarityOf(cat, c),
    illustrator: artistOf(cat, c),
    img: tcgImage(c.pid),
    pid: c.pid,
    market: realPrice(c.market) || null,
    low: null,
    upd: cat.asOf,
    jp: st.jp,
  };
}

export function useTdSets() {
  return useQuery({ queryKey: queryKeys.tdSets, queryFn: fetchTdSets, staleTime: 6 * HOUR });
}

const liveCardQuery = (id: string) => ({
  queryKey: queryKeys.tdCard(id),
  queryFn: () => fetchTdCard(id),
  staleTime: HOUR,
});

/**
 * One card's live details. Catalog ids ("cat:123") are read from the catalog instead.
 * `missing` is true once the catalog has loaded without that printing.
 */
export function useLiveCard(id: string | null) {
  const isCat = id?.startsWith("cat:") ?? false;
  const catalog = useCatalog(isCat);
  const td = useQuery({ ...liveCardQuery(id ?? ""), enabled: id !== null && !isCat });
  if (!isCat) return { card: td.data ?? null, failed: td.isError, missing: false };
  const pid = Number(id?.slice(4));
  const row = catalog.data?.byPid.get(pid);
  return {
    card: row && catalog.data ? catalogLiveCard(catalog.data, row) : null,
    failed: catalog.isError,
    missing: catalog.data !== undefined && !row,
  };
}

/** Live details for many cards at once (eight requests at a time), as a map by id, plus the ids that failed. */
export function useLiveCards(ids: readonly string[], enabled = true) {
  return useQueries({
    queries: ids.map((id) => ({ ...liveCardQuery(id), enabled })),
    combine: (results) => {
      const map = new Map<string, LiveCard>();
      const failed = new Set<string>();
      let settled = 0;
      results.forEach((r, i) => {
        const id = ids[i];
        if (r.data && id) map.set(id, r.data);
        if (r.isError && id) failed.add(id);
        if (r.data || r.isError) settled++;
      });
      return { map, failed, settled };
    },
  });
}

/** One set's cards, from TCGdex. Searches run over the daily catalog instead (catalog/feed.ts). */
export function useTdSetCards(set: string) {
  const sets = useTdSets();
  return useQuery({
    queryKey: queryKeys.tdList("set:" + set),
    enabled: sets.data !== undefined,
    staleTime: HOUR,
    queryFn: () => fetchTdSetCards(set),
  });
}

/** The list's own name, set and number for a catalog printing, so cards added different ways match. */
export function catalogIdentity(cat: Catalog | undefined, card: LiveCard) {
  const row = card.pid != null ? cat?.byPid.get(card.pid) : undefined;
  if (!row || !cat) return { name: card.name, set: card.set, number: card.number, jp: card.jp };
  const st = setOf(cat, row);
  return { name: cleanCatalogName(row.name), set: st.name, number: row.number, jp: st.jp };
}
