import {
  artistOf,
  cleanCatalogName,
  rarityOf,
  realPrice,
  setOf,
  type Catalog,
  type CatalogCard,
} from "~/features/catalog/catalog";
import { rarityTiers } from "~/features/catalog/looks";
import { fullArtCards } from "~/features/catalog/rarity";

const FORM_WORDS = new Set([
  "ex",
  "gx",
  "v",
  "vmax",
  "vstar",
  "break",
  "lv.x",
  "prime",
  "legend",
  "δ",
  "☆",
  "star",
]);
// Era words, regional forms, and an owner like "Team Rocket's" or "Misty's".
const PREFIXES =
  /^(?:(?:mega|dark|light|shining|radiant|shadow|alolan|galarian|hisuian|paldean)\s+|(?:[\w.]+\s+)*?[\w.]+['’]s\s+)+/;

/** The Pokémon a card shows: "Mega Gengar ex" is gengar, "Umbreon & Darkrai GX" is umbreon and darkrai. */
export function speciesOf(name: string): string[] {
  return cleanCatalogName(name)
    .toLowerCase()
    .split(/\s*&\s*/)
    .map((part) =>
      part
        .replace(PREFIXES, "")
        .split(/\s+/)
        .filter((w) => w && !FORM_WORDS.has(w))
        .join(" ")
        .replace(/-gx$/, ""),
    )
    .filter(Boolean);
}

/**
 * The game's eras, by English release date. Japanese sets come out a few months earlier, so their
 * dates are moved forward before the lookup.
 */
const ERAS: readonly { from: string; label: string }[] = [
  { from: "", label: "Wizards" },
  { from: "2003-06-18", label: "EX" },
  { from: "2007-05-23", label: "Diamond & Pearl" },
  { from: "2010-02-10", label: "HeartGold SoulSilver" },
  { from: "2011-04-25", label: "Black & White" },
  { from: "2014-02-05", label: "XY" },
  { from: "2017-02-03", label: "Sun & Moon" },
  { from: "2020-02-07", label: "Sword & Shield" },
  { from: "2023-03-31", label: "Scarlet & Violet" },
  { from: "2025-09-26", label: "Mega Evolution" },
];
const JP_LEAD_DAYS = 120;

/** The era index for a set's release date, or -1 when the date isn't known. */
export function eraOf(date: string, jp: boolean): number {
  if (!date) return -1;
  let d = date;
  if (jp) {
    const t = new Date(date + "T00:00:00Z");
    t.setUTCDate(t.getUTCDate() + JP_LEAD_DAYS);
    d = t.toISOString().slice(0, 10);
  }
  let era = 0;
  ERAS.forEach((e, i) => {
    if (d >= e.from) era = i;
  });
  return era;
}

export const eraLabel = (era: number): string => ERAS[era]?.label ?? "";

/** Price bands, a few dollars apart at the bottom and further apart higher up. */
const BAND_EDGES = [2, 5, 15, 40, 100, 300];

/** 0 for under $2 up to 6 for $300 and over, or -1 with no price. */
export const priceBand = (price: number): number =>
  price > 0 ? BAND_EDGES.filter((edge) => price >= edge).length : -1;

/** Everything the recommender looks at on one catalog card. */
export interface CardFeatures {
  c: CatalogCard;
  name: string;
  species: string[];
  rarity: string;
  /** 4 for gold, secret and special art down to 0 for commons (see rarityTiers). */
  tier: number;
  fullArt: boolean;
  artist: string;
  era: number;
  price: number;
  band: number;
  jp: boolean;
  date: string;
}

const cache = new WeakMap<Catalog, CardFeatures[]>();

/** Features for every catalog card, worked out once per catalog. */
export function catalogFeatures(cat: Catalog): CardFeatures[] {
  const hit = cache.get(cat);
  if (hit) return hit;
  const art = fullArtCards(cat);
  const tiers = rarityTiers(cat);
  const out = cat.cards.map((c): CardFeatures => {
    const set = setOf(cat, c);
    const price = realPrice(c.market);
    return {
      c,
      name: cleanCatalogName(c.name),
      species: speciesOf(c.name),
      rarity: rarityOf(cat, c),
      tier: tiers.get(c) ?? 0,
      fullArt: art.has(c),
      artist: artistOf(cat, c),
      era: eraOf(set.date, set.jp),
      price,
      band: priceBand(price),
      jp: set.jp,
      date: set.date,
    };
  });
  cache.set(cat, out);
  return out;
}

/** Catalog positions of the cards each ranker looks at, so a ranking pass skips the rest without a look. */
export interface Pools {
  /** Every card with a price. */
  priced: number[];
  /** Priced cards above common and uncommon. */
  rare: number[];
  /** Priced full art cards. */
  fullArt: number[];
}

const poolCache = new WeakMap<readonly CardFeatures[], Pools>();

export function poolsOf(features: readonly CardFeatures[]): Pools {
  const hit = poolCache.get(features);
  if (hit) return hit;
  const out: Pools = { priced: [], rare: [], fullArt: [] };
  features.forEach((f, i) => {
    if (!f.price) return;
    out.priced.push(i);
    if (f.tier > 0) out.rare.push(i);
    if (f.fullArt) out.fullArt.push(i);
  });
  poolCache.set(features, out);
  return out;
}
