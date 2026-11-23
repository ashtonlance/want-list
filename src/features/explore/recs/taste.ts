import type { CardFeatures } from "./features";
import evolutions from "./families.json";

/**
 * What a collection's cards say about taste, learned from examples: cards on the list and picks he
 * added count for a card's features, picks he passed on count against them.
 *
 * A collection is about its Pokémon when its name names them (Mew & Mewtwo, Ninetales), or up to three
 * evolution lines are on most of its cards (a Gengar line). Picks for it then stay with those Pokémon and
 * what they evolve from and into: Ninetales takes Vulpix, Umbreon takes Eevee.
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
  /** The Pokémon the collection is about, as speciesKey keys, or null when it's about something else (see pokemonTheme). */
  theme: ReadonlySet<string> | null;
  /** How many evolution lines the theme holds; 0 without one. */
  themeLines: number;
  /** The highest price among the positive examples, or 0. */
  maxPrice: number;
  /** Share of the positive examples that are commons or uncommons (tier 0). */
  commonShare: number;
}

const counts = (): Counts => ({ yes: new Map(), no: new Map(), topYes: 0, topNo: 0 });
const bump = (m: Map<string | number, number>, k: string | number, w: number) => {
  m.set(k, (m.get(k) ?? 0) + w);
};

/** A collection's taste, from its examples, and the Pokémon it's about, if any (see pokemonTheme). */
export function buildTaste(examples: readonly Example[], theme: ReadonlySet<string> | null = null): Taste {
  const t: Taste = {
    identity: { species: counts(), artist: counts() },
    distribution: { tier: counts(), era: counts(), band: counts() },
    yes: 0,
    no: 0,
    artistCount: new Map(),
    speciesCount: new Map(),
    kept: 0,
    theme,
    themeLines: theme ? new Set([...theme].map(baseOf)).size : 0,
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

/** A collection needs this many listed or added cards before its cards alone say it's about its Pokémon. */
const THEME_MIN_CARDS = 3;
/** An evolution line is one it's about when it's on this many of its cards and this share... */
const THEME_LINE_CARDS = 2;
const THEME_LINE_SHARE = 0.2;
/** ...and it's about at most this many lines, together on at least this share of its cards. */
const THEME_MAX_LINES = 3;
const THEME_SHARE = 0.75;
/** The longest Pokémon name, in words (Tapu Koko, Mr. Mime Jr.). */
const NAME_WORDS = 4;
/** A name decides once the Pokémon it names are on at least this share of the collection's cards. */
const NAMED_SHARE = 0.5;

/** A name as words, lower case, letters and digits only, so "Mr Mime" and "Mr. Mime" read the same. */
const words = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\d]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

/** Every card's Pokémon is keyed on each ranking, so keys are kept; there are a few thousand names. */
const keyCache = new Map<string, string>();

/**
 * A Pokémon as one key: lower case, accents off, letters and digits only, ♀ and ♂ as f and m, so "Mr. Mime"
 * is mrmime and "Nidoran ♀" and "nidoran (f)" are both nidoranf. Matches tools/pokedex.mjs.
 */
export function speciesKey(s: string): string {
  let k = keyCache.get(s);
  if (k === undefined) {
    k = s
      .toLowerCase()
      .replace(/♀/g, "f")
      .replace(/♂/g, "m")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
    keyCache.set(s, k);
  }
  return k;
}
const evolvesFrom = new Map(evolutions as [string, string][]);
const evolvesInto = new Map<string, string[]>();
for (const [to, from] of evolvesFrom) evolvesInto.set(from, [...(evolvesInto.get(from) ?? []), to]);

/** The first Pokémon of a key's evolution line: vulpix for ninetales, eevee for umbreon. */
function baseOf(k: string): string {
  let at = k;
  for (let up = evolvesFrom.get(at); up !== undefined; up = evolvesFrom.get(at)) at = up;
  return at;
}

/**
 * These keys and what each evolves from and into, but not its cousins: Umbreon takes Eevee, not Vaporeon;
 * Eevee takes all eight.
 */
export function withLines(keys: Iterable<string>): Set<string> {
  const out = new Set<string>();
  const down: string[] = [];
  for (const k of keys) {
    for (let up = evolvesFrom.get(k); up !== undefined; up = evolvesFrom.get(up)) out.add(up);
    down.push(k);
  }
  // Down from every key, even one an earlier key's line already passed through (Vileplume, then Oddish).
  const seen = new Set(down);
  for (let next = down.pop(); next !== undefined; next = down.pop()) {
    out.add(next);
    for (const into of evolvesInto.get(next) ?? [])
      if (!seen.has(into)) {
        seen.add(into);
        down.push(into);
      }
  }
  return out;
}

/** Pokémon by their names as words; one key may stand for spellings like "nidoran f" and "nidoran (f)". */
export type KnownSpecies = ReadonlyMap<string, readonly string[]>;

function speciesIndex(lists: Iterable<readonly string[]>): KnownSpecies {
  const out = new Map<string, string[]>();
  for (const list of lists)
    for (const s of list) {
      const key = words(s).join(" ");
      const at = out.get(key);
      if (!at) out.set(key, [s]);
      else if (!at.includes(s)) at.push(s);
    }
  return out;
}

const knownCache = new WeakMap<object, KnownSpecies>();

/** Every Pokémon the cards show, for finding the ones a collection's name names; worked out once per catalog. */
export function knownSpecies(features: readonly { species: readonly string[] }[]): KnownSpecies {
  let hit = knownCache.get(features);
  if (!hit) knownCache.set(features, (hit = speciesIndex(features.map((f) => f.species))));
  return hit;
}

/** The keys of the known Pokémon a collection's name names, longest name first: black kyurem, not also kyurem. */
function namedSpecies(coll: string, known: KnownSpecies): Set<string> {
  const w = words(coll);
  const out = new Set<string>();
  for (let i = 0; i < w.length;) {
    let n = Math.min(NAME_WORDS, w.length - i);
    for (; n > 0; n--) {
      const hit = known.get(w.slice(i, i + n).join(" "));
      if (hit) {
        for (const s of hit) out.add(speciesKey(s));
        break;
      }
    }
    i += Math.max(n, 1);
  }
  return out;
}

/**
 * The Pokémon a collection is about, as speciesKey keys, with what they evolve from and into (see
 * withLines), or null for one whose picks may be any Pokémon.
 * - Named: the Pokémon its name names, once their lines are on at least half its cards, so "Mew & Mewtwo"
 *   is about Mew and Mewtwo, and only them, whatever else it picks up, and "Ninetales" takes Vulpix. A
 *   name that mentions a Pokémon without being about it ("Lillie's Pokémon") leaves the cards to decide.
 * - From its cards: up to three evolution lines on most of them, like Gastly, Haunter and Gengar in a Gengar
 *   line; with too few cards to tell, many Pokémon (Kanto Starters) or a look (Forest), none.
 * Where its cards show a line, the Pokémon its name names that are on its cards join it.
 * `known` lists the Pokémon its name may name (see knownSpecies); without it, only those on its cards.
 */
export function pokemonTheme(
  coll: string,
  examples: readonly Example[],
  known?: KnownSpecies,
): ReadonlySet<string> | null {
  const keptCards = examples.filter((e) => e.weight >= 1);
  const kept = keptCards.map((e) => new Set(e.f.species.map(speciesKey)));
  const fromCards = cardTheme(kept);
  const named = withLines(namedSpecies(coll, known ?? speciesIndex(keptCards.map((e) => e.f.species))));
  const withNamed = kept.filter((ks) => [...ks].some((k) => named.has(k))).length;
  if (!withNamed) return fromCards;
  if (withNamed >= kept.length * NAMED_SHARE) {
    // Lines its cards show besides the named ones join them (Mewtwo cards in "Mew"), but within a named
    // line the name decides: Eevee cards in "Umbreon" don't bring in Vaporeon.
    const namedLines = new Set([...named].map(baseOf));
    const cardLines = new Set(fromCards ? [...fromCards].map(baseOf) : []);
    if (!fromCards || ![...namedLines].every((l) => cardLines.has(l))) return named;
    for (const k of fromCards) if (!namedLines.has(baseOf(k))) named.add(k);
    return named;
  }
  if (!fromCards) return null;
  // Not enough to decide, but a named Pokémon on its cards still belongs with the lines they show.
  const onCards = kept.flatMap((ks) => [...ks].filter((k) => named.has(k)));
  for (const k of withLines(onCards)) fromCards.add(k);
  return fromCards;
}

/** The evolution lines most of a collection's cards share, as its cards alone tell (see pokemonTheme). */
function cardTheme(kept: readonly ReadonlySet<string>[]): Set<string> | null {
  if (kept.length < THEME_MIN_CARDS) return null;
  const lines = kept.map((ks) => new Set([...ks].map(baseOf)));
  const count = new Map<string, number>();
  for (const ls of lines) for (const l of ls) count.set(l, (count.get(l) ?? 0) + 1);
  const theme = new Set(
    [...count]
      .filter(([, n]) => n >= THEME_LINE_CARDS && n >= kept.length * THEME_LINE_SHARE)
      .map(([l]) => l),
  );
  if (!theme.size || theme.size > THEME_MAX_LINES) return null;
  const covered = lines.filter((ls) => [...ls].some((l) => theme.has(l))).length;
  if (covered < kept.length * THEME_SHARE) return null;
  // The Pokémon on its cards from those lines, with what they evolve from and into.
  return withLines(kept.flatMap((ks) => [...ks].filter((k) => theme.has(baseOf(k)))));
}

/** True when a card has one of the Pokémon a collection is about, or the collection isn't about any. */
export const fitsTheme = (theme: ReadonlySet<string> | null, f: CardFeatures): boolean =>
  !theme || f.species.some((s) => theme.has(speciesKey(s)));

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
