import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "~/data/keys";
import { isRecord, str } from "~/lib/json";
import { mergeNames, tidyRarity } from "./names";

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
  /** Index into the catalog's artists, or -1 when the artist isn't known. */
  artist: number;
}

/** catalog.json, rebuilt every day by the sync job: every English and Japanese card. */
export interface Catalog {
  asOf: string;
  sets: CatalogSet[];
  rarities: string[];
  /** Illustrators, from TCGdex; cards point at them by index. */
  artists: string[];
  cards: CatalogCard[];
  byPid: Map<number, CatalogCard>;
  /** Sets announced but not out yet, soonest first, whether or not their cards are listed yet. */
  upcoming: CatalogSet[];
}

export function parseCatalog(v: unknown): Catalog {
  if (!isRecord(v) || !Array.isArray(v.sets) || !Array.isArray(v.cards))
    throw new Error("catalog.json is malformed");
  const sets = v.sets.map((s): CatalogSet => {
    const a: unknown[] = Array.isArray(s) ? s : [];
    return {
      name: typeof a[0] === "string" ? a[0] : "",
      jp: Boolean(a[1]),
      date: typeof a[2] === "string" ? a[2] : "",
    };
  });
  const indexIn = (i: unknown, list: readonly string[]): number =>
    Number.isInteger(i) && (i as number) >= 0 && (i as number) < list.length ? (i as number) : -1;
  const rawRarities = Array.isArray(v.rarities) ? v.rarities.map((r) => String(r)) : [];
  const rawArtists = Array.isArray(v.artists) ? v.artists.map((a) => String(a)) : [];
  const cards: CatalogCard[] = [];
  const byPid = new Map<number, CatalogCard>();
  for (const r of v.cards) {
    if (!Array.isArray(r) || typeof r[0] !== "number" || typeof r[2] !== "number" || !sets[r[2]]) continue;
    const c: CatalogCard = {
      pid: r[0],
      name: String(r[1] ?? ""),
      set: r[2],
      number: String(r[3] ?? ""),
      rarity: indexIn(r[4], rawRarities),
      market: typeof r[5] === "number" ? r[5] : 0,
      artist: indexIn(r[6], rawArtists),
    };
    cards.push(c);
    byPid.set(c.pid, c);
  }
  // One filter choice per rarity and artist, however TCGplayer and TCGdex spell them.
  const uses = (field: "rarity" | "artist", n: number) => {
    const out = new Array<number>(n).fill(0);
    for (const c of cards) if (c[field] >= 0) out[c[field]] = (out[c[field]] ?? 0) + 1;
    return out;
  };
  const rar = mergeNames(rawRarities, uses("rarity", rawRarities.length), tidyRarity);
  const art = mergeNames(rawArtists, uses("artist", rawArtists.length));
  for (const c of cards) {
    if (c.rarity >= 0) c.rarity = rar.index[c.rarity] ?? -1;
    if (c.artist >= 0) c.artist = art.index[c.artist] ?? -1;
  }
  const rarities = rar.names;
  const artists = art.names;
  const upcoming = (Array.isArray(v.upcoming) ? v.upcoming : []).flatMap((s): CatalogSet[] => {
    const a: unknown[] = Array.isArray(s) ? s : [];
    return typeof a[0] === "string" && typeof a[2] === "string"
      ? [{ name: a[0], jp: Boolean(a[1]), date: a[2] }]
      : [];
  });
  return { asOf: str(v.asOf) ?? "", sets, rarities, artists, cards, byPid, upcoming };
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

export const setOf = (cat: Catalog, c: CatalogCard): CatalogSet =>
  cat.sets[c.set] ?? { name: "", jp: false, date: "" };
export const rarityOf = (cat: Catalog, c: CatalogCard): string => cat.rarities[c.rarity] ?? "";
export const artistOf = (cat: Catalog, c: CatalogCard): string => cat.artists[c.artist] ?? "";

/** TCGplayer shows $99,999.90 for listings with no real market; treat that as no price. */
export const realPrice = (v: number): number => (v > 0 && v < 99999 ? v : 0);

/** TCGplayer appends " - 12/34" to some names; the list doesn't. */
export const cleanCatalogName = (name: string): string => name.replace(/ - \d+\/\d+$/, "");
