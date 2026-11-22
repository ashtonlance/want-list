import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "~/data/keys";
import { isRecord, str } from "~/lib/json";

export interface CatalogSet {
  name: string;
  jp: boolean;
  /** Release date (YYYY-MM-DD), or "" when TCGplayer doesn't give one. */
  date: string;
}

/** One printing from TCGplayer's catalog. `set` and `rarity` index into the catalog's lists. */
export interface CatalogCard {
  pid: number;
  name: string;
  set: number;
  number: string;
  rarity: number;
  /** TCGplayer market price, or 0 when there isn't one. */
  market: number;
}

/** catalog.json, rebuilt every day by the sync job: every English and Japanese card. */
export interface Catalog {
  asOf: string;
  sets: CatalogSet[];
  rarities: string[];
  cards: CatalogCard[];
  byPid: Map<number, CatalogCard>;
}

export function parseCatalog(v: unknown): Catalog {
  if (!isRecord(v) || !Array.isArray(v.sets) || !Array.isArray(v.cards)) throw new Error("catalog.json is malformed");
  const sets = v.sets.map((s): CatalogSet => {
    const a: unknown[] = Array.isArray(s) ? s : [];
    return { name: String(a[0] ?? ""), jp: Boolean(a[1]), date: typeof a[2] === "string" ? a[2] : "" };
  });
  const rarities = Array.isArray(v.rarities) ? v.rarities.map((r) => String(r)) : [];
  const cards: CatalogCard[] = [];
  const byPid = new Map<number, CatalogCard>();
  for (const r of v.cards) {
    if (!Array.isArray(r) || typeof r[0] !== "number" || typeof r[2] !== "number" || !sets[r[2]]) continue;
    const c: CatalogCard = {
      pid: r[0],
      name: String(r[1] ?? ""),
      set: r[2],
      number: String(r[3] ?? ""),
      rarity: typeof r[4] === "number" ? r[4] : -1,
      market: typeof r[5] === "number" ? r[5] : 0,
    };
    cards.push(c);
    byPid.set(c.pid, c);
  }
  return { asOf: str(v.asOf) ?? "", sets, rarities, cards, byPid };
}

async function fetchCatalog(): Promise<Catalog> {
  const r = await fetch(import.meta.env.BASE_URL + "catalog.json");
  if (!r.ok) throw new Error(`catalog.json: HTTP ${r.status}`);
  return parseCatalog(await r.json());
}

export const catalogQuery = {
  queryKey: queryKeys.catalog,
  queryFn: fetchCatalog,
  staleTime: Infinity,
  gcTime: Infinity,
} as const;

/** The catalog is large and changes once a day, so it loads only when a screen needs it, then stays. */
export function useCatalog(enabled = true) {
  return useQuery({ ...catalogQuery, enabled });
}

export const setOf = (cat: Catalog, c: CatalogCard): CatalogSet => cat.sets[c.set] ?? { name: "", jp: false, date: "" };
export const rarityOf = (cat: Catalog, c: CatalogCard): string => cat.rarities[c.rarity] ?? "";

/** TCGplayer shows $99,999.90 for listings with no real market; treat that as no price. */
export const realPrice = (v: number): number => (v > 0 && v < 99999 ? v : 0);

/** TCGplayer appends " - 12/34" to some names; the list doesn't. */
export const cleanCatalogName = (name: string): string => name.replace(/ - \d+\/\d+$/, "");
