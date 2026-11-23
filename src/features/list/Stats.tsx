import type { StatusFilter } from "~/features/cards/filters";
import { collectionValue, gainWord, signedMoney } from "~/features/cards/owned";
import { formatMoney } from "~/lib/format";
import { isGot, priceOf } from "~/features/cards/pricing";
import type { Card } from "~/features/cards/types";
import { useCollections } from "~/features/cards/useCollections";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span>
      <b>{value}</b> {label}
    </span>
  );
}

const dollars = (n: number) => formatMoney(Math.round(n)).replace(/\.00$/, "");

/**
 * Under the Got filter: what the cards on screen are worth and, where prices paid are recorded, how
 * those copies have done against what they cost.
 */
function GotStats({ cards }: { cards: readonly Card[] }) {
  const v = collectionValue(cards);
  const gain = Math.round(v.gain);
  return (
    <div className="stats">
      <Stat value={String(v.cards)} label={v.copies > v.cards ? `cards, ${v.copies} copies` : "got"} />
      <Stat value={dollars(v.worth)} label="worth" />
      {v.hasPaid ? (
        <Stat value={signedMoney(gain, dollars)} label={`${gainWord(gain)} on ${dollars(v.paid)} paid`} />
      ) : null}
    </div>
  );
}

export function Stats({
  cards,
  loaded,
  status,
  coll,
}: {
  cards: readonly Card[];
  loaded: boolean;
  status: StatusFilter;
  /** The collection on screen, which the Got totals cover; null for the whole list. */
  coll: string | null;
}) {
  const collCount = useCollections().collections.length;
  if (!loaded) {
    return (
      <div className="stats">
        <span>Loading the list…</span>
      </div>
    );
  }
  if (status === "got")
    return <GotStats cards={coll ? cards.filter((c) => c.collections.includes(coll)) : cards} />;
  const want = cards.filter((c) => !isGot(c));
  const total = want.reduce((s, c) => s + (priceOf(c) ?? 0), 0);
  const deals = want.filter((c) => c.deal?.total != null).length;
  return (
    <div className="stats">
      <Stat value={String(want.length)} label="wanted" />
      <Stat value={dollars(total)} label="to buy them all" />
      {deals ? <Stat value={String(deals)} label="shipped deals" /> : null}
      <Stat value={String(collCount)} label="collections" />
    </div>
  );
}
