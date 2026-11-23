import type { Catalog } from "~/features/catalog/catalog";
import { matchSeeds, percentiles, rowOf, type ArtIndex, type ArtMatch } from "./art";
import { eraLabel, poolsOf, type CardFeatures } from "./features";
import {
  buildTaste,
  distributionAffinity,
  fitsTheme,
  identityAffinity,
  type Example,
  type Taste,
} from "./taste";

/**
 * How much each signal counts toward a pick's score. Identity signals (Pokémon, artist) and art likeness
 * outweigh rarity tier, era and price, so a plain Gengar doesn't beat an illustration rare by an artist
 * he collects. Each affinity runs from -1 to 1, so these are also each signal's most points.
 */
export const WEIGHTS = {
  species: 3,
  artist: 2.5,
  art: 2.5,
  /** Taken off when a card looks more like the picks he passed on than the cards he kept. */
  artPassed: 2,
  tier: 2,
  era: 1,
  band: 1.25,
} as const;

/** Below this a card isn't suggested at all... */
const MIN_SCORE = 1.5;
/**
 * ...except one of the Pokémon a collection is about and in its price range, which only needs this. Passes and an unusual era or
 * rarity still rank it lower, but a Mew collection shouldn't run out of Mew while Mew cards are left.
 */
const THEME_MIN_SCORE = 0;
/** A card of a Pokémon the collection is about counts at least this much for it, whatever passes say. */
const THEME_SPECIES = 0.6;
/** A card pricier than this many times the collection's priciest card loses points... */
const PRICE_STRETCH = 4;
const PRICE_PENALTY = 4;
/** ...unless it's under this much. */
const PRICE_FLOOR = 25;
/** Commons and uncommons are left out unless at least this share of a collection is commons. */
const COMMON_SHARE = 0.2;
/** Art likeness alone is a reason to suggest a card from this percentile up. */
const ART_ALONE = 0.95;
/** Points an artist, Pokémon or look must add to be named as the reason over rarity or era. */
const SPECIFIC_REASON = 0.75;
/** A Pokémon or artist on at least this share of a collection's cards may fill more than the usual share of picks. */
const MOSTLY = 0.3;
/** At most this many cards' fingerprints stand for a collection, newest first. */
const MAX_SEEDS = 16;

export type ReasonKind = "artist" | "species" | "art" | "tier" | "era" | "plain";

export interface Scored {
  f: CardFeatures;
  score: number;
  kind: ReasonKind;
  /**
   * Caps the refill can lift: a Pokémon or artist making up a good part of the collection (MOSTLY) may
   * fill more than the usual share of picks.
   */
  uncapped: { species: boolean; artist: boolean };
  /** The reason line, e.g. "Art by Mitsuhiro Arita, like 3 cards in Spooky"; worded only for cards that become picks. */
  explain: () => string;
}

/** A small, stable hash so ties rotate from day to day instead of always showing the same cards. */
export function dayHash(pid: number, day: string): number {
  let h = pid;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 2654435761) >>> 0;
  return h / 2 ** 32;
}

const rowsCache = new WeakMap<ArtIndex, WeakMap<Catalog, Int32Array>>();

/** Each catalog card's row in the art index (-1 for none), worked out once per index and catalog. */
export function artRows(index: ArtIndex, cat: Catalog, features: readonly CardFeatures[]): Int32Array {
  let byCat = rowsCache.get(index);
  if (!byCat) rowsCache.set(index, (byCat = new WeakMap<Catalog, Int32Array>()));
  const hit = byCat.get(cat);
  if (hit) return hit;
  const rows = Int32Array.from(features, (f) => rowOf(index, f.c.pid));
  byCat.set(cat, rows);
  return rows;
}

interface SeedMatch extends ArtMatch {
  /** Percentile of a blended likeness score among all fingerprinted cards. */
  rank: (v: number) => number;
  /** Percentile of a closest-card likeness among all fingerprinted cards. */
  rankTop: (v: number) => number;
}
const matchCache = new WeakMap<ArtIndex, Map<string, SeedMatch>>();

/**
 * matchSeeds plus percentile rankings, remembered for the same seeds, so a pass in one collection
 * only redoes that collection's passed picks.
 */
function seedMatch(index: ArtIndex, seeds: readonly number[]): SeedMatch {
  let byKey = matchCache.get(index);
  if (!byKey) matchCache.set(index, (byKey = new Map<string, SeedMatch>()));
  const key = seeds.join(",");
  const hit = byKey.get(key);
  if (hit) return hit;
  const m = matchSeeds(index, seeds);
  const out = { ...m, rank: percentiles(m.score), rankTop: percentiles(m.top) };
  if (byKey.size > 64) byKey.clear();
  byKey.set(key, out);
  return out;
}

/** What the art index knows about a collection's look, or null with no fingerprints. */
export interface ArtTaste {
  seeds: readonly CardFeatures[];
  match: SeedMatch;
  /** For every row, its likeness to the closest passed pick, or null when nothing was passed. */
  passed: Float32Array | null;
}

export function artTaste(
  index: ArtIndex | null | undefined,
  rows: Int32Array | null,
  byPid: ReadonlyMap<number, number>,
  liked: readonly CardFeatures[],
  passed: readonly CardFeatures[],
): ArtTaste | null {
  if (!index || !rows) return null;
  const rowsOf = (fs: readonly CardFeatures[]) => {
    const out: { f: CardFeatures; row: number }[] = [];
    for (const f of fs) {
      const at = byPid.get(f.c.pid);
      const row = at === undefined ? -1 : (rows[at] ?? -1);
      if (row >= 0 && out.length < MAX_SEEDS) out.push({ f, row });
    }
    return out;
  };
  const seeds = rowsOf(liked);
  if (!seeds.length) return null;
  const passedRows = rowsOf(passed).map((s) => s.row);
  return {
    seeds: seeds.map((s) => s.f),
    match: seedMatch(
      index,
      seeds.map((s) => s.row),
    ),
    passed: passedRows.length ? seedMatch(index, passedRows).top : null,
  };
}

/**
 * For one row: its likeness percentile, how much closer it sits to a passed pick than to a kept card
 * (both ranked on the same closest-card scale, 0 when it's closer to a kept one), and its closest kept card.
 */
function artSignal(art: ArtTaste | null, row: number) {
  if (!art || row < 0) return null;
  const like = art.match.rank(art.match.score[row] ?? 0);
  const kept = art.match.rankTop(art.match.top[row] ?? 0);
  const passed = art.passed ? art.match.rankTop(art.passed[row] ?? 0) : 0;
  return { like, passedMore: Math.max(0, passed - kept), seed: art.seeds[art.match.closest[row] ?? 0] };
}

const cardsWord = (n: number) => (n === 1 ? "1 card" : `${String(n)} cards`);
const titleCase = (s: string) =>
  s.replace(/(^|[\s-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());

export interface CollectionInput {
  coll: string;
  examples: readonly Example[];
  /** Every catalog card's features, in catalog order. */
  features: readonly CardFeatures[];
  art: ArtTaste | null;
  /** Each catalog card's row in the art index, in catalog order. */
  rows: Int32Array | null;
  day: string;
}

/** Every candidate worth suggesting for a collection, best first, each with the reason it was picked. */
export function rankForCollection({ coll, examples, features, art, rows, day }: CollectionInput): Scored[] {
  const taste = buildTaste(examples, coll);
  if (!taste.yes) return [];
  const jpOk = examples.some((e) => e.weight > 0 && e.f.jp);
  const commonsOk = taste.commonShare >= COMMON_SHARE;
  const out: Scored[] = [];
  const pools = poolsOf(features);
  for (const i of commonsOk ? pools.priced : pools.rare) {
    const f = features[i];
    if (!f || (f.jp && !jpOk)) continue;
    const s = scoreCard(f, taste, artSignal(art, rows ? (rows[i] ?? -1) : -1), coll);
    if (!s) continue;
    s.score += 0.3 * dayHash(f.c.pid, day);
    out.push(s);
  }
  return out.sort((a, b) => b.score - a.score || b.f.date.localeCompare(a.f.date));
}

function scoreCard(
  f: CardFeatures,
  t: Taste,
  art: ReturnType<typeof artSignal>,
  coll: string,
): Scored | null {
  // In a collection about its Pokémon (Mew & Mewtwo), only those Pokémon are picks, and they always count.
  const { theme } = t;
  if (!fitsTheme(theme, f)) return null;
  const onTheme = theme !== null;
  let species = 0;
  let speciesName = "";
  for (const s of f.species) {
    if (theme && !theme.has(s)) continue;
    const a = identityAffinity(t, "species", s);
    if (a > species || !speciesName) {
      species = a;
      speciesName = s;
    }
  }
  if (onTheme) species = Math.max(species, THEME_SPECIES);
  const artist = identityAffinity(t, "artist", f.artist);
  // A card needs a real reason: its Pokémon, its artist, its look, or the collection's kind of full art.
  // Checked before anything else, since most of the catalog has none.
  const named = species > 0 || artist > 0 || (art !== null && art.like >= ART_ALONE);
  if (!named && f.tier < 3) return null;
  const tier = distributionAffinity(t, "tier", f.tier);
  const era = distributionAffinity(t, "era", f.era);
  if (!named && (tier < 0.6 || era < 0.5)) return null;
  const band = distributionAffinity(t, "band", f.band);

  const parts: Record<Exclude<ReasonKind, "plain">, number> = {
    species: WEIGHTS.species * species,
    artist: WEIGHTS.artist * artist,
    art: art ? WEIGHTS.art * (2 * art.like - 1) : 0,
    tier: WEIGHTS.tier * tier,
    era: WEIGHTS.era * era,
  };
  let score = parts.species + parts.artist + parts.art + parts.tier + parts.era + WEIGHTS.band * band;
  if (art) score -= WEIGHTS.artPassed * art.passedMore;
  const pricey = t.maxPrice > 0 && f.price > Math.max(t.maxPrice * PRICE_STRETCH, PRICE_FLOOR);
  if (pricey) score -= PRICE_PENALTY;
  if (score < (onTheme && !pricey ? THEME_MIN_SCORE : MIN_SCORE)) return null;

  // The reason names the most specific signal that counts for something: an artist, a Pokémon or a look
  // says more than "an illustration rare", so those win unless they barely count.
  // An artist or Pokémon is named only when a card he listed or added has it, not just a suggestion.
  const counted = (k: keyof typeof parts) =>
    k === "artist"
      ? (t.artistCount.get(f.artist) ?? 0) > 0
      : k === "species"
        ? (t.speciesCount.get(speciesName) ?? 0) > 0
        : true;
  const best = (ks: (keyof typeof parts)[]) =>
    ks.filter((k) => parts[k] > 0 && counted(k)).sort((a, b) => parts[b] - parts[a])[0];
  const specific = best(["artist", "species", "art"]);
  const kind: ReasonKind =
    (specific && parts[specific] >= SPECIFIC_REASON ? specific : best(["tier", "era"])) ??
    specific ??
    "plain";
  const seed = art?.seed;
  const mostly = (n: number | undefined) => (n ?? 0) >= t.kept * MOSTLY;
  const uncapped = {
    // The Pokémon the refill's cap counts the card under. A collection about one Pokémon has no other to share with.
    species: theme?.size === 1 || mostly(t.speciesCount.get(f.species[0] ?? "")),
    // One card by an artist isn't a theme yet.
    artist: t.kept >= 2 && mostly(t.artistCount.get(f.artist)),
  };
  return { f, score, kind, uncapped, explain: () => reasonFor(kind, f, t, coll, speciesName, seed) };
}

function reasonFor(
  kind: ReasonKind,
  f: CardFeatures,
  t: Taste,
  coll: string,
  species: string,
  seed: CardFeatures | undefined,
): string {
  switch (kind) {
    case "artist":
      return `Art by ${f.artist}, like ${cardsWord(t.artistCount.get(f.artist) ?? 0)} in ${coll}`;
    case "species":
      return `Another ${titleCase(species)}, like ${cardsWord(t.speciesCount.get(species) ?? 0)} in ${coll}`;
    case "art":
      return seed ? `Looks like your ${seed.name}` : `Looks like the cards in ${coll}`;
    case "tier":
      return `${f.rarity || "Full art"}, like most of ${coll}`;
    case "era":
      return `${eraLabel(f.era)} era, like most of ${coll}`;
    case "plain":
      return `Like the cards in ${coll}`;
  }
}

/** Wildcards are fun, cheap full art cards. */
export const WILD_PRICE: readonly [number, number] = [2, 50];

export interface WildInput {
  /** Every card on the list and every added pick, anywhere. */
  liked: readonly Example[];
  /** Wildcard picks he passed on. */
  passed: readonly Example[];
  features: readonly CardFeatures[];
  /** Pokémon the collections already cover, which Wildcards stay clear of. */
  collected: ReadonlySet<string>;
  art: ArtTaste | null;
  rows: Int32Array | null;
  day: string;
}

const CAPPED = { species: false, artist: false } as const;
const WILD_REASON = `A fun full art card under $${String(WILD_PRICE[1])}`;

/**
 * Wildcards: cheap English full art of Pokémon he doesn't collect, mostly a daily shuffle, nudged toward
 * artists and looks he likes and away from what he passed on.
 */
export function rankWildcards({ liked, passed, features, collected, art, rows, day }: WildInput): Scored[] {
  const taste = buildTaste([...liked, ...passed]);
  const out: Scored[] = [];
  for (const i of poolsOf(features).fullArt) {
    const f = features[i];
    if (!f || f.jp || f.price < WILD_PRICE[0] || f.price > WILD_PRICE[1]) continue;
    if (f.species.some((s) => collected.has(s))) continue;
    const sig = artSignal(art, rows ? (rows[i] ?? -1) : -1);
    const artist = identityAffinity(taste, "artist", f.artist);
    const species = Math.min(0, ...f.species.map((s) => identityAffinity(taste, "species", s)));
    const look = sig ? 2 * sig.like - 1 : 0;
    const score =
      2 * dayHash(f.c.pid, day) +
      1.5 * artist +
      1.5 * look -
      1.5 * (sig?.passedMore ?? 0) +
      WEIGHTS.species * species;
    const drew = taste.artistCount.get(f.artist) ?? 0;
    const seed = sig && sig.like >= 0.9 ? sig.seed : undefined;
    if (artist > 0 && drew > 0 && artist >= look) {
      out.push({
        f,
        score,
        kind: "artist",
        uncapped: CAPPED,
        explain: () => `Art by ${f.artist}, who drew ${cardsWord(drew)} you collect`,
      });
    } else if (seed) {
      out.push({ f, score, kind: "art", uncapped: CAPPED, explain: () => `Looks like your ${seed.name}` });
    } else {
      out.push({ f, score, kind: "plain", uncapped: CAPPED, explain: () => WILD_REASON });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}
