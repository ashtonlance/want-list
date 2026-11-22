import { cardImageSrc } from "~/features/cards/image";
import { isGot, priceOf } from "~/features/cards/pricing";
import type { Card } from "~/features/cards/types";
import { tcgImage } from "~/lib/images";
import type { Binder, Slot, WebSlot } from "./types";

export type Slots = (Slot | null)[];

/** What a pocket shows: a card on the list, a card from the catalog, or a list card since deleted. */
export interface SlotInfo {
  name: string;
  sub: string;
  img: string | null;
  got: boolean;
  /** What it still costs: null when owned or unpriced. */
  price: number | null;
  /** Set when the card isn't on the list. */
  web: WebSlot | null;
}

const subLine = (set: string, number: string): string =>
  [set, number ? "#" + number : ""].filter(Boolean).join(" · ");

export function slotInfo(s: Slot | null | undefined, cardsById: ReadonlyMap<string, Card>): SlotInfo | null {
  if (!s) return null;
  if (s.k === "w")
    return {
      name: s.n,
      sub: subLine(s.s, s.no),
      img: tcgImage(s.pid),
      got: false,
      price: s.m,
      web: s,
    };
  const c = cardsById.get(s.id);
  if (!c) return { name: "Removed card", sub: "", img: null, got: false, price: null, web: null };
  const got = isGot(c);
  return {
    name: c.name,
    sub: subLine(c.set, c.number),
    img: cardImageSrc(c),
    got,
    price: got ? null : priceOf(c),
    web: null,
  };
}

export const emptySlots = (n: number): Slots => Array.from({ length: n }, () => null);

export const pageCount = (b: Binder): number => Math.max(1, Math.ceil(b.slots.length / b.pockets));

/** A copy at least `n` long, so a pocket past the end of a short slot list can be filled. */
const padded = (slots: Slots, n: number): Slots =>
  Array.from({ length: Math.max(slots.length, n) }, (_, i) => slots[i] ?? null);

export function withSlot(slots: Slots, i: number, slot: Slot | null): Slots {
  const out = padded(slots, i + 1);
  out[i] = slot;
  return out;
}

export function swapSlots(slots: Slots, a: number, b: number): Slots {
  const out = padded(slots, Math.max(a, b) + 1);
  out[a] = slots[b] ?? null;
  out[b] = slots[a] ?? null;
  return out;
}

export const cardIdsIn = (slots: Slots): Set<string> =>
  new Set(slots.flatMap((s) => (s?.k === "c" ? [s.id] : [])));

/** The same cards on pages of a new size: trailing empty pockets go, and the last page is padded out. */
export function repage(slots: Slots, pockets: number): Slots {
  const kept = [...slots];
  while (kept.length && !kept[kept.length - 1]) kept.pop();
  if (!kept.length) return emptySlots(pockets);
  return [...kept, ...emptySlots((pockets - (kept.length % pockets)) % pockets)];
}

/** Puts list cards into the empty pockets in order, adding pages for whatever doesn't fit. */
export function fillEmpty(slots: Slots, pockets: number, ids: readonly string[]): Slots {
  const rest = ids.map((id): Slot => ({ k: "c", id }));
  const out = slots.map((s) => s ?? rest.shift() ?? null);
  while (rest.length) out.push(...emptySlots(pockets).map(() => rest.shift() ?? null));
  return out;
}
