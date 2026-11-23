import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Toggle } from "~/components/ui/toggle";
import { useCardWrites } from "./api";
import { addToCollection, collectionCards, removeFromCollection } from "./collections";
import { useCollections } from "./useCollections";
import { cleanName } from "~/lib/format";
import type { Card } from "./types";

/** Ticks a card into and out of collections, or starts a new one with it. */
export function TagPicker({ card: c, cards }: { card: Card; cards: readonly Card[] }) {
  const { save } = useCardWrites();
  const [name, setName] = useState("");
  const colls = useCollections().collections.map((x) => x.name);
  const add = (n: string) =>
    void save(c, addToCollection(c, n, collectionCards(cards, n).length), `Added to ${n}`);
  return (
    <div className="picker">
      {colls.map((n) => (
        <Toggle
          key={n}
          pressed={c.collections.includes(n)}
          onPressedChange={(on) =>
            on ? add(n) : void save(c, removeFromCollection(c, n), `Removed from ${n}`)
          }
        >
          {n}
        </Toggle>
      ))}
      <form
        className="inline-form"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          const n = cleanName(name);
          if (!n || c.collections.includes(n)) return;
          setName("");
          add(n);
        }}
      >
        <Input
          className="w-auto flex-[1_1_180px] bg-card"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={colls.length ? "Or start a new collection" : "Name a collection, e.g. Gengar binder"}
          aria-label="New collection"
        />
        <Button size="sm" type="submit">
          Add
        </Button>
      </form>
    </div>
  );
}
