import { useMemo, useState, type SubmitEvent } from "react";
import { POCKETS, type Pockets } from "~/app/prefs";
import { useCollections } from "~/features/cards/useCollections";
import { cleanName, plural } from "~/lib/format";
import { Select } from "~/ui/Select";

interface NewBinderSheetProps {
  canScan: boolean;
  /** `from` is a collection whose cards fill the pockets in collection order, or "" for empty pages. */
  onMake: (name: string, pockets: Pockets, from: string) => void;
  onImport: () => void;
  onScan: () => void;
}

const POCKET_OPTIONS = POCKETS.map((n) => ({ value: n, label: `${n} pockets` }));

export function NewBinderSheet({ canScan, onMake, onImport, onScan }: NewBinderSheetProps) {
  const [name, setName] = useState("");
  const [pockets, setPockets] = useState<Pockets>(9);
  const [from, setFrom] = useState("");
  const { collections } = useCollections();
  const fromOptions = useMemo(
    () => [
      { value: "", label: "Empty pages" },
      ...collections
        .filter((c) => c.total > 0)
        .map((c) => ({ value: c.name, label: `${c.name} · ${plural(c.total, "card")}` })),
    ],
    [collections],
  );
  const pickFrom = (coll: string) => {
    // Name it after the collection unless a name of their own is already typed.
    if (coll && (!cleanName(name) || name === from)) setName(coll);
    setFrom(coll);
  };
  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const n = cleanName(name);
    if (n) onMake(n, pockets, from);
  };
  return (
    <form className="sheet-form" autoComplete="off" onSubmit={submit}>
      <label>
        Binder name
        <input
          type="text"
          placeholder="e.g. Gengar binder"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Start with
        <Select value={from} options={fromOptions} onChange={pickFrom} />
      </label>
      <label>
        Pockets per page
        <Select value={pockets} options={POCKET_OPTIONS} onChange={setPockets} />
      </label>
      <button className="btn primary" type="submit">
        Make binder
      </button>
      <button className="btn" type="button" onClick={onImport}>
        Import a shared code
      </button>
      {canScan ? (
        <button className="btn" type="button" onClick={onScan}>
          Scan photos of binder pages
        </button>
      ) : null}
    </form>
  );
}
