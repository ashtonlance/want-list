import { tcgProductUrl, tcgSearchUrl } from "~/features/cards/links";
import { isGot, pidOf, priceOf } from "~/features/cards/pricing";
import type { Card } from "~/features/cards/types";

/** The want list as a family member sees it: the cards marked priority first, then the rest. */
export interface SharedList {
  top: Card[];
  rest: Card[];
  /** What every card with a price adds up to. */
  total: number;
  count: number;
}

/** Cheapest first, so a gift budget finds its card fast; cards with no price go last. */
const byPrice = (a: Card, b: Card): number =>
  (priceOf(a) ?? Infinity) - (priceOf(b) ?? Infinity) || a.name.localeCompare(b.name);

/** The cards still wanted, optionally in one collection, split into priority picks and the rest. */
export function sharedList(cards: readonly Card[], coll: string | null): SharedList {
  const want = cards.filter((c) => !isGot(c) && (!coll || c.collections.includes(coll)));
  const top = want.filter((c) => c.priority).sort(byPrice);
  const rest = want.filter((c) => !c.priority).sort(byPrice);
  const total = want.reduce((s, c) => s + (priceOf(c) ?? 0), 0);
  return { top, rest, total, count: want.length };
}

/** The address of the read-only page for the whole list, or for one collection. */
export function shareUrl(origin: string, base: string, coll: string | null): string {
  const root = origin + (base.endsWith("/") ? base : base + "/");
  return root + "share/" + (coll ? "?c=" + encodeURIComponent(coll) : "");
}

/** The card's printing in words: what was typed on the card, else TCGplayer's name for the printing. */
export function printingOf(c: Pick<Card, "variant" | "tcg">): string {
  return c.variant || c.tcg?.sub || "";
}

/**
 * Where to buy the card at the price shown: the shipped deal when that's the price, else TCGplayer
 * (its own product page when the card is matched to one, else a search).
 */
export function buyUrl(c: Card): string {
  if (c.deal?.total != null && /^https?:\/\//.test(c.deal.url)) return c.deal.url;
  const pid = pidOf(c);
  return pid
    ? tcgProductUrl(pid)
    : tcgSearchUrl([c.name, c.number].filter(Boolean).join(" "), c.lang === "JP");
}
