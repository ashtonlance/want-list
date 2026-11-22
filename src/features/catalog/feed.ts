import { numberSortKey } from "~/lib/format";
import { realPrice, type Catalog } from "./catalog";
import { inEra, type Era } from "./era";
import { fullArtCards } from "./rarity";

export type FeedLang = "en" | "jp" | "both";
export type FeedSort = "new" | "old" | "high" | "low";

export interface FeedOptions {
  lang: FeedLang;
  sort: FeedSort;
  /** Only cards priced at or under this, or 0 for any price. */
  cap: number;
  /** A rarity name, or "" for any. */
  rarity?: string;
  fullArt?: boolean;
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
  { lang, sort, cap, rarity = "", fullArt = false, era = "any" }: FeedOptions,
): number[] {
  const want = lang === "en" ? false : lang === "jp" ? true : null;
  const cs = cat.cards;
  const dates = sanitizedDates(cat);
  const rarityIdx = rarity ? cat.rarities.indexOf(rarity) : -1;
  const setInEra = cat.sets.map((s, i) => inEra(era === "soon" ? s.date : (dates[i] ?? ""), era));
  const art = fullArt ? fullArtCards(cat) : null;
  const idx: number[] = [];
  cs.forEach((c, i) => {
    const jp = cat.sets[c.set]?.jp ?? false;
    if (
      (want === null || jp === want) &&
      (!cap || (realPrice(c.market) && c.market <= cap)) &&
      (!rarity || c.rarity === rarityIdx) &&
      (!art || art.has(c)) &&
      setInEra[c.set]
    )
      idx.push(i);
  });
  const price = (i: number) => realPrice(cs[i]?.market ?? 0);
  if (sort === "high") return idx.sort((a, b) => price(b) - price(a));
  if (sort === "low") return idx.sort((a, b) => (price(a) || Infinity) - (price(b) || Infinity));
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
