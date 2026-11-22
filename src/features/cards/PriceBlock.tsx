import { formatDate, formatMoney } from "~/lib/format";
import { isGot, tcgMarket } from "./pricing";
import type { Card } from "./types";

/** The full price breakdown in a card's sheet. */
export function PriceBlock({ card: c }: { card: Card }) {
  const deal = c.deal;
  if (deal?.total != null) {
    const parts = [deal.site, deal.seller, deal.condition].filter(Boolean).join(" · ");
    const ship =
      deal.shipping == null
        ? ""
        : deal.shipping === 0
          ? "free shipping"
          : `${formatMoney(deal.price)} + ${formatMoney(deal.shipping)} ship`;
    return (
      <div className="price">
        <div className="sticker" title="Best total found, shipping included">
          {formatMoney(deal.total)}
          <small>shipped</small>
        </div>
        <div className="deal-src">
          {[parts, ship, deal.checkedAt ? `checked ${formatDate(deal.checkedAt)}` : ""]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
    );
  }
  const market = tcgMarket(c);
  if (c.tcg && market != null) {
    const extra = [
      c.tcg.low != null ? `listings from ${formatMoney(c.tcg.low)}` : "",
      c.ask?.kind === "ask" && c.ask.amount != null
        ? `DoubleHolo ask ${formatMoney(c.ask.amount)}${c.ask.asOf ? ` (${formatDate(c.ask.asOf)})` : ""}`
        : "",
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <div className="price">
        <div className="ask mono">{formatMoney(market)}</div>
        <div className="ask-label">TCGplayer market{c.tcg.asOf ? ` · ${formatDate(c.tcg.asOf)}` : ""}</div>
        {extra ? <div className="ask-label">{extra}</div> : null}
      </div>
    );
  }
  const ASK_LABELS = {
    ask: "lowest ask, before shipping",
    market: "TCGplayer market, before shipping",
    price: "last price · none listed",
  } as const;
  if (c.ask && c.ask.kind !== "none" && c.ask.amount != null) {
    return (
      <div className="price">
        <div className="ask mono">{formatMoney(c.ask.amount)}</div>
        <div className="ask-label">{ASK_LABELS[c.ask.kind]}</div>
      </div>
    );
  }
  return (
    <div className="price">
      <div className="none">{isGot(c) ? "" : c.checkRequested ? "Price coming" : "No listings"}</div>
    </div>
  );
}
