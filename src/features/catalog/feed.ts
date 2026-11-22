import { numberSortKey } from "~/lib/format";
import { realPrice, type Catalog } from "./catalog";
import { inEra, type Era } from "./era";
import { lookCards, rarityTiers, type Look } from "./looks";

export type FeedLang = "en" | "jp" | "both";
export type FeedSort = "new" | "old" | "rare" | "high" | "low" | "name";

/** The feed's price filter: under a cap, or at or over a floor. */
export type FeedPrice = "any" | "u5" | "u25" | "u100" | "o25" | "o100" | "o500";

export const FEED_PRICE_OPTIONS: readonly { value: FeedPrice; label: string }[] = [
  { value: "any", label: "Any price" },
  { value: "u5", label: "Under $5" },
  { value: "u25", label: "Under $25" },
  { value: "u100", label: "Under $100" },
  { value: "o25", label: "$25 and up" },
  { value: "o100", label: "$100 and up" },
  { value: "o500", label: "$500 and up" },
];

/** A price filter as a cap and a floor, each 0 when unset. */
export function priceBand(p: FeedPrice): { cap: number; floor: number } {
  const n = Number(p.slice(1)) || 0;
  return p.startsWith("u") ? { cap: n, floor: 0 } : { cap: 0, floor: n };
}

export interface FeedOptions {
  lang: FeedLang;
  sort: FeedSort;
  /** Only cards priced at or under this, or 0 for any price. */
  cap: number;
  /** Only cards priced at or over this, or 0 for any price. */
  floor?: number;
  /** A rarity name, or "" for any. */
  rarity?: string;
  look?: Look;
  era?: Era;
}

/**
 * Sets are stored newest first per language, with undated promo groups at the end. A date that
 * breaks that order is a placeholder, so it's treated as undated and kept last.
 */
export function sanitizedDates(cat: Catalog): string[] {
  const low = ["9999", "9999"];
  return cat.sets.map((s) => {
    const lang = s.jp ? 1 : 0;
    const lowest = low[lang] ?? "9999";
    if (s.date && s.date <= lowest) {
      low[lang] = s.date;
      return s.date;
    }
    return "";
  });
}

/** The "Every card" feed: indexes into `cat.cards`, filtered and sorted. */
export function feedRows(
  cat: Catalog,
  { lang, sort, cap, floor = 0, rarity = "", look = "any", era = "any" }: FeedOptions,
): number[] {
  const want = lang === "en" ? false : lang === "jp" ? true : null;
  const cs = cat.cards;
  const dates = sanitizedDates(cat);
  const rarityIdx = rarity ? cat.rarities.indexOf(rarity) : -1;
  const setInEra = cat.sets.map((s, i) => inEra(era === "soon" ? s.date : (dates[i] ?? ""), era));
  const looks = lookCards(cat, look);
  const idx: number[] = [];
  cs.forEach((c, i) => {
    const jp = cat.sets[c.set]?.jp ?? false;
    if (
      (want === null || jp === want) &&
      (!cap || (realPrice(c.market) && c.market <= cap)) &&
      (!floor || realPrice(c.market) >= floor) &&
      (!rarity || c.rarity === rarityIdx) &&
      (!looks || looks.has(c)) &&
      setInEra[c.set]
    )
      idx.push(i);
  });
  const price = (i: number) => realPrice(cs[i]?.market ?? 0);
  if (sort === "high") return idx.sort((a, b) => price(b) - price(a));
  if (sort === "low") return idx.sort((a, b) => (price(a) || Infinity) - (price(b) || Infinity));
  if (sort === "name") {
    const { compare } = new Intl.Collator("en", { sensitivity: "base", numeric: true });
    // Blank-name promos ("______'s Pikachu") sort by the name that follows.
    const key = (i: number) => (cs[i]?.name ?? "").replace(/^[^\p{L}\p{N}]+/u, "");
    return idx.sort((a, b) => compare(key(a), key(b)) || price(b) - price(a));
  }
  if (sort === "rare") {
    const tiers = rarityTiers(cat);
    const tier = (i: number) => {
      const c = cs[i];
      return c ? (tiers.get(c) ?? 0) : 0;
    };
    return idx.sort((a, b) => tier(b) - tier(a) || price(b) - price(a));
  }
  const nk = new Map<number, number>();
  const n = (i: number) => {
    let v = nk.get(i);
    if (v === undefined) nk.set(i, (v = numberSortKey(cs[i]?.number)));
    return v;
  };
  const dir = sort === "old" ? -1 : 1;
  return idx.sort((a, b) => {
    const sa = cs[a]?.set ?? 0;
    const sb = cs[b]?.set ?? 0;
    const da = dates[sa] ?? "";
    const db = dates[sb] ?? "";
    return Number(!da) - Number(!db) || dir * db.localeCompare(da) || sa - sb || dir * (n(b) - n(a));
  });
}
