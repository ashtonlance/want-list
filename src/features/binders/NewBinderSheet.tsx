import { useMemo, useState, type SubmitEvent } from "react";
import { POCKETS, type Pockets } from "~/app/prefs";
import { useCollections } from "~/features/cards/useCollections";
import { cleanName, plural } from "~/lib/format";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
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
  // True while the name is one this sheet filled in, so picking another collection may replace it.
  const [autoName, setAutoName] = useState(false);
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
    if (!coll && autoName) {
      // A name filled in from a collection goes with it.
      setName("");
      setAutoName(false);
    } else if (coll && (!cleanName(name) || autoName)) {
      setName(coll);
      setAutoName(true);
    }
    setFrom(coll);
  };
  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const n = cleanName(name);
    if (n) onMake(n, pockets, from);
  };
  return (
    <form className="sheet-form" autoComplete="off" onSubmit={submit}>
      <Label>
        Binder name
        <Input
          placeholder="e.g. Gengar binder"
          required
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setAutoName(false);
          }}
        />
      </Label>
      <Label>
        Start with
        <Select value={from} options={fromOptions} onChange={pickFrom} />
      </Label>
      <Label>
        Pockets per page
        <Select value={pockets} options={POCKET_OPTIONS} onChange={setPockets} />
      </Label>
      <Button variant="default" type="submit">
        Make binder
      </Button>
      <Button onClick={onImport}>Import a shared code</Button>
      {canScan ? <Button onClick={onScan}>Scan photos of binder pages</Button> : null}
    </form>
  );
}
