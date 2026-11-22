import { useMemo, useState } from "react";
import { POCKETS, type Pockets } from "~/app/prefs";
import { collectionCards } from "~/features/cards/collections";
import type { Card } from "~/features/cards/types";
import { cleanName, plural } from "~/lib/format";
import { Select } from "~/ui/Select";
import { useToast } from "~/ui/Toast";
import { shareCode } from "./shareCode";
import { cardIdsIn, fillEmpty, repage, type Slots } from "./slots";
import type { Binder } from "./types";
import { useCollections } from "~/features/cards/useCollections";

interface OptionsSheetProps {
  binder: Binder;
  cards: readonly Card[];
  /** True when binders save on this device, so sharing means texting the code to Ashton. */
  local: boolean;
  onSave: (b: Binder) => void;
  onFill: (slots: Slots, message: string) => void;
  onDelete: () => void;
}

const PAGE_SIZES = POCKETS.map((n) => ({ value: n, label: `${n} pockets per page` }));
const HOW_TO_IMPORT = "Open Binders, tap + New binder, then Import a shared code, and paste this:\n\n";

export function OptionsSheet({ binder: b, cards, local, onSave, onFill, onDelete }: OptionsSheetProps) {
  const { toast } = useToast();
  const [name, setName] = useState(b.name);
  const [pockets, setPockets] = useState<Pockets>(b.pockets);
  const [coll, setColl] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const { collections } = useCollections();
  const collOptions = useMemo(
    () => [
      { value: "", label: "Pick a collection" },
      ...collections.map((c) => ({ value: c.name, label: c.name })),
    ],
    [collections],
  );
  const code = shareCode(b);

  const save = () =>
    onSave({
      ...b,
      name: cleanName(name) || b.name,
      pockets,
      slots: pockets === b.pockets ? b.slots : repage(b.slots, pockets),
    });

  const fill = () => {
    if (!coll) {
      toast("Pick a collection first");
      return;
    }
    const have = cardIdsIn(b.slots);
    const add = collectionCards(cards, coll).filter((c) => !have.has(c.id));
    if (!add.length) {
      toast(`Everything in ${coll} is already here`);
      return;
    }
    onFill(
      fillEmpty(
        b.slots,
        b.pockets,
        add.map((c) => c.id),
      ),
      `Added ${plural(add.length, "card")}`,
    );
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast("Code copied");
    } catch {
      setShowCode(true);
      toast("Select the code and copy it");
    }
  };

  return (
    <div className="sheet-form">
      <label>
        Name
        <input type="text" aria-label="Binder name" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Page size
        <Select aria-label="Pockets per page" value={pockets} options={PAGE_SIZES} onChange={setPockets} />
      </label>
      <button className="btn primary" type="button" onClick={save}>
        Save changes
      </button>

      <h4>Fill from a collection</h4>
      <p className="hint">
        Puts that collection's cards into the empty pockets, in collection order. Cards already in this binder
        are skipped.
      </p>
      <Select aria-label="Collection to fill from" value={coll} options={collOptions} onChange={setColl} />
      <button className="btn" type="button" onClick={fill}>
        Fill empty pockets
      </button>

      <h4>Share</h4>
      <p className="hint">
        {local
          ? "Copy this code and text it to Ashton. He can import it from his binders."
          : "Copy this code to send the layout to someone who isn't signed in, or to keep a backup."}
      </p>
      <a
        className="btn primary"
        href={
          "sms:?&body=" +
          encodeURIComponent(`Binder layout for the want list (${b.name}). ${HOW_TO_IMPORT}${code}`)
        }
      >
        Text it
      </a>
      <a
        className="btn"
        href={
          "mailto:?subject=" +
          encodeURIComponent(`Binder layout: ${b.name}`) +
          "&body=" +
          encodeURIComponent(HOW_TO_IMPORT + code)
        }
      >
        Email it
      </a>
      <button className="btn" type="button" onClick={copy}>
        Copy share code
      </button>
      {showCode ? <CodeBox code={code} /> : null}

      <h4>Delete</h4>
      {confirming ? (
        <div className="row-btns">
          <button className="btn danger" type="button" onClick={onDelete}>
            Yes, delete {b.name}
          </button>
          <button className="btn" type="button" onClick={() => setConfirming(false)}>
            Keep it
          </button>
        </div>
      ) : (
        <button className="btn danger" type="button" onClick={() => setConfirming(true)}>
          Delete this binder
        </button>
      )}
    </div>
  );
}

/** Shown when the clipboard is refused: the code, selected and in view, to copy by hand. */
function CodeBox({ code }: { code: string }) {
  return <textarea rows={4} readOnly value={code} ref={selectInView} />;
}

function selectInView(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.scrollIntoView({ block: "center" });
  el.select();
}
