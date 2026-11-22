import {
  cleanCatalogName,
  rarityOf,
  realPrice,
  setOf,
  type Catalog,
  type CatalogCard,
} from "~/features/catalog/catalog";
import { fullArtCards } from "~/features/catalog/rarity";
import { pidOf } from "~/features/cards/pricing";
import type { Card } from "~/features/cards/types";
import { WILDCARDS, type PickCard } from "./picks";

/** Every collection keeps at least this many picks waiting for an answer. */
export const MIN_OPEN = 8;

/** At most this many refill picks of one Pokémon per collection, so a tab isn't twelve Gengars. */
const PER_SPECIES = 2;

/** Wildcards are fun, cheap full art cards. */
const WILD_PRICE: readonly [number, number] = [2, 50];

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

const stripZeros = (s: string) => s.replace(/^0+/, "").toLowerCase();
const keyOf = (name: string, number: string, set: string) =>
  `${cleanCatalogName(name).toLowerCase()}|${stripZeros(number)}|${set.toLowerCase()}`;

/** A small, stable hash so ties rotate from day to day instead of always showing the same cards. */
function dayHash(pid: number, day: string): number {
  let h = pid;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 2654435761) >>> 0;
  return h / 2 ** 32;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[Math.floor(s.length / 2)] ?? 0) : 0;
}

interface Profile {
  species: Set<string>;
  rarities: Set<string>;
  /** Price band seeds suggest, or null when none have a price. */
  band: readonly [number, number] | null;
  jp: boolean;
}

/** What a collection's cards and accepted picks have in common. */
function profileOf(seeds: readonly CatalogCard[], cat: Catalog): Profile {
  const prices = seeds.map((c) => realPrice(c.market)).filter((v) => v > 0);
  const mid = median(prices);
  return {
    species: new Set(seeds.flatMap((c) => speciesOf(c.name))),
    rarities: new Set(seeds.map((c) => rarityOf(cat, c)).filter(Boolean)),
    band: mid ? [mid * 0.2, Math.max(mid * 3, 15)] : null,
    jp: seeds.some((c) => setOf(cat, c).jp),
  };
}

/** What the scorer needs from each catalog card, worked out once per catalog rather than per collection. */
interface Meta {
  c: CatalogCard;
  species: string[];
  rarity: string;
  art: boolean;
  price: number;
  jp: boolean;
  date: string;
}

function metaOf(cat: Catalog): Meta[] {
  const art = fullArtCards(cat);
  return cat.cards.map((c) => {
    const rarity = rarityOf(cat, c);
    const set = setOf(cat, c);
    return {
      c,
      species: speciesOf(c.name),
      rarity,
      art: art.has(c),
      price: realPrice(c.market),
      jp: set.jp,
      date: set.date,
    };
  });
}

function score(m: Meta, p: Profile): number {
  const sameSpecies = m.species.some((s) => p.species.has(s));
  const sameRarity = p.rarities.has(m.rarity);
  if (!sameSpecies && !(sameRarity && m.art)) return 0;
  let s = (sameSpecies ? 4 : 0) + (sameRarity ? 2 : 0) + (m.art ? 1 : 0);
  if (p.band) {
    if (m.price >= p.band[0] && m.price <= p.band[1]) s += 1;
    else if (m.price > p.band[1] * 2) s -= 4;
  }
  return s;
}

function toPick(c: CatalogCard, cat: Catalog, coll: string, rank: number): PickCard {
  const set = setOf(cat, c);
  const price = realPrice(c.market);
  return {
    id: `auto:${coll}:${c.pid}`,
    name: cleanCatalogName(c.name),
    set: set.name,
    number: c.number,
    lang: set.jp ? "JP" : "EN",
    coll,
    status: "new",
    batch: 0,
    rank,
    tcgdexId: null,
    tcgProduct: c.pid,
    img: null,
    market: price || null,
    priceAsOf: cat.asOf,
    live: false,
    rarity: rarityOf(cat, c),
    illustrator: "",
    reason: coll === WILDCARDS ? "A fun full art card under $50" : `Like the cards in ${coll}`,
    auto: true,
  };
}

export interface RefillInput {
  catalog: Catalog;
  cards: readonly Card[];
  /** Picks already saved, from the discover table. */
  picks: readonly PickCard[];
  /** The list's collections, in tab order. */
  collections: readonly string[];
  /** Today's date; refill picks rotate daily. */
  day: string;
}

/**
 * Picks that top every collection back up to MIN_OPEN open picks, drawn from the full catalog:
 * the same Pokémon as the collection's cards, or the same full art rarities, near the same prices.
 * Nothing is saved until the card is added or passed on.
 */
export function refillPicks({ catalog: cat, cards, picks, collections, day }: RefillInput): PickCard[] {
  const metas = metaOf(cat);
  const byKey = new Map<string, CatalogCard>();
  for (const m of metas) byKey.set(keyOf(m.c.name, m.c.number, setOf(cat, m.c).name), m.c);
  const find = (pid: number | null, name: string, number: string, set: string) =>
    (pid != null ? cat.byPid.get(pid) : undefined) ?? byKey.get(keyOf(name, number, set));

  const listed = new Set<number>();
  for (const c of cards) {
    const hit = find(pidOf(c), c.name, c.number, c.set);
    if (hit) listed.add(hit.pid);
  }
  // Wildcards stay clear of every Pokémon the collections already cover.
  const collected = new Set(cards.filter((c) => c.collections.length).flatMap((c) => speciesOf(c.name)));

  const out: PickCard[] = [];
  // Never suggest a card that's already a pick anywhere, or twice across collections.
  const taken = new Set<number>();
  for (const p of picks) {
    const hit = find(p.tcgProduct, p.name, p.number, p.set);
    if (hit) taken.add(hit.pid);
  }

  for (const coll of [...collections, WILDCARDS]) {
    const saved = picks.filter((p) => p.coll === coll);
    const seen = new Set<number>([...listed, ...taken]);
    const open = saved.filter(
      (p) => p.status === "new" && !(p.tcgProduct && listed.has(p.tcgProduct)),
    ).length;
    const need = MIN_OPEN - open;
    if (need <= 0) continue;

    let ranked: Meta[];
    if (coll === WILDCARDS) {
      ranked = metas
        .filter(
          (m) =>
            !seen.has(m.c.pid) &&
            !m.jp &&
            m.art &&
            m.price >= WILD_PRICE[0] &&
            m.price <= WILD_PRICE[1] &&
            !m.species.some((s) => collected.has(s)),
        )
        .sort((a, b) => dayHash(a.c.pid, day) - dayHash(b.c.pid, day));
    } else {
      const seeds = [
        ...cards
          .filter((c) => c.collections.includes(coll))
          .map((c) => find(pidOf(c), c.name, c.number, c.set)),
        ...saved.filter((p) => p.status !== "passed").map((p) => find(p.tcgProduct, p.name, p.number, p.set)),
      ].filter((c): c is CatalogCard => c !== undefined);
      if (!seeds.length) continue;
      const profile = profileOf(seeds, cat);
      const scored: { m: Meta; s: number }[] = [];
      for (const m of metas) {
        if (seen.has(m.c.pid) || !m.price || (m.jp && !profile.jp)) continue;
        const s = score(m, profile);
        if (s > 0) scored.push({ m, s: s + dayHash(m.c.pid, day) });
      }
      scored.sort((a, b) => b.s - a.s || b.m.date.localeCompare(a.m.date));
      ranked = scored.map((x) => x.m);
    }

    const perSpecies = new Map<string, number>();
    let rank = 0;
    for (const m of ranked) {
      if (rank >= need) break;
      const sp = m.species[0] ?? m.c.name;
      const n = perSpecies.get(sp) ?? 0;
      if (n >= PER_SPECIES) continue;
      perSpecies.set(sp, n + 1);
      taken.add(m.c.pid);
      out.push(toPick(m.c, cat, coll, rank++));
    }
  }
  return out;
}
