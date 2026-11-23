import { numberSortKey } from "~/lib/format";
import { realPrice, type Catalog } from "./catalog";
import { inEra, type Era } from "./era";
import { textMatcher } from "~/lib/textSearch";
import { LOOK_OPTIONS, lookCards, rarityTiers, type Look } from "./looks";
import { sameName } from "./names";
import { hayOf, nameStartsWith } from "./search";

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
  /** Only cards whose name, set and number hold every word of this search. */
  q?: string;
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

/** Each card's place in an order of the whole catalog (lower comes first), worked out once per catalog. */
type Ranks = Uint32Array;

const rankCache = new WeakMap<Catalog, Map<string, Ranks>>();

/** A ranking kept per catalog under `name`, built the first time it's asked for. */
function cachedRanks(cat: Catalog, name: string, build: () => Ranks): Ranks {
  let byName = rankCache.get(cat);
  if (!byName) rankCache.set(cat, (byName = new Map<string, Ranks>()));
  let ranks = byName.get(name);
  if (!ranks) byName.set(name, (ranks = build()));
  return ranks;
}

/**
 * Newest (or oldest) sets first, then set order, then card number (cards with the same number share a
 * place). Undated sets go last either way. Only the few hundred sets are sorted as a whole; each set's
 * cards are sorted on their own, which is far quicker than one sort over the whole catalog.
 */
function dateRanks(cat: Catalog, dir: 1 | -1): Ranks {
  return cachedRanks(cat, dir === 1 ? "new" : "old", () => {
    const dates = sanitizedDates(cat);
    const setOrder = cat.sets
      .map((_, i) => i)
      .sort((a, b) => {
        const da = dates[a] ?? "";
        const db = dates[b] ?? "";
        // Plain string comparison orders ISO dates just as localeCompare does, only quicker.
        return Number(!da) - Number(!db) || (da === db ? 0 : da < db ? dir : -dir) || a - b;
      });
    const bySet = cat.sets.map((): number[] => []);
    cat.cards.forEach((c, i) => bySet[c.set]?.push(i));
    const num = cat.cards.map((c) => numberSortKey(c.number));
    const ranks = new Uint32Array(cat.cards.length);
    let next = 0;
    for (const set of setOrder) {
      const cards = (bySet[set] ?? []).sort((a, b) => dir * ((num[b] ?? 0) - (num[a] ?? 0)));
      let place = next;
      cards.forEach((card, i) => {
        const prev = cards[i - 1];
        if (prev !== undefined && num[prev] !== num[card]) place = next + i;
        ranks[card] = place;
      });
      next += cards.length;
    }
    return ranks;
  });
}

/**
 * A to Z by name, ignoring case and leading marks, so blank-name promos ("______'s Pikachu") sort by the
 * name. Collating is slow, so each distinct name is sorted once and its cards take its place.
 */
function nameRanks(cat: Catalog): Ranks {
  return cachedRanks(cat, "name", () => {
    const { compare } = new Intl.Collator("en", { sensitivity: "base", numeric: true });
    const keys = cat.cards.map((c) => c.name.replace(/^[^\p{L}\p{N}]+/u, ""));
    const names = [...new Set(keys)].sort(compare);
    const place = new Map<string, number>();
    names.forEach((name, i) => {
      const prev = names[i - 1];
      place.set(name, prev !== undefined && compare(prev, name) === 0 ? (place.get(prev) ?? i) : i);
    });
    return Uint32Array.from(keys, (k) => place.get(k) ?? 0);
  });
}

/** The last few feeds worked out, per catalog, so coming back to one (a tab, a cleared search) is instant. */
const feedCache = new WeakMap<Catalog, Map<string, readonly number[]>>();
const FEEDS_KEPT = 8;

/** The "Every card" feed: indexes into `cat.cards`, filtered and sorted. Don't change the array: it's shared. */
export function feedRows(cat: Catalog, options: FeedOptions): readonly number[] {
  const key = JSON.stringify([
    options.lang,
    options.sort,
    options.cap,
    options.floor ?? 0,
    options.rarity ?? "",
    options.look ?? "any",
    options.era ?? "any",
    options.q ?? "",
  ]);
  let feeds = feedCache.get(cat);
  if (!feeds) feedCache.set(cat, (feeds = new Map<string, readonly number[]>()));
  const hit = feeds.get(key);
  if (hit) {
    // Most recently used goes to the back, so the oldest is the one let go.
    feeds.delete(key);
    feeds.set(key, hit);
    return hit;
  }
  const rows = computeFeed(cat, options);
  feeds.set(key, rows);
  if (feeds.size > FEEDS_KEPT) feeds.delete(feeds.keys().next().value ?? "");
  return rows;
}

function computeFeed(
  cat: Catalog,
  { lang, sort, cap, floor = 0, rarity = "", look = "any", era = "any", q = "" }: FeedOptions,
): number[] {
  const want = lang === "en" ? false : lang === "jp" ? true : null;
  const cs = cat.cards;
  const dates = sanitizedDates(cat);
  const rarityIdx = rarity ? cat.rarities.findIndex((r) => sameName(r, rarity)) : -1;
  const setInEra = cat.sets.map((s, i) => inEra(era === "soon" ? s.date : (dates[i] ?? ""), era));
  const looks = lookCards(cat, look);
  const match = textMatcher(q);
  const hay = match ? hayOf(cat) : null;
  const idx: number[] = [];
  cs.forEach((c, i) => {
    const jp = cat.sets[c.set]?.jp ?? false;
    if (
      (want === null || jp === want) &&
      (!cap || (realPrice(c.market) && c.market <= cap)) &&
      (!floor || realPrice(c.market) >= floor) &&
      (!rarity || c.rarity === rarityIdx) &&
      (!looks || looks.has(c)) &&
      setInEra[c.set] &&
      (!match || match(hay?.[i] ?? ""))
    )
      idx.push(i);
  });
  const price = (i: number) => realPrice(cs[i]?.market ?? 0);
  if (sort === "high") return idx.sort((a, b) => price(b) - price(a));
  if (sort === "low") return idx.sort((a, b) => (price(a) || Infinity) - (price(b) || Infinity));
  if (sort === "name") {
    const rank = nameRanks(cat);
    return idx.sort((a, b) => (rank[a] ?? 0) - (rank[b] ?? 0) || price(b) - price(a));
  }
  if (sort === "rare") {
    const tiers = rarityTiers(cat);
    const tier = (i: number) => {
      const c = cs[i];
      return c ? (tiers.get(c) ?? 0) : 0;
    };
    return idx.sort((a, b) => tier(b) - tier(a) || price(b) - price(a));
  }
  const rank = dateRanks(cat, sort === "old" ? -1 : 1);
  // A search's newest-first list leads with the cards named what was typed.
  const starts = q && sort === "new" ? nameStartsWith(q) : null;
  if (!starts) return idx.sort((a, b) => (rank[a] ?? 0) - (rank[b] ?? 0));
  const lead = new Map<number, number>();
  for (const i of idx) {
    const c = cs[i];
    lead.set(i, c && starts(c) ? 1 : 0);
  }
  return idx.sort((a, b) => (lead.get(b) ?? 0) - (lead.get(a) ?? 0) || (rank[a] ?? 0) - (rank[b] ?? 0));
}

const lookCountCache = new WeakMap<Catalog, Map<FeedLang, ReadonlyMap<Look, number>>>();

/** How many cards in a language each look has, for the look chips. Worked out once per catalog and language. */
export function lookCounts(cat: Catalog, lang: FeedLang): ReadonlyMap<Look, number> {
  let byLang = lookCountCache.get(cat);
  if (!byLang) lookCountCache.set(cat, (byLang = new Map<FeedLang, ReadonlyMap<Look, number>>()));
  const cached = byLang.get(lang);
  if (cached) return cached;
  const want = lang === "en" ? false : lang === "jp" ? true : null;
  const inLang = (jp: boolean) => want === null || jp === want;
  const counts = new Map(
    LOOK_OPTIONS.map(({ value }) => {
      let n = 0;
      for (const c of lookCards(cat, value) ?? cat.cards) if (inLang(cat.sets[c.set]?.jp ?? false)) n++;
      return [value, n] as const;
    }),
  );
  byLang.set(lang, counts);
  return counts;
}

const rarityCache = new WeakMap<Catalog, readonly string[]>();

/** The catalog's rarity names, most common first. */
export function rarityNames(cat: Catalog): readonly string[] {
  const cached = rarityCache.get(cat);
  if (cached) return cached;
  const counts = new Map<number, number>();
  for (const c of cat.cards) counts.set(c.rarity, (counts.get(c.rarity) ?? 0) + 1);
  const names = [...counts.entries()]
    .map(([i, n]) => [cat.rarities[i] ?? "", n] as const)
    .filter(([name]) => name)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
  rarityCache.set(cat, names);
  return names;
}

/**
 * The work behind the filter sheet and the first search, as small steps to run when the phone is idle,
 * so opening the sheet or typing a first search finds it done.
 */
export function feedWarmUps(cat: Catalog, lang: FeedLang): (() => void)[] {
  return [
    ...LOOK_OPTIONS.map(
      ({ value }) =>
        () =>
          void lookCards(cat, value),
    ),
    () => void lookCounts(cat, lang),
    () => void rarityNames(cat),
    () => void hayOf(cat),
  ];
}
