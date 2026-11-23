import { useRef, type SubmitEvent } from "react";
import { prefs } from "~/app/prefs";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useCardWrites } from "~/features/cards/api";
import { addToCollection, collectionCards, removeFromCollection } from "~/features/cards/collections";
import type { Card } from "~/features/cards/types";
import { cleanName, plural } from "~/lib/format";
import { useToast } from "~/ui/Toast";
import { COLL_LIST } from "./Datalists";
import { patchListUi, stopSelecting, useListUi } from "./state";

interface Props {
  cards: readonly Card[];
  visible: readonly Card[];
  coll: string | null;
}

/** The bar at the bottom while picking cards: add them to a collection, or take them out of this one. */
export function BulkBar({ cards, visible, coll }: Props) {
  const { selected, bulkColl } = useListUi();
  const { saveMany } = useCardWrites();
  const { toast } = useToast();
  const input = useRef<HTMLInputElement>(null);

  const add = (e: SubmitEvent) => {
    e.preventDefault();
    const n = cleanName(bulkColl);
    if (!n) {
      input.current?.focus();
      toast("Name the collection first");
      return;
    }
    const picked = cards.filter((c) => selected.has(c.id) && !c.collections.includes(n));
    if (!picked.length) {
      toast(selected.size ? `Those cards are already in ${n}` : "Tap some cards first");
      return;
    }
    const start = collectionCards(cards, n).length;
    stopSelecting();
    prefs.coll.set(n);
    void saveMany(
      picked.map((c, i) => [c, addToCollection(c, n, start + i)] as const),
      `Added ${plural(picked.length, "card")} to ${n}`,
    );
  };

  const removeHere = () => {
    if (!coll) return;
    const picked = cards.filter((c) => selected.has(c.id) && c.collections.includes(coll));
    if (!picked.length) {
      toast("Tap some cards first");
      return;
    }
    stopSelecting();
    void saveMany(
      picked.map((c) => [c, removeFromCollection(c, coll)] as const),
      `Removed ${plural(picked.length, "card")} from ${coll}`,
      {},
    );
  };

  return (
    <div className="bulk">
      <div className="inner">
        <div className="bulk-top">
          <b>{selected.size} selected</b>
          <div className="bulk-btns">
            <Button
              size="sm"
              onClick={() => patchListUi({ selected: new Set([...selected, ...visible.map((c) => c.id)]) })}
            >
              Select all
            </Button>
            <Button size="sm" variant="default" onClick={stopSelecting}>
              Done
            </Button>
          </div>
        </div>
        <form className="inline-form" autoComplete="off" onSubmit={add}>
          <Input
            ref={input}
            className="w-auto flex-auto"
            list={COLL_LIST}
            value={bulkColl}
            onChange={(e) => patchListUi({ bulkColl: e.target.value })}
            placeholder="Collection name"
            aria-label="Collection name"
          />
          <Button variant="default" type="submit">
            Add
          </Button>
        </form>
        {coll && bulkColl.trim() === coll ? (
          <Button size="sm" variant="destructive" onClick={removeHere}>
            Remove from this collection
          </Button>
        ) : null}
      </div>
    </div>
  );
}
