import { formatMoney } from "~/lib/format";
import type { Card } from "./types";
import type { PriceFile, SubPrices } from "./prices";

/** The card's TCGplayer product id, from its saved price or a TCGplayer listing link. */
export function pidOf(c: Pick<Card, "tcg" | "listing">): number | null {
  if (c.tcg?.productId) return c.tcg.productId;
  const m = /tcgplayer\.com\/product\/(\d+)/.exec(c.listing?.url ?? "");
  return m ? Number(m[1]) : null;
}

export interface SubPick {
  sub: string;
  market: number | null;
  low: number | null;
}

/** Picks the printing's price that matches a variant: reverse holo, 1st edition, or the regular one. */
export function pickSub(subs: SubPrices, variant: string): SubPick | null {
  const v = variant.toLowerCase();
  const order = v.includes("reverse")
    ? ["Reverse Holofoil"]
    : v.includes("1st")
      ? ["1st Edition Holofoil", "1st Edition"]
      : ["Holofoil", "Normal", "Unlimited Holofoil", "Unlimited"];
  for (const sub of order) {
    const p = subs[sub];
    if (p && (p[0] != null || p[1] != null)) return { sub, market: p[0], low: p[1] };
  }
  return null;
}

/** Today's prices override whatever price was saved on the card. */
export function withPrices(card: Card, prices: PriceFile | null | undefined): Card {
  const pid = pidOf(card);
  const subs = prices && pid ? prices.items[String(pid)] : undefined;
  const p = subs ? pickSub(subs, card.variant) : null;
  return p && prices ? { ...card, tcg: { ...p, productId: pid, asOf: prices.asOf } } : card;
}

export const isGot = (c: Pick<Card, "status">): boolean => c.status === "got";

export const tcgMarket = (c: Pick<Card, "tcg">): number | null => c.tcg?.market ?? null;

/** What the card costs: the shipped deal, else TCGplayer market, else a marketplace ask. */
export function priceOf(c: Pick<Card, "deal" | "tcg" | "ask">): number | null {
  if (c.deal?.total != null) return c.deal.total;
  const market = tcgMarket(c);
  if (market != null) return market;
  if (c.ask && (c.ask.kind === "ask" || c.ask.kind === "market")) return c.ask.amount;
  return null;
}

export interface ShortPrice {
  amt: string | null;
  deal: boolean;
  label: string;
}

/** Compact price for rows and tiles; the full breakdown lives in the card sheet. */
export function shortPrice(c: Card): ShortPrice | null {
  if (isGot(c)) return null;
  if (c.deal?.total != null) return { amt: formatMoney(c.deal.total), deal: true, label: "shipped" };
  const p = priceOf(c);
  if (p != null) {
    const market = tcgMarket(c) != null || c.ask?.kind === "market";
    return { amt: formatMoney(p), deal: false, label: market ? "market" : "ask" };
  }
  return { amt: null, deal: false, label: c.checkRequested ? "Price coming" : "No listings" };
}
