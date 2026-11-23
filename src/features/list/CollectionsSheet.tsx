import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useState } from "react";
import { useAuth } from "~/features/auth/AuthProvider";
import type { CollectionSummary } from "~/features/cards/collections";
import { useCollections, useCollectionWrites } from "~/features/cards/useCollections";
import { cleanName, formatMoney } from "~/lib/format";
import { Sheet, SheetHead } from "~/ui/Sheet";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { showCollection } from "./state";

/** A name field in an inline form: it takes the room left on the line, and wraps under below 180px. */
const inlineInput = "w-auto flex-[1_1_180px]";
/** The collection's name and progress, a plain text row that opens it. */
const nameClass =
  "cm-name block min-h-0 min-w-0 flex-[1_1_140px] rounded-none bg-transparent px-0 py-1 text-left font-normal whitespace-normal hover:bg-transparent active:scale-100 active:opacity-70";

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
            <Input
              className={inlineInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New collection, e.g. Kids' binder"
              aria-label="New collection name"
            />
            <Button size="sm" variant="default" type="submit">
              Add
            </Button>
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
                    <Button size="sm" onClick={() => setDeleting(null)}>
                      Keep
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setDeleting(null);
                        void writes.remove(c.name);
                      }}
                    >
                      Yes, delete
                    </Button>
                  </div>
                ) : (
                  <div className="cm-row">
                    <Button variant="ghost" className={nameClass} onClick={() => go(c.name)}>
                      <b>{c.name}</b>
                      <small>{summary(c)}</small>
                    </Button>
                    {canWrite ? (
                      <span className="cm-acts">
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={`Move ${c.name} up`}
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          <ArrowUpIcon />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={`Move ${c.name} down`}
                          disabled={i === collections.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDownIcon />
                        </Button>
                        <Button size="sm" onClick={() => setEditing(c.name)}>
                          Rename
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setDeleting(c.name)}>
                          Delete
                        </Button>
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
      <Input
        className={inlineInput}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={`New name for ${name}`}
        autoFocus
      />
      <Button size="sm" variant="default" type="submit">
        Save
      </Button>
      <Button size="sm" onClick={() => onDone(null)}>
        Cancel
      </Button>
    </form>
  );
}
