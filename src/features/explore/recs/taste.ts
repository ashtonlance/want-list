import type { CardFeatures } from "./features";

/**
 * What a collection's cards say about taste, learned from examples: cards on the list and picks he
 * added count for a card's features, picks he passed on count against them.
 *
 * Two kinds of feature:
 * - Identity (the Pokémon, the artist): any match counts, more matches count more.
 *   affinity = (yes - no) / (yes + no + 1.5), so one add is 0.4, three adds 0.67, one pass -0.4.
 *   A pass counts a quarter as much against a Pokémon or artist the collection already has, and never
 *   enough to turn it negative: passing on Mew cards in a Mew collection says something about those cards
 *   (their look, era or price, which still count), not about Mew.
 * - Distribution (rarity tier, era, price band): how typical the value is of the adds, relative to the
 *   most typical one, less however much more typical it is of the passes (weighted by the passes' share).
 *   Neighbouring tiers, eras and price bands count half, so one band over still scores.
 */
export type IdentityFamily = "species" | "artist";
export type DistributionFamily = "tier" | "era" | "band";

interface Counts {
  yes: Map<string | number, number>;
  no: Map<string | number, number>;
  /** The largest smoothed weight on each side, for distribution families; worked out once per taste. */
  topYes: number;
  topNo: number;
}

export interface Example {
  f: CardFeatures;
  /** 1 for a card he wants or has, -1 for a pick he passed on; smaller for weaker signals. */
  weight: number;
}

export interface Taste {
  identity: Record<IdentityFamily, Counts>;
  distribution: Record<DistributionFamily, Counts>;
  /** Total weight of examples for and against. */
  yes: number;
  no: number;
  /** Plain counts of the listed and added cards' artists and Pokémon, for the reason line. */
  artistCount: Map<string, number>;
  speciesCount: Map<string, number>;
  /** How many listed and added cards there are. */
  kept: number;
  /** The highest price among the positive examples, or 0. */
  maxPrice: number;
  /** Share of the positive examples that are commons or uncommons (tier 0). */
  commonShare: number;
}

const counts = (): Counts => ({ yes: new Map(), no: new Map(), topYes: 0, topNo: 0 });
const bump = (m: Map<string | number, number>, k: string | number, w: number) => {
  m.set(k, (m.get(k) ?? 0) + w);
};

export function buildTaste(examples: readonly Example[]): Taste {
  const t: Taste = {
    identity: { species: counts(), artist: counts() },
    distribution: { tier: counts(), era: counts(), band: counts() },
    yes: 0,
    no: 0,
    artistCount: new Map(),
    speciesCount: new Map(),
    kept: 0,
    maxPrice: 0,
    commonShare: 0,
  };
  let commons = 0;
  for (const { f, weight } of examples) {
    if (!weight) continue;
    const side = weight > 0 ? "yes" : "no";
    const w = Math.abs(weight);
    t[side] += w;
    for (const s of new Set(f.species)) bump(t.identity.species[side], s, w);
    if (f.artist) bump(t.identity.artist[side], f.artist, w);
    bump(t.distribution.tier[side], f.tier, w);
    if (f.era >= 0) bump(t.distribution.era[side], f.era, w);
    if (f.band >= 0) bump(t.distribution.band[side], f.band, w);
    if (weight > 0) {
      t.maxPrice = Math.max(t.maxPrice, f.price);
      if (f.tier === 0) commons += w;
    }
    // Only cards he listed or added are counted by name; a suggestion's weight is below 1.
    if (weight >= 1) {
      t.kept++;
      if (f.artist) t.artistCount.set(f.artist, (t.artistCount.get(f.artist) ?? 0) + 1);
      for (const s of new Set(f.species)) t.speciesCount.set(s, (t.speciesCount.get(s) ?? 0) + 1);
    }
  }
  t.commonShare = t.yes ? commons / t.yes : 0;
  for (const c of Object.values(t.distribution)) {
    c.topYes = topOf(c.yes);
    c.topNo = topOf(c.no);
  }
  return t;
}

const SMOOTH = 1.5;
/** How much a pass counts against a Pokémon or artist that cards he kept also have... */
const PASS_WHEN_KEPT = 0.25;
/** ...and at most, as a share of those cards, so passes can lower a collection's own Pokémon but never turn it against it. */
const KEPT_FLOOR = 0.5;

/** -1 to 1: how much he likes cards with this Pokémon or artist. */
export function identityAffinity(t: Taste, family: IdentityFamily, value: string): number {
  if (!value) return 0;
  const c = t.identity[family];
  const yes = c.yes.get(value) ?? 0;
  const passes = c.no.get(value) ?? 0;
  const kept = (family === "species" ? t.speciesCount : t.artistCount).get(value) ?? 0;
  const no = kept > 0 ? Math.min(passes * PASS_WHEN_KEPT, yes * KEPT_FLOOR) : passes;
  return (yes - no) / (yes + no + SMOOTH);
}

/** A value's weight plus half of each neighbour's. */
function smoothed(m: Map<string | number, number>, v: number): number {
  return (m.get(v) ?? 0) + 0.5 * ((m.get(v - 1) ?? 0) + (m.get(v + 1) ?? 0));
}

function topOf(m: Map<string | number, number>): number {
  let top = 0;
  for (const k of m.keys()) if (typeof k === "number") top = Math.max(top, smoothed(m, k));
  return top;
}

/** -1 to 1: how typical this tier, era or price band is of what he adds, less what he passes on instead. */
export function distributionAffinity(t: Taste, family: DistributionFamily, value: number): number {
  if (value < 0) return 0;
  const c = t.distribution[family];
  const yes = c.topYes ? smoothed(c.yes, value) / c.topYes : 0;
  const no = c.topNo ? smoothed(c.no, value) / c.topNo : 0;
  // Passes count only where they're more typical than the adds (passing on cards of the collection's own
  // rarity or era says nothing against it), and by their share of the examples, so one pass among many
  // adds barely counts.
  const against = t.no / (t.no + t.yes);
  return yes - against * Math.max(0, no - yes);
}
