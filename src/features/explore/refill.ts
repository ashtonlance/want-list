import { cleanCatalogName, setOf, type Catalog, type CatalogCard } from "~/features/catalog/catalog";
import { pidOf } from "~/features/cards/pricing";
import type { Card } from "~/features/cards/types";
import { WILDCARDS, type PickCard } from "./picks";
import type { ArtIndex } from "./recs/art";
import { catalogFeatures, type CardFeatures } from "./recs/features";
import { lookTheme, offLook, sceneStats, type LookTheme } from "./recs/look";
import { artRows, artTaste, rankForCollection, rankWildcards, type Scored } from "./recs/rank";
import { fitsTheme, knownSpecies, pokemonTheme, type Example } from "./recs/taste";

/** Every collection keeps at least this many picks waiting for an answer. */
export const MIN_OPEN = 8;

/**
 * At most this many refill picks of one Pokémon, and of one artist, per collection, unless the collection
 * is about that Pokémon or mostly that artist's work.
 */
const PER_SPECIES = 2;
const PER_ARTIST = 3;
const UNCAPPED = { species: true, artist: true } as const;

/** How much each kind of example counts. Claude's own open suggestions only hint, so a new collection has something. */
const LISTED = 1;
const ADDED = 1;
const SUGGESTED = 0.25;
const PASSED = -1;

/** A refill pick already on screen, kept as it is so new information never reshuffles what he's looking at. */
export interface KeptPick {
  coll: string;
  pid: number;
  reason: string;
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
  /** Art fingerprints, once they've loaded; picks work without them. */
  art?: ArtIndex | null;
  /** Refill picks already shown today. They stay, in order, while they're still open. */
  keep?: readonly KeptPick[];
}

/** For refilling: collections scrolled further than MIN_OPEN, with how many open picks each shows now. */
export interface RefillDepth {
  depth?: ReadonlyMap<string, number>;
}

const stripZeros = (s: string) => s.replace(/^0+/, "").toLowerCase();
const keyOf = (name: string, number: string, set: string) =>
  `${cleanCatalogName(name).toLowerCase()}|${stripZeros(number)}|${set.toLowerCase()}`;

const lookupCache = new WeakMap<Catalog, { byKey: Map<string, CatalogCard>; byPid: Map<number, number> }>();

/** Name+number+set and product id lookups into the catalog, built once per catalog. */
function lookups(cat: Catalog) {
  const hit = lookupCache.get(cat);
  if (hit) return hit;
  const byKey = new Map<string, CatalogCard>();
  const byPid = new Map<number, number>();
  cat.cards.forEach((c, i) => {
    byKey.set(keyOf(c.name, c.number, setOf(cat, c).name), c);
    byPid.set(c.pid, i);
  });
  const out = { byKey, byPid };
  lookupCache.set(cat, out);
  return out;
}

function toPick(f: CardFeatures, cat: Catalog, coll: string, rank: number, reason: string): PickCard {
  const set = setOf(cat, f.c);
  return {
    id: `auto:${coll}:${String(f.c.pid)}`,
    name: f.name,
    set: set.name,
    number: f.c.number,
    lang: set.jp ? "JP" : "EN",
    coll,
    status: "new",
    batch: 0,
    rank,
    tcgdexId: null,
    tcgProduct: f.c.pid,
    img: null,
    market: f.price || null,
    priceAsOf: cat.asOf,
    live: false,
    rarity: f.rarity,
    illustrator: f.artist,
    reason,
    auto: true,
  };
}

const rankCache = new WeakMap<readonly CardFeatures[], WeakMap<object, Map<string, Scored[]>>>();
const NO_ART = {};

/**
 * A ranking, remembered while its inputs stay the same: an add or a pass changes one collection's examples,
 * so only that collection is ranked again. Rankings include cards already taken; placement skips those.
 */
function remembered(
  features: readonly CardFeatures[],
  art: ArtIndex | null,
  key: string,
  examples: readonly Example[],
  rank: () => Scored[],
): Scored[] {
  let byArt = rankCache.get(features);
  if (!byArt) rankCache.set(features, (byArt = new WeakMap<object, Map<string, Scored[]>>()));
  let byKey = byArt.get(art ?? NO_ART);
  if (!byKey) byArt.set(art ?? NO_ART, (byKey = new Map<string, Scored[]>()));
  const full = `${key}|${examples.map((e) => `${String(e.f.c.pid)}:${String(e.weight)}`).join(",")}`;
  const hit = byKey.get(full);
  if (hit) return hit;
  const out = rank();
  if (byKey.size > 64) byKey.clear();
  byKey.set(full, out);
  return out;
}

const lookCache = new WeakMap<readonly CardFeatures[], WeakMap<object, Map<string, LookTheme | null>>>();

interface CollectionExamples {
  /** Every example for and against, for the taste model. */
  examples: Example[];
  /** Cards whose look stands for the collection, newest first, and picks whose look counts against it. */
  liked: CardFeatures[];
  passed: CardFeatures[];
  /** Wildcards only: Pokémon the collections already cover. */
  collected: Set<string>;
  /** The Pokémon the collection is about, if it's about any (see pokemonTheme). */
  theme: ReadonlySet<string> | null;
}

/** What refilling and art warm-up both need: catalog lookups, the list, and each collection's examples. */
function contextOf({ catalog: cat, cards, picks, collections, day, art: shownArt = null }: RefillInput) {
  const features = catalogFeatures(cat);
  // Picks of a collection no longer on the list (deleted or renamed away) stay saved, out of sight.
  const current = new Set([...collections, WILDCARDS]);
  const { byKey, byPid } = lookups(cat);
  const featuresOf = (
    pid: number | null,
    name: string,
    number: string,
    set: string,
  ): CardFeatures | undefined => {
    const at = pid != null ? byPid.get(pid) : undefined;
    if (at !== undefined) return features[at];
    const c = byKey.get(keyOf(name, number, set));
    const i = c ? byPid.get(c.pid) : undefined;
    return i === undefined ? undefined : features[i];
  };
  const ofCard = (c: Card) => featuresOf(pidOf(c), c.name, c.number, c.set);
  const ofPick = (p: PickCard) => featuresOf(p.tcgProduct, p.name, p.number, p.set);
  // Newest first, so the art match leans on what he added lately.
  const listed = [...cards].sort((a, b) => b.addedAt.localeCompare(a.addedAt));

  const onList = new Set<number>();
  for (const c of listed) {
    const f = ofCard(c);
    if (f) onList.add(f.c.pid);
  }

  const examplesOf = (coll: string): CollectionExamples => {
    const saved = picks.filter((p) => p.coll === coll);
    // A pick he added is also a card on the list; it counts once, as the card.
    const added = (p: PickCard) => p.status === "added" || p.status === "owned";
    if (coll === WILDCARDS) {
      const liked = [...listed.flatMap((c) => ofCard(c) ?? [])];
      for (const p of picks) {
        const f = added(p) ? ofPick(p) : undefined;
        if (f && !onList.has(f.c.pid)) liked.push(f);
      }
      const passed = saved.filter((p) => p.status === "passed").flatMap((p) => ofPick(p) ?? []);
      return {
        examples: [
          ...liked.map((f) => ({ f, weight: LISTED })),
          ...passed.map((f) => ({ f, weight: PASSED })),
        ],
        liked,
        passed,
        collected: new Set(
          listed.filter((c) => c.collections.length).flatMap((c) => ofCard(c)?.species ?? []),
        ),
        theme: null,
      };
    }
    const inColl = listed.filter((c) => c.collections.includes(coll)).flatMap((c) => ofCard(c) ?? []);
    const counted = new Set(inColl.map((f) => f.c.pid));
    const examples: Example[] = [
      ...inColl.map((f) => ({ f, weight: LISTED })),
      ...saved.flatMap((p): Example[] => {
        const f = ofPick(p);
        if (!f || (added(p) && counted.has(f.c.pid))) return [];
        const weight = p.status === "passed" ? PASSED : p.status === "new" ? SUGGESTED : ADDED;
        return [{ f, weight }];
      }),
    ];
    const theme = pokemonTheme(coll, examples, knownSpecies(features));
    // Waiting picks of other Pokémon are out of sight (see offThemePicks), so they say nothing about it.
    const shown = theme ? examples.filter((e) => e.weight !== SUGGESTED || fitsTheme(theme, e.f)) : examples;
    return {
      examples: shown,
      liked: shown.filter((e) => e.weight >= ADDED).map((e) => e.f),
      passed: shown.filter((e) => e.weight < 0).map((e) => e.f),
      collected: new Set(),
      theme,
    };
  };
  const examplesByColl = new Map<string, CollectionExamples>();
  const examplesFor = (coll: string): CollectionExamples => {
    let hit = examplesByColl.get(coll);
    if (!hit) examplesByColl.set(coll, (hit = examplesOf(coll)));
    return hit;
  };

  /** A card's row in the art index, or -1. */
  const rowIn = (art: ArtIndex | null, f: CardFeatures) => {
    const at = art ? byPid.get(f.c.pid) : undefined;
    return art && at !== undefined ? (artRows(art, cat, features)[at] ?? -1) : -1;
  };

  /**
   * The look of a collection that isn't about particular Pokémon (see lookTheme), remembered for the same
   * cards and fingerprints.
   */
  const lookFor = (coll: string, art: ArtIndex | null): LookTheme | null => {
    const { examples, theme } = examplesFor(coll);
    if (coll === WILDCARDS || theme) return null;
    const kept = examples.filter((e) => e.weight >= LISTED).map((e) => e.f);
    let byArt = lookCache.get(features);
    if (!byArt) lookCache.set(features, (byArt = new WeakMap<object, Map<string, LookTheme | null>>()));
    let byKey = byArt.get(art ?? NO_ART);
    if (!byKey) byArt.set(art ?? NO_ART, (byKey = new Map<string, LookTheme | null>()));
    const key = `${coll}|${kept.map((f) => f.c.pid).join(",")}`;
    let hit = byKey.get(key);
    if (hit === undefined) {
      hit = lookTheme({ coll, kept, features, index: art, rowOf: (f) => rowIn(art, f) });
      if (byKey.size > 64) byKey.clear();
      byKey.set(key, hit);
    }
    return hit;
  };

  /** True when a card is clearly not what its collection is about: another Pokémon, or far off its look. */
  const offThemeFor = (coll: string, f: CardFeatures) =>
    !fitsTheme(examplesFor(coll).theme, f) || offLook(lookFor(coll, shownArt), f, rowIn(shownArt, f));

  /** How a collection's cards look, from the fingerprints; the costly part, remembered for the same cards. */
  const artFor = (coll: string, art: ArtIndex | null) => {
    if (!art) return null;
    const { liked, passed } = examplesFor(coll);
    return artTaste(art, artRows(art, cat, features), byPid, liked, passed);
  };

  /** Every card worth suggesting for a collection, best first, remembered while its examples stay the same. */
  const rankedFor = (coll: string, art: ArtIndex | null): Scored[] => {
    const { examples, collected, theme } = examplesFor(coll);
    const rows = art ? artRows(art, cat, features) : null;
    const artOf = () => artFor(coll, art);
    return coll === WILDCARDS
      ? remembered(features, art, `${day}|${coll}|${[...collected].sort().join(",")}`, examples, () =>
          rankWildcards({
            liked: examples.filter((e) => e.weight > 0),
            passed: examples.filter((e) => e.weight < 0),
            features,
            collected,
            art: artOf(),
            rows,
            day,
          }),
        )
      : remembered(features, art, `${day}|${coll}`, examples, () =>
          rankForCollection({
            coll,
            examples,
            theme,
            look: lookFor(coll, art),
            features,
            art: artOf(),
            rows,
            day,
          }),
        );
  };
  /** A waiting pick of a collection on the list that's clearly off its theme (see offThemeFor), as one saved before it had one. */
  const offTheme = (p: PickCard) => {
    if (p.status !== "new" || !current.has(p.coll)) return false;
    const f = ofPick(p);
    return f !== undefined && offThemeFor(p.coll, f);
  };
  /** A pick out of sight: one of a collection no longer on the list, or a waiting one off its theme. */
  const outOfSight = (p: PickCard) => !current.has(p.coll) || offTheme(p);
  /**
   * A waiting pick of another Pokémon than its collection is about. Unlike a look, which shifts with the
   * cards and fingerprints, that holds, so such a pick can go for good.
   */
  const offPokemon = (p: PickCard) => {
    if (p.status !== "new" || !current.has(p.coll)) return false;
    const f = ofPick(p);
    return f !== undefined && !fitsTheme(examplesFor(p.coll).theme, f);
  };
  return {
    features,
    byPid,
    ofPick,
    onList,
    examplesFor,
    artFor,
    rankedFor,
    outOfSight,
    offPokemon,
    offThemeFor,
  };
}

export interface HiddenPicks {
  /** Saved picks not to show: those of a collection no longer on the list, and waiting ones off its theme. */
  hidden: ReadonlySet<string>;
  /** Of those, waiting picks of another Pokémon than their collection is about, which can be deleted. */
  drop: ReadonlySet<string>;
}

/**
 * Saved picks out of sight. A collection about Mew and Mewtwo shows no N's Zekrom, and Ocean no desert
 * Dugtrio, even one picked for it before; a deleted collection shows none, so undoing the delete brings
 * them back. Looks need the art fingerprints, so picks off a look are only found once input.art is in.
 */
export function offThemePicks(input: RefillInput): HiddenPicks {
  const { outOfSight, offPokemon } = contextOf(input);
  return {
    hidden: new Set(input.picks.filter(outOfSight).map((p) => p.id)),
    drop: new Set(input.picks.filter(offPokemon).map((p) => p.id)),
  };
}

/**
 * The rankings refillPicks will need once the fingerprints are in, one step per collection, so they can
 * be worked out a step at a time while the browser is idle instead of all at once.
 */
export function artWarmup(input: RefillInput, art: ArtIndex): (() => void)[] {
  const { artFor, rankedFor } = contextOf(input);
  // How every card sits on each scene first, then two steps per collection: matching its look, then ranking with it.
  return [
    () => void sceneStats(art),
    ...[...input.collections, WILDCARDS].flatMap((coll) => [
      () => void artFor(coll, art),
      () => void rankedFor(coll, art),
    ]),
  ];
}

/**
 * Picks that top every collection back up to MIN_OPEN open picks (more for one he has scrolled further
 * down), drawn from the full catalog and ranked by what the collection's cards, added picks and passed
 * picks say about its taste (see recs/rank.ts). Picks already shown today stay put; only the gaps are
 * filled. Nothing is saved until a card is added or passed on.
 */
export function refillPicks(input: RefillInput & RefillDepth): PickCard[] {
  const { catalog: cat, picks, collections, art = null, keep = [], depth } = input;
  const { features, byPid, ofPick, onList, examplesFor, rankedFor, outOfSight, offThemeFor } =
    contextOf(input);

  // Never suggest a card that's already a pick anywhere, or twice across collections. A waiting pick out of sight
  // (see offThemePicks) frees its card for a collection that wants it.
  const taken = new Set<number>();
  for (const p of picks) {
    if (p.status === "new" && outOfSight(p)) continue;
    const f = ofPick(p);
    if (f) taken.add(f.c.pid);
  }
  const unseen = (pid: number) => !onList.has(pid) && !taken.has(pid);
  const order = [...collections, WILDCARDS];
  const needOf = (coll: string) =>
    Math.max(MIN_OPEN, depth?.get(coll) ?? 0) -
    picks.filter(
      (p) =>
        p.coll === coll &&
        p.status === "new" &&
        !(p.tcgProduct && onList.has(p.tcgProduct)) &&
        !outOfSight(p),
    ).length;
  // A kept Wildcard goes once its Pokémon joins a collection, and a kept pick once it turns out clearly off
  // its collection's theme (another Pokémon, or far off its look), as a fresh ranking would drop either.
  const collected = examplesFor(WILDCARDS).collected;
  const stillFits = (k: KeptPick, f: CardFeatures) =>
    unseen(k.pid) &&
    !offThemeFor(k.coll, f) &&
    !(k.coll === WILDCARDS && f.species.some((sp) => collected.has(sp)));
  // Picks on screen belong to their collection: no other collection may take them while they're shown.
  const reserved = new Map<number, string>();
  for (const k of keep) {
    const at = byPid.get(k.pid);
    const f = at === undefined ? undefined : features[at];
    if (f && !reserved.has(k.pid) && order.includes(k.coll) && needOf(k.coll) > 0 && stillFits(k, f))
      reserved.set(k.pid, k.coll);
  }

  const out: PickCard[] = [];
  for (const coll of order) {
    let need = needOf(coll);
    if (need <= 0) continue;
    let rank = 0;
    const perSpecies = new Map<string, number>();
    const perArtist = new Map<string, number>();
    const place = (f: CardFeatures, reason: string) => {
      const sp = f.species[0] ?? f.name;
      perSpecies.set(sp, (perSpecies.get(sp) ?? 0) + 1);
      if (f.artist) perArtist.set(f.artist, (perArtist.get(f.artist) ?? 0) + 1);
      taken.add(f.c.pid);
      out.push(toPick(f, cat, coll, rank++, reason));
      need--;
    };

    // Kept picks were capped when they were first chosen, so only ranked picks are capped here.
    // Open picks already saved count toward the caps too.
    for (const p of picks) {
      if (p.coll !== coll || p.status !== "new" || outOfSight(p)) continue;
      const f = ofPick(p);
      if (!f) continue;
      const sp = f.species[0] ?? f.name;
      perSpecies.set(sp, (perSpecies.get(sp) ?? 0) + 1);
      if (f.artist) perArtist.set(f.artist, (perArtist.get(f.artist) ?? 0) + 1);
    }

    const fits = (f: CardFeatures, uncapped: Scored["uncapped"] = UNCAPPED) =>
      unseen(f.c.pid) &&
      (reserved.get(f.c.pid) ?? coll) === coll &&
      (uncapped.species || (perSpecies.get(f.species[0] ?? f.name) ?? 0) < PER_SPECIES) &&
      (uncapped.artist || !f.artist || (perArtist.get(f.artist) ?? 0) < PER_ARTIST);

    for (const k of keep) {
      if (need <= 0) break;
      if (k.coll !== coll) continue;
      const at = byPid.get(k.pid);
      const f = at === undefined ? undefined : features[at];
      if (f && fits(f) && stillFits(k, f)) place(f, k.reason);
    }
    if (need <= 0) continue;

    for (const s of rankedFor(coll, art)) {
      if (need <= 0) break;
      if (fits(s.f, s.uncapped)) place(s.f, s.explain());
    }
  }
  return out;
}
