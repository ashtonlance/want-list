import { useState } from "react";
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
        <label key={n} className="opt">
          <input
            type="checkbox"
            checked={c.collections.includes(n)}
            onChange={(e) =>
              e.target.checked ? add(n) : void save(c, removeFromCollection(c, n), `Removed from ${n}`)
            }
          />
          {n}
        </label>
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
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={colls.length ? "Or start a new collection" : "Name a collection, e.g. Gengar binder"}
          aria-label="New collection"
        />
        <button className="btn small" type="submit">
          Add
        </button>
      </form>
    </div>
  );
}
