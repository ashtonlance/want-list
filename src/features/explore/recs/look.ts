import type { ArtIndex } from "./art";
import type { CardFeatures } from "./features";
import scenesFile from "./scenes.json";
import { speciesKey } from "./taste";
import typeRows from "./types.json";

/**
 * A collection's look: what most of its cards show and which Pokémon type most of them are, for a
 * collection that isn't about particular Pokémon (Ocean, Forest, Space). Picks for it follow that look
 * first: Ocean's cards show sea creatures under water and are mostly Water types, so its picks are too.
 *
 * What a card shows comes from its art fingerprint: each scene in scenes.json ("an underwater scene",
 * "a forest") is a direction among the fingerprints (see tools/art/scenes.mjs), and how far along it a
 * card sits, against every other card, is how much the card shows it (a z-score: 0 is a typical card, 2
 * is about the top 2%). A collection shows a scene when its cards do on average, more readily when its
 * name asks for it.
 */
export interface LookTheme {
  /** The scenes its cards show, strongest first, each weighted by how strongly they show it. */
  scenes: readonly { label: string; weight: number }[];
  /** Pokémon types most of its cards are, like water for Ocean; may be empty. */
  types: ReadonlySet<string>;
  /** For every row of the art index: how strongly it shows the collection's scenes (weighted z-score), or null without art. */
  sceneFit: Float32Array | null;
  /** For every row: which of `scenes` it shows most. */
  sceneOf: Uint8Array | null;
}

/** A collection needs this many cards with a fingerprint before what they show is a look. */
const MIN_CARDS = 3;
/** A scene is part of the look when the cards show it at least this much on average (name boost included)... */
const SCENE_MIN = 1.2;
/** ...and at least this much without the boost, since a name can't make cards show what they don't. */
const SCENE_SHOWN = 0.6;
/** What a collection's name asking for a scene adds to how much its cards show it. */
const NAME_BOOST = 0.75;
/** A look holds at most this many scenes. */
const MAX_SCENES = 3;
/** A type is part of the look when at least this share of the cards with a Pokémon are that type... */
const TYPE_SHARE = 0.5;
/** ...and it's at least this many times as common there as across the catalog. */
const TYPE_LIFT = 2;
/** With fingerprints, a card fitting a look less than this is clearly off it (a desert card in Ocean). */
const OFF_LOOK = 0.25;
/** What being one of the look's types adds to a card's fit, in the same z-score units. */
const TYPE_BONUS = 0.75;
/** Rows sampled for each scene's spread across the catalog: every this many. */
const STAT_STRIDE = 4;

const file = scenesFile;
const sceneCount = file.scenes.length;
/** Scene directions, one after another. */
const directions = Float32Array.from(file.scenes.flatMap((s) => s.v));

const typesByKey = new Map<string, readonly string[]>(typeRows.map(([k = "", ...ts]) => [k, ts]));

const typesCache = new WeakMap<CardFeatures, readonly string[]>();

/** The types of a card's Pokémon (both Pokémon's, for Umbreon & Darkrai), or none for a trainer or energy. */
export function typesOf(f: CardFeatures): readonly string[] {
  let hit = typesCache.get(f);
  if (!hit) {
    hit = [...new Set(f.species.flatMap((s) => typesByKey.get(speciesKey(s)) ?? []))];
    typesCache.set(f, hit);
  }
  return hit;
}

/** How far along one scene's direction a row sits, before comparing with other cards. */
function along(index: ArtIndex, row: number, scene: number): number {
  const { dims, vectors } = index;
  let s = 0;
  for (let k = 0; k < dims; k++) s += (vectors[row * dims + k] ?? 0) * (directions[scene * dims + k] ?? 0);
  return s / 127;
}

interface SceneStats {
  mean: Float32Array;
  spread: Float32Array;
}
const statsCache = new WeakMap<ArtIndex, SceneStats | null>();

/**
 * Each scene's mean and spread across the art index, from a sample of its rows; null when the scene file
 * was made for fingerprints of another size. Worked out once per index (it's the costly part, so the art
 * warm-up does it first).
 */
export function sceneStats(index: ArtIndex): SceneStats | null {
  const hit = statsCache.get(index);
  if (hit !== undefined) return hit;
  let out: SceneStats | null = null;
  const n = index.pids.length;
  if (file.dims === index.dims && n) {
    const mean = new Float32Array(sceneCount);
    const spread = new Float32Array(sceneCount);
    for (let s = 0; s < sceneCount; s++) {
      let sum = 0;
      let sq = 0;
      let m = 0;
      for (let row = 0; row < n; row += STAT_STRIDE, m++) {
        const v = along(index, row, s);
        sum += v;
        sq += v * v;
      }
      mean[s] = sum / m;
      spread[s] = Math.sqrt(Math.max(sq / m - (sum / m) ** 2, 0)) || 1;
    }
    out = { mean, spread };
  }
  statsCache.set(index, out);
  return out;
}

/** A name as lower-case words. */
const words = (s: string) => s.toLowerCase().match(/\p{L}+/gu) ?? [];

/** Catalog share of each type among cards with a Pokémon, worked out once per catalog. */
const baseCache = new WeakMap<readonly CardFeatures[], Map<string, number>>();
function typeBase(features: readonly CardFeatures[]): Map<string, number> {
  const hit = baseCache.get(features);
  if (hit) return hit;
  const count = new Map<string, number>();
  let typed = 0;
  for (const f of features) {
    const ts = typesOf(f);
    if (!ts.length) continue;
    typed++;
    for (const t of ts) count.set(t, (count.get(t) ?? 0) + 1);
  }
  const out = new Map([...count].map(([t, c]) => [t, c / typed]));
  baseCache.set(features, out);
  return out;
}

export interface LookInput {
  coll: string;
  /** The cards he listed or added for it. */
  kept: readonly CardFeatures[];
  /** Every catalog card's features, for how common each type is. */
  features: readonly CardFeatures[];
  index: ArtIndex | null;
  /** A card's row in the art index, or -1. */
  rowOf: (f: CardFeatures) => number;
}

/**
 * The look a collection's cards share (see LookTheme), or null when they share none worth following.
 * Without art fingerprints it can only be types.
 */
export function lookTheme({ coll, kept, features, index, rowOf }: LookInput): LookTheme | null {
  // Types: a clear majority, well above how common the type is anyway.
  const withTypes = kept.map(typesOf).filter((ts) => ts.length);
  const count = new Map<string, number>();
  for (const ts of withTypes) for (const t of ts) count.set(t, (count.get(t) ?? 0) + 1);
  const base = typeBase(features);
  const types = new Set(
    withTypes.length < MIN_CARDS
      ? []
      : [...count]
          .filter(
            ([t, c]) =>
              c >= withTypes.length * TYPE_SHARE && c / withTypes.length >= TYPE_LIFT * (base.get(t) ?? 1),
          )
          .map(([t]) => t),
  );

  // Scenes: what the cards show on average, boosted where the name asks for it.
  const stats = index ? sceneStats(index) : null;
  const rows = index ? kept.map(rowOf).filter((r) => r >= 0) : [];
  const scenes: { s: number; label: string; weight: number }[] = [];
  if (index && stats && rows.length >= MIN_CARDS) {
    const name = new Set(words(coll));
    file.scenes.forEach((scene, s) => {
      let shown = 0;
      for (const r of rows) shown += (along(index, r, s) - (stats.mean[s] ?? 0)) / (stats.spread[s] ?? 1);
      shown /= rows.length;
      const weight = shown + (scene.words.some((w) => name.has(w)) ? NAME_BOOST : 0);
      if (shown >= SCENE_SHOWN && weight >= SCENE_MIN) scenes.push({ s, label: scene.label, weight });
    });
    scenes.sort((a, b) => b.weight - a.weight);
    scenes.length = Math.min(scenes.length, MAX_SCENES);
  }
  if (!scenes.length && !types.size) return null;

  let sceneFit: Float32Array | null = null;
  let sceneOf: Uint8Array | null = null;
  if (index && stats && scenes.length) {
    const n = index.pids.length;
    sceneFit = new Float32Array(n);
    sceneOf = new Uint8Array(n);
    const total = scenes.reduce((sum, x) => sum + x.weight, 0);
    for (let row = 0; row < n; row++) {
      let fit = 0;
      let best = -Infinity;
      for (let i = 0; i < scenes.length; i++) {
        const { s, weight } = scenes[i] ?? { s: 0, weight: 0 };
        const part = (weight * (along(index, row, s) - (stats.mean[s] ?? 0))) / (stats.spread[s] ?? 1);
        fit += part;
        if (part > best) {
          best = part;
          sceneOf[row] = i;
        }
      }
      sceneFit[row] = fit / total;
    }
  }
  return { scenes: scenes.map(({ label, weight }) => ({ label, weight })), types, sceneFit, sceneOf };
}

/** How well a card fits a look: how strongly it shows its scenes, plus TYPE_BONUS for one of its types. */
export function lookFit(look: LookTheme, f: CardFeatures, row: number): number {
  const scene = look.sceneFit && row >= 0 ? (look.sceneFit[row] ?? 0) : 0;
  const typed = look.types.size > 0 && typesOf(f).some((t) => look.types.has(t));
  return scene + (typed ? TYPE_BONUS : 0);
}

/**
 * True when a card is clearly off a collection's look, which only fingerprints can tell: types alone are
 * too blunt (Ocean holds a Dwebble on a beach).
 */
export function offLook(look: LookTheme | null, f: CardFeatures, row: number): boolean {
  return look?.sceneFit != null && row >= 0 && lookFit(look, f, row) < OFF_LOOK;
}
