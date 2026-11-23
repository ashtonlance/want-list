import { setOf, type Catalog } from "~/features/catalog/catalog";
import { pidOf } from "./pricing";
import type { Card } from "./types";

/**
 * One set saved under two names, like "151" and "Scarlet & Violet 151", splits the list's set filter
 * and search. This finds the cards to rename so every card uses the catalog's name for its set.
 *
 * It only renames toward a catalog name that's already on the list (so it merges duplicates and
 * nothing else), and only when it's sure: by the card's TCGplayer product, or, for a card without
 * one, when exactly one set on the list has every word of its set name and that set has a card of
 * the same name.
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

export function setNameFixes(cards: readonly Card[], cat: Catalog): SetRename[] {
  const catalogNames = new Map<string, { jp: boolean; idx: number }>();
  cat.sets.forEach((s, idx) => {
    if (s.name && !catalogNames.has(s.name)) catalogNames.set(s.name, { jp: s.jp, idx });
  });
  // Catalog sets the list already uses: the only names a card may be renamed to.
  const onList = new Set(cards.map((c) => c.set).filter((n) => catalogNames.has(n)));
  const namesIn = new Map<number, string[]>();
  for (const c of cat.cards) {
    const list = namesIn.get(c.set) ?? [];
    list.push(c.name.toLowerCase());
    namesIn.set(c.set, list);
  }

  const out: SetRename[] = [];
  for (const card of cards) {
    if (!card.set || catalogNames.has(card.set)) continue;
    const to = byProduct(card, cat) ?? byName(card, onList, catalogNames, namesIn);
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
  onList: ReadonlySet<string>,
  catalogNames: ReadonlyMap<string, { jp: boolean; idx: number }>,
  namesIn: ReadonlyMap<number, readonly string[]>,
): string | null {
  const mine = words(card.set);
  const jp = card.lang === "JP";
  const fits = [...onList].filter((n) => catalogNames.get(n)?.jp === jp && hasAll(words(n), mine));
  const only = fits.length === 1 ? fits[0] : undefined;
  if (!only) return null;
  const name = card.name.toLowerCase();
  const idx = catalogNames.get(only)?.idx ?? -1;
  return namesIn.get(idx)?.some((n) => n.includes(name)) ? only : null;
}
