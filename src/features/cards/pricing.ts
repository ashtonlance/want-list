import { formatMoney } from "~/lib/format";
import { MANUAL_SOURCE, type Card } from "./types";
import type { PriceFile, SubPrices } from "./prices";

/**
 * The card's TCGplayer product id: from its saved price, a TCGplayer link, or the price check's catalog
 * match, in the same order as the daily sync (tools/sync.mjs), so both follow the same product.
 */
export function pidOf(c: Pick<Card, "tcg" | "listing"> & { tcgProduct?: number | null }): number | null {
  if (c.tcg?.productId) return c.tcg.productId;
  const m = /tcgplayer\.com\/product\/(\d+)/.exec(c.listing?.url ?? "");
  if (m) return Number(m[1]);
  return c.tcgProduct ?? null;
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

/** A price typed in by hand, which the price check leaves alone. */
export const isManual = (ask: Card["ask"]): boolean => ask?.kind === "price" && ask.source === MANUAL_SOURCE;

export const isGot = (c: Pick<Card, "status">): boolean => c.status === "got";

export const tcgMarket = (c: Pick<Card, "tcg">): number | null => c.tcg?.market ?? null;

/** What the card costs: the shipped deal, else TCGplayer market, else a marketplace ask. */
export function priceOf(c: Pick<Card, "deal" | "tcg" | "ask">): number | null {
  if (c.deal?.total != null) return c.deal.total;
  const market = tcgMarket(c);
  if (market != null) return market;
  if (c.ask && (c.ask.kind === "ask" || c.ask.kind === "market" || isManual(c.ask))) return c.ask.amount;
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
    return {
      amt: formatMoney(p),
      deal: false,
      label: market ? "market" : isManual(c.ask) ? "your price" : "ask",
    };
  }
  return { amt: null, deal: false, label: c.noPrice ? "No price found" : "No price yet" };
}
