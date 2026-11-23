import { useMemo, useState, type ReactNode } from "react";
import { useCards } from "~/features/cards/api";
import { useAddCards, type WantOrGot } from "~/features/cards/create";
import { isGot } from "~/features/cards/pricing";
import { realPrice, setOf, type Catalog, type CatalogCard } from "~/features/catalog/catalog";
import { catalogLiveCard } from "~/features/explore/live";
import { listLookup } from "~/features/explore/onList";
import { formatMoney } from "~/lib/format";
import { tcgImage } from "~/lib/images";
import { PickTile } from "~/ui/PickTile";
import { useToast } from "~/ui/Toast";

interface CatalogTilesProps {
  cat: Catalog;
  rows: readonly CatalogCard[];
  coll: string;
  addAs: WantOrGot;
  children?: ReactNode;
}

/** Catalog printings with pictures. A tap adds one straight to the list, or says it's already there. */
export function CatalogTiles({ cat, rows, coll, addAs, children }: CatalogTilesProps) {
  const { cards } = useCards();
  const { fromLive } = useAddCards();
  const { toast } = useToast();
  const onList = useMemo(() => listLookup(cards), [cards]);
  const [adding, setAdding] = useState<ReadonlySet<number>>(new Set());

  const add = async (c: CatalogCard) => {
    if (adding.has(c.pid)) return;
    const d = catalogLiveCard(cat, c);
    const have = onList(d);
    // Already there with nothing to change: say so rather than claim it was added.
    if (have && (!coll || have.collections.includes(coll)) && (addAs === "want" || isGot(have))) {
      toast(coll ? `${c.name} is already in ${coll}` : `${c.name} is already on your list`);
      return;
    }
    setAdding((s) => new Set(s).add(c.pid));
    try {
      await fromLive(d, addAs, coll);
    } finally {
      setAdding((s) => {
        const next = new Set(s);
        next.delete(c.pid);
        return next;
      });
    }
  };

  return (
    <div className="pick-grid add-results">
      {rows.map((c) => {
        const set = setOf(cat, c);
        const market = realPrice(c.market);
        const have = onList(catalogLiveCard(cat, c));
        const tag = adding.has(c.pid)
          ? "Adding…"
          : have
            ? isGot(have)
              ? "✓ Got it"
              : "✓ On list"
            : market
              ? "~" + formatMoney(market)
              : "+ Add";
        return (
          <PickTile
            key={c.pid}
            src={tcgImage(c.pid)}
            name={c.name}
            sub={`${set.jp ? "JP · " : ""}${set.name} · #${c.number}`}
            tag={tag}
            onPick={() => void add(c)}
          />
        );
      })}
      {children}
    </div>
  );
}
