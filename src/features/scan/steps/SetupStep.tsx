import { useId, type ChangeEvent } from "react";
import { POCKETS, asPockets, type Pockets } from "~/app/prefs";
import type { Binder } from "~/features/binders/types";
import { Seg } from "~/ui/Seg";
import { Select } from "~/ui/Select";
import { GRID } from "../session";

interface SetupStepProps {
  pockets: Pockets;
  dest: string;
  name: string;
  /** Binders the pages could go into: those with the same page size. */
  binders: readonly Binder[];
  onPockets: (pockets: Pockets) => void;
  onDest: (dest: string) => void;
  onName: (name: string) => void;
  onFiles: (files: File[]) => void;
}

const pocketOptions = POCKETS.map((n) => ({ value: String(n), label: `${GRID[n][0]} × ${GRID[n][1]}` }));

// Some phones leave the type off HEIC files, so the name counts too.
const isImage = (f: File) => f.type.startsWith("image/") || /\.(jpe?g|png|heic|webp)$/i.test(f.name);

export function SetupStep({
  pockets,
  dest,
  name,
  binders,
  onPockets,
  onDest,
  onName,
  onFiles,
}: SetupStepProps) {
  const fileId = useId();
  const destOptions = [
    { value: "new", label: "A new binder" },
    ...binders.map((b) => ({ value: b.id, label: `Add to ${b.name}` })),
  ];

  const choose = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].filter(isImage);
    // Cleared so choosing the same photos again (after Start over) still counts as a change.
    e.target.value = "";
    if (files.length) onFiles(files);
  };

  return (
    <div className="sheet-form">
      <p className="hint">
        Take a photo of each binder page, straight on, with the whole page in the frame. I'll read every
        pocket and show you what I found before anything is saved.
      </p>
      <div className="field">
        <span>Pockets per page</span>
        <Seg
          label="Pockets per page"
          value={String(pockets)}
          options={pocketOptions}
          onChange={(v) => {
            const n = asPockets(Number(v));
            if (n) onPockets(n);
          }}
        />
      </div>
      <label>
        Where the pages go
        <Select aria-label="Where the pages go" value={dest} options={destOptions} onChange={onDest} />
      </label>
      {dest === "new" ? (
        <label>
          Binder name
          <input
            type="text"
            value={name}
            placeholder="Binder name"
            aria-label="Binder name"
            autoComplete="off"
            onChange={(e) => onName(e.target.value)}
          />
        </label>
      ) : null}
      <input type="file" accept="image/*" multiple className="vh" id={fileId} onChange={choose} />
      <label className="btn primary" htmlFor={fileId}>
        Choose page photos
      </label>
      <p className="hint">
        You can pick several photos at once, one per page. On iPhone you can also take them now.
      </p>
    </div>
  );
}
