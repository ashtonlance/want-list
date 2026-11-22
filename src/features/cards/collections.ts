import { isGot, priceOf } from "./pricing";
import type { Card, CardPatch } from "./types";

export interface CollectionSummary {
  name: string;
  total: number;
  got: number;
  /** What the cards still wanted cost, at today's prices. */
  cost: number;
}

/** Every collection used by any card, by name. */
export function allCollections(cards: readonly Card[]): CollectionSummary[] {
  const m = new Map<string, CollectionSummary>();
  for (const c of cards) {
    for (const name of c.collections) {
      const v = m.get(name) ?? { name, total: 0, got: 0, cost: 0 };
      v.total++;
      if (isGot(c)) v.got++;
      else v.cost += priceOf(c) ?? 0;
      m.set(name, v);
    }
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** A collection's cards in binder order. */
export function collectionCards(cards: readonly Card[], name: string): Card[] {
  const big = 1e9;
  return cards
    .filter((c) => c.collections.includes(name))
    .sort(
      (a, b) =>
        (a.slots[name] ?? big) - (b.slots[name] ?? big) ||
        a.addedAt.localeCompare(b.addedAt) ||
        (a.order ?? 0) - (b.order ?? 0),
    );
}

/** Puts a card at the end of a collection. */
export function addToCollection(c: Card, name: string, slot: number): CardPatch {
  return { collections: [...c.collections, name], slots: { ...c.slots, [name]: slot } };
}

export function removeFromCollection(c: Card, name: string): CardPatch {
  const slots = { ...c.slots };
  delete slots[name];
  return { collections: c.collections.filter((n) => n !== name), slots };
}

export function renameInCard(c: Card, from: string, to: string): CardPatch {
  const slots = { ...c.slots };
  if (from in slots) {
    slots[to] = slots[from] ?? 0;
    delete slots[from];
  }
  return { collections: [...new Set(c.collections.map((n) => (n === from ? to : n)))], slots };
}

/** Patches that swap two neighbouring cards in a collection and renumber the rest to match. */
export function moveInCollection(ordered: readonly Card[], name: string, i: number, dir: -1 | 1): [Card, CardPatch][] {
  const j = i + dir;
  if (j < 0 || j >= ordered.length) return [];
  const order = ordered.slice();
  const a = order[i];
  const b = order[j];
  if (!a || !b) return [];
  order[i] = b;
  order[j] = a;
  const out: [Card, CardPatch][] = [];
  order.forEach((c, idx) => {
    if (c.slots[name] !== idx) out.push([c, { slots: { ...c.slots, [name]: idx } }]);
  });
  return out;
}

/** Set names used on the list, for suggestions and quick-add matching. */
export const knownSets = (cards: readonly Card[]): string[] =>
  [...new Set(cards.map((c) => c.set).filter(Boolean))].sort((a, b) => a.localeCompare(b));
