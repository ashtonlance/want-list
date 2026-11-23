import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useAuth } from "~/features/auth/AuthProvider";
import { formatDate, formatMoney, parseMoney, today } from "~/lib/format";
import { useCardWrites } from "./api";
import { keepsAsk, usePriceCheck } from "./priceCheck";
import { isManual, tcgMarket } from "./pricing";
import { MANUAL_SOURCE, NO_ASK, type Card } from "./types";

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
      // A seller's ask or a price typed in by hand stays beside the market price; one the check filled
      // in is the same TCGplayer data shown above.
      c.ask?.amount != null && keepsAsk(c.ask)
        ? `${isManual(c.ask) ? "your price" : `${c.ask.source || "seller"} ask`} ${formatMoney(c.ask.amount)}${c.ask.asOf ? ` (${formatDate(c.ask.asOf)})` : ""}`
        : "",
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <div className="price">
        <div className="ask mono">{formatMoney(market)}</div>
        <div className="ask-label">TCGplayer market{c.tcg.asOf ? ` · ${formatDate(c.tcg.asOf)}` : ""}</div>
        {extra ? <div className="ask-label">{extra}</div> : null}
        <ManualPriceEdit card={c} />
      </div>
    );
  }
  const ASK_LABELS = {
    ask:
      c.ask?.source === "TCGplayer lowest listing"
        ? "TCGplayer lowest listing"
        : "lowest ask, before shipping",
    market: "TCGplayer market, before shipping",
    price: c.ask?.source === MANUAL_SOURCE ? "your price" : "last price · none listed",
  } as const;
  if (c.ask && c.ask.kind !== "none" && c.ask.amount != null) {
    return (
      <div className="price">
        <div className="ask mono">{formatMoney(c.ask.amount)}</div>
        <div className="ask-label">
          {ASK_LABELS[c.ask.kind]}
          {c.ask.asOf ? ` · ${formatDate(c.ask.asOf)}` : ""}
        </div>
        <ManualPriceEdit card={c} />
      </div>
    );
  }
  return (
    <div className="price">
      <div className="none">{c.noPrice ? "No price found" : "No price yet"}</div>
      {c.noPrice ? <div className="ask-label">{c.noPrice.reason}</div> : null}
      <ManualPrice card={c} />
    </div>
  );
}

/** A price typed in by hand, for a card the price check can't find. */
function ManualPrice({ card, initial = "", onDone }: { card: Card; initial?: string; onDone?: () => void }) {
  const { canWrite } = useAuth();
  const { save } = useCardWrites();
  const [value, setValue] = useState(initial);
  if (!canWrite) return null;
  const amount = parseMoney(value);
  return (
    <form
      className="manual-price"
      onSubmit={(e) => {
        e.preventDefault();
        if (amount == null) return;
        onDone?.();
        void save(
          card,
          { ask: { kind: "price", amount, source: MANUAL_SOURCE, asOf: today() }, noPrice: null },
          "Price saved",
        );
      }}
    >
      <Input
        className="max-w-[140px] flex-1"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="$0.00"
        aria-label={`Price for ${card.name}`}
        enterKeyHint="done"
      />
      <Button type="submit" disabled={amount == null}>
        Set price
      </Button>
    </form>
  );
}

/** Lets an editor change or remove a price they typed in, since the price check never replaces it. */
function ManualPriceEdit({ card }: { card: Card }) {
  const { canWrite } = useAuth();
  const { save } = useCardWrites();
  const checkPrice = usePriceCheck();
  const [editing, setEditing] = useState(false);
  if (!canWrite || !isManual(card.ask)) return null;
  if (editing)
    return (
      <ManualPrice card={card} initial={String(card.ask?.amount ?? "")} onDone={() => setEditing(false)} />
    );
  return (
    <div className="manual-price-acts">
      <Button variant="link" onClick={() => setEditing(true)}>
        Change your price
      </Button>
      <Button
        variant="link"
        onClick={() =>
          void save(card, { ask: NO_ASK }, "Price removed").then((ok) => {
            if (ok) void checkPrice({ ...card, ask: NO_ASK }).catch(() => undefined);
          })
        }
      >
        Remove it
      </Button>
    </div>
  );
}
