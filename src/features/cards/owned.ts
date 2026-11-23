import { isGot, tcgMarket } from "./pricing";
import type { Card, Owned, RawCondition } from "./types";

/** One raw copy with nothing recorded: what a got card with no details means. */
export const ONE_COPY: Owned = { qty: 1, condition: null, grader: "", grade: "", paid: null, value: null };

export const ownedOf = (c: Pick<Card, "owned">): Owned => c.owned ?? ONE_COPY;

export const GRADERS = ["PSA", "BGS", "CGC", "SGC", "TAG", "ACE"] as const;

export const CONDITION_NAMES: Record<RawCondition, string> = {
  NM: "Near Mint",
  LP: "Lightly Played",
  MP: "Moderately Played",
  HP: "Heavily Played",
  DMG: "Damaged",
};

export const isGraded = (o: Owned): boolean => o.grader !== "";

/** "PSA 10", "NM", or "" when nothing's recorded. */
export function gradeLabel(o: Owned): string {
  if (isGraded(o)) return [o.grader, o.grade].filter(Boolean).join(" ");
  return o.condition ?? "";
}

/** The short line on a got card's tile: "Got it", "Got it · NM", "Got 2 · LP", "PSA 10", "Got 2 · PSA 10". */
export function ownedBadge(o: Owned): string {
  const grade = gradeLabel(o);
  const got = o.qty > 1 ? `Got ${o.qty}` : "Got it";
  if (!grade) return got;
  // A slab's label says it's yours on its own; a bare "NM" doesn't.
  return isGraded(o) && o.qty === 1 ? grade : `${got} · ${grade}`;
}

/**
 * What one copy is worth: your own value if you set one, else the market price. A graded card with no
 * value of its own falls back to the raw price, which usually undersells it.
 */
export function valueEach(c: Pick<Card, "owned" | "tcg" | "ask">): number | null {
  const own = c.owned?.value;
  if (own != null) return own;
  const market = tcgMarket(c);
  if (market != null) return market;
  return c.ask && (c.ask.kind === "ask" || c.ask.kind === "market") ? c.ask.amount : null;
}

export interface CollectionValue {
  /** Distinct cards you've got. */
  cards: number;
  /** Every copy, counting quantities. */
  copies: number;
  /** What every copy with a known value is worth. */
  worth: number;
  /** What you paid, over the copies with both a price paid and a value, so gain is worth minus this. */
  paid: number;
  /** What those same copies are worth now, less what they cost. */
  gain: number;
  /** Whether any copy has both a price paid and a value, so gain means something. */
  hasPaid: boolean;
}

/** Totals for the cards you've got: copies, what they're worth, what they cost and the difference. */
export function collectionValue(cards: readonly Card[]): CollectionValue {
  const out: CollectionValue = { cards: 0, copies: 0, worth: 0, paid: 0, gain: 0, hasPaid: false };
  for (const c of cards) {
    if (!isGot(c)) continue;
    const o = ownedOf(c);
    const value = valueEach(c);
    out.cards++;
    out.copies += o.qty;
    if (value == null) continue;
    out.worth += value * o.qty;
    if (o.paid != null) {
      out.hasPaid = true;
      out.paid += o.paid * o.qty;
      out.gain += (value - o.paid) * o.qty;
    }
  }
  return out;
}

/** "+$12.50" or "−$3.00", for a gain or loss. Pass `n` already rounded to what will be shown. */
export function signedMoney(n: number, format: (n: number) => string): string {
  if (n === 0) return format(0);
  return (n > 0 ? "+" : "−") + format(Math.abs(n));
}

/** "up", "down" or "even", for a gain already rounded to what will be shown. */
export const gainWord = (n: number): string => (n > 0 ? "up" : n < 0 ? "down" : "even");
