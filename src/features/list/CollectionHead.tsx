import { useState, type SubmitEvent } from "react";
import { POCKETS, prefs } from "~/app/prefs";
import { collectionCards } from "~/features/cards/collections";
import { useCollectionWrites } from "~/features/cards/useCollections";
import { isGot, priceOf } from "~/features/cards/pricing";
import type { Card } from "~/features/cards/types";
import { cleanName, formatMoney } from "~/lib/format";
import { useStore } from "~/lib/store";
import { Seg } from "~/ui/Seg";
import { Select } from "~/ui/Select";
import { useToast } from "~/ui/Toast";
import { patchListUi, showCollection, startSelecting, useListUi } from "./state";

const VIEWS = [
  { value: "list", label: "List" },
  { value: "binder", label: "Binder" },
] as const;
const POCKET_OPTIONS = POCKETS.map((n) => ({ value: n, label: `${n}-pocket pages` }));

/** Names a new collection, then starts picking its cards. */
function NewCollectionForm() {
  const [name, setName] = useState("");
  const { toast } = useToast();
  const submit = (e: SubmitEvent) => {
    e.preventDefault();
    const n = cleanName(name);
    if (!n) return;
    startSelecting(n, null);
    toast(`Tap cards to add them to ${n}`);
  };
  return (
    <div className="panel collhead">
      <p className="hint" style={{ margin: 0, flexBasis: "100%" }}>
        A collection is any group you&apos;re working on: a binder spread, a Pokémon, an artist. After naming
        it, tap the cards that belong, then Add to collection.
      </p>
      <form className="inline-form" autoComplete="off" onSubmit={submit}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name it, e.g. Gengar binder or Kanto starters"
          aria-label="New collection name"
          autoFocus
        />
        <button className="btn primary small" type="submit">
          Create and pick cards
        </button>
        <button className="btn small" type="button" onClick={() => patchListUi({ collForm: null })}>
          Cancel
        </button>
      </form>
    </div>
  );
}

function RenameForm({ name, onRename }: { name: string; onRename: (to: string) => void }) {
  const [value, setValue] = useState(name);
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        onRename(cleanName(value));
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="New name"
        autoFocus
      />
      <button className="btn primary small" type="submit">
        Rename
      </button>
      <button className="btn small" type="button" onClick={() => patchListUi({ collForm: null })}>
        Cancel
      </button>
    </form>
  );
}

interface Props {
  cards: readonly Card[];
  coll: string | null;
  canWrite: boolean;
}

/** The panel above the list for the collection on screen: progress, view, and changes to the collection. */
export function CollectionHead({ cards, coll, canWrite }: Props) {
  const ui = useListUi();
  const view = useStore(prefs.view);
  const pockets = useStore(prefs.pockets);
  const writes = useCollectionWrites();

  if (!coll) return ui.collForm === "new" ? <NewCollectionForm /> : null;

  const inColl = collectionCards(cards, coll);
  const got = inColl.filter(isGot).length;
  const wanted = inColl.filter((c) => !isGot(c));
  const cost = wanted.reduce((s, c) => s + (priceOf(c) ?? 0), 0);
  const unpriced = wanted.filter((c) => priceOf(c) == null).length;
  const pct = inColl.length ? Math.round((got / inColl.length) * 100) : 0;

  const rename = (to: string) => {
    patchListUi({ collForm: null });
    void writes.rename(coll, to);
  };
  const remove = () => {
    showCollection(null);
    void writes.remove(coll);
  };

  return (
    <div className="panel collhead">
      <h2>{coll}</h2>
      <div className="progress">
        <div className="bar" role="img" aria-label={`${pct}% collected`}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <small>
          {got} of {inColl.length} collected · {formatMoney(cost)} to finish
          {unpriced ? ` (${unpriced} without a price yet)` : ""}
        </small>
      </div>
      <div className="collops">
        <Seg label="View" value={view} options={VIEWS} onChange={(v) => prefs.view.set(v)} />
        {view === "binder" ? (
          <Select
            aria-label="Pockets per page"
            style={{ width: "auto" }}
            value={pockets}
            options={POCKET_OPTIONS}
            onChange={(n) => prefs.pockets.set(n)}
          />
        ) : null}
        {canWrite && ui.collForm === "rename" ? (
          <RenameForm key={coll} name={coll} onRename={rename} />
        ) : null}
        {canWrite && ui.collForm !== "rename" ? (
          <>
            <button className="btn small" type="button" onClick={() => startSelecting(coll, coll)}>
              Add cards
            </button>
            <button className="btn small" type="button" onClick={() => patchListUi({ collForm: "rename" })}>
              Rename
            </button>
            {ui.confirmDelete ? (
              <>
                {/* The safe choice comes first, as in every confirm. */}
                <button
                  className="btn small"
                  type="button"
                  onClick={() => patchListUi({ confirmDelete: false })}
                >
                  Keep
                </button>
                <button className="btn small danger" type="button" onClick={remove}>
                  Yes, delete
                </button>
              </>
            ) : (
              <button
                className="btn small danger"
                type="button"
                title="Removes the tag. Your cards stay on the list."
                onClick={() => patchListUi({ confirmDelete: true })}
              >
                Delete collection
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
