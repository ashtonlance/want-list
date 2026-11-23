import { setOf, type Catalog } from "~/features/catalog/catalog";
import { pidOf } from "./pricing";
import type { Card } from "./types";

/**
 * One set saved under two names, like "151" and "Scarlet & Violet 151", splits the list's set filter
 * and search. This finds the cards to rename so every card uses the catalog's name for its set.
 *
 * It only renames toward a catalog name that's already on the list (so it merges duplicates and
 * nothing else), and only when it's sure: by the card's TCGplayer product, or, for a card without
 * one, when exactly one catalog set has every word of its set name, that set is on the list, and it
 * has a card of exactly that name.
 */
export interface SetRename {
  card: Card;
  from: string;
  to: string;
}

const words = (s: string): string[] =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

const hasAll = (big: readonly string[], small: readonly string[]): boolean =>
  small.length > 0 && small.every((w) => big.includes(w));

/** A catalog card's own name, without a listing's " - 050/088" or " (Cosmos Holo)". */
const baseName = (n: string): string =>
  n
    .replace(/\s+(-\s|\().*$/, "")
    .trim()
    .toLowerCase();

export function setNameFixes(cards: readonly Card[], cat: Catalog): SetRename[] {
  const catalogNames = new Map<string, { jp: boolean; idx: number }>();
  cat.sets.forEach((s, idx) => {
    if (s.name && !catalogNames.has(s.name)) catalogNames.set(s.name, { jp: s.jp, idx });
  });
  // Catalog sets the list already uses: the only names a card may be renamed to.
  const onList = new Set(cards.map((c) => c.set).filter((n) => catalogNames.has(n)));
  const namesIn = new Map<number, Set<string>>();
  for (const c of cat.cards) {
    const names = namesIn.get(c.set) ?? new Set<string>();
    names.add(baseName(c.name));
    namesIn.set(c.set, names);
  }

  const out: SetRename[] = [];
  for (const card of cards) {
    if (!card.set || catalogNames.has(card.set)) continue;
    const to = byProduct(card, cat) ?? byName(card, catalogNames, namesIn);
    if (to && to !== card.set && onList.has(to)) out.push({ card, from: card.set, to });
  }
  return out;
}

function byProduct(card: Card, cat: Catalog): string | null {
  const pid = pidOf(card);
  const row = pid != null ? cat.byPid.get(pid) : undefined;
  return row ? setOf(cat, row).name || null : null;
}

function byName(
  card: Card,
  catalogNames: ReadonlyMap<string, { jp: boolean; idx: number }>,
  namesIn: ReadonlyMap<number, ReadonlySet<string>>,
): string | null {
  const mine = words(card.set);
  const jp = card.lang === "JP";
  // Every catalog set the name could mean, not only the ones on the list, so "Base" stays put while
  // both Base Set and Base Set 2 fit it.
  const fits = [...catalogNames].filter(([n, s]) => s.jp === jp && hasAll(words(n), mine));
  const only = fits.length === 1 ? fits[0] : undefined;
  if (!only) return null;
  const [name, { idx }] = only;
  return namesIn.get(idx)?.has(card.name.trim().toLowerCase()) ? name : null;
}
