import { useState, type SubmitEvent } from "react";
import { POCKETS, type Pockets } from "~/app/prefs";
import { cleanName } from "~/lib/format";
import { Select } from "~/ui/Select";

interface NewBinderSheetProps {
  canScan: boolean;
  onMake: (name: string, pockets: Pockets) => void;
  onImport: () => void;
  onScan: () => void;
}

const POCKET_OPTIONS = POCKETS.map((n) => ({ value: n, label: `${n} pockets` }));

export function NewBinderSheet({ canScan, onMake, onImport, onScan }: NewBinderSheetProps) {
  const [name, setName] = useState("");
  const [pockets, setPockets] = useState<Pockets>(9);
  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const n = cleanName(name);
    if (n) onMake(n, pockets);
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
