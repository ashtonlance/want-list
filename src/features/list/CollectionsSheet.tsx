import { useState } from "react";
import { useAuth } from "~/features/auth/AuthProvider";
import type { CollectionSummary } from "~/features/cards/collections";
import { useCollections, useCollectionWrites } from "~/features/cards/useCollections";
import { cleanName, formatMoney } from "~/lib/format";
import { Sheet, SheetHead } from "~/ui/Sheet";
import { showCollection } from "./state";

/** Every collection in one place: make one (empty is fine), rename, reorder, delete. */
export function CollectionsSheet({ onClose }: { onClose: () => void }) {
  const { collections } = useCollections();
  const writes = useCollectionWrites();
  const { canWrite } = useAuth();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const names = collections.map((c) => c.name);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    const a = names[i];
    const b = names[j];
    if (a === undefined || b === undefined) return;
    const next = names.slice();
    next[i] = b;
    next[j] = a;
    void writes.reorder(next);
  };

  const go = (n: string) => {
    onClose();
    showCollection(n);
  };

  return (
    <Sheet label="Collections" onClose={onClose}>
      <SheetHead title="Collections" />
      <div className="sheet-form">
        {canWrite ? (
          <form
            className="inline-form"
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault();
              const n = cleanName(name);
              if (!n) return;
              void writes.create(n).then((ok) => {
                if (ok) setName("");
              });
            }}
          >
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New collection, e.g. Kids' binder"
              aria-label="New collection name"
            />
            <button className="btn primary small" type="submit">
              Add
            </button>
          </form>
        ) : (
          <p className="hint">Sign in to make or change collections.</p>
        )}
        {collections.length ? (
          <ul className="coll-manage">
            {collections.map((c, i) => (
              <li key={c.name}>
                {editing === c.name ? (
                  <RenameRow
                    name={c.name}
                    onDone={(to) => {
                      setEditing(null);
                      if (to) void writes.rename(c.name, to);
                    }}
                  />
                ) : deleting === c.name ? (
                  <div className="cm-row">
                    <span className="cm-ask">
                      Delete {c.name}? {c.total ? "Its cards stay on your list." : ""}
                    </span>
                    <button
                      className="btn small danger"
                      type="button"
                      onClick={() => {
                        setDeleting(null);
                        void writes.remove(c.name);
                      }}
                    >
                      Delete
                    </button>
                    <button className="btn small" type="button" onClick={() => setDeleting(null)}>
                      Keep
                    </button>
                  </div>
                ) : (
                  <div className="cm-row">
                    <button className="cm-name" type="button" onClick={() => go(c.name)}>
                      <b>{c.name}</b>
                      <small>{summary(c)}</small>
                    </button>
                    {canWrite ? (
                      <span className="cm-acts">
                        <button
                          type="button"
                          aria-label={`Move ${c.name} up`}
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${c.name} down`}
                          disabled={i === collections.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          ↓
                        </button>
                        <button type="button" onClick={() => setEditing(c.name)}>
                          Rename
                        </button>
                        <button type="button" className="danger" onClick={() => setDeleting(c.name)}>
                          Delete
                        </button>
                      </span>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">No collections yet.</p>
        )}
        <p className="hint">
          Tap a collection to open it, then Add cards to fill it. Deleting a collection keeps its cards on
          your list.
        </p>
      </div>
    </Sheet>
  );
}

function summary(c: CollectionSummary): string {
  if (!c.total) return "Empty";
  const left = c.total - c.got;
  return `${c.got} of ${c.total} collected${left && c.cost ? ` · ${formatMoney(c.cost)} to finish` : ""}`;
}

function RenameRow({ name, onDone }: { name: string; onDone: (to: string | null) => void }) {
  const [value, setValue] = useState(name);
  return (
    <form
      className="inline-form"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        onDone(cleanName(value) || null);
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={`New name for ${name}`}
        autoFocus
      />
      <button className="btn primary small" type="submit">
        Save
      </button>
      <button className="btn small" type="button" onClick={() => onDone(null)}>
        Cancel
      </button>
    </form>
  );
}
