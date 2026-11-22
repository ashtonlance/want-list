import { formatMoney } from "~/lib/format";
import { allCollections } from "~/features/cards/collections";
import { isGot, priceOf } from "~/features/cards/pricing";
import type { Card } from "~/features/cards/types";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span>
      <b>{value}</b> {label}
    </span>
  );
}

export function Stats({ cards, loaded }: { cards: readonly Card[]; loaded: boolean }) {
  if (!loaded) {
    return (
      <div className="stats">
        <span>Loading the list…</span>
      </div>
    );
  }
  const want = cards.filter((c) => !isGot(c));
  const total = want.reduce((s, c) => s + (priceOf(c) ?? 0), 0);
  const deals = want.filter((c) => c.deal?.total != null).length;
  return (
    <div className="stats">
      <Stat value={String(want.length)} label="wanted" />
      <Stat value={formatMoney(Math.round(total)).replace(/\.00$/, "")} label="to buy them all" />
      {deals ? <Stat value={String(deals)} label="shipped deals" /> : null}
      <Stat value={String(allCollections(cards).length)} label="collections" />
    </div>
  );
}
