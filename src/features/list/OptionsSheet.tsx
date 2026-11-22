import { prefs } from "~/app/prefs";
import { LIST_SORTS } from "~/features/cards/filters";
import { useAuth } from "~/features/auth/AuthProvider";
import { useStore } from "~/lib/store";
import { Seg } from "~/ui/Seg";
import { Select } from "~/ui/Select";
import { Sheet, SheetHead } from "~/ui/Sheet";
import { patchListUi, startSelecting, stopSelecting, useListUi } from "./state";
import { useActiveCollection } from "./useActiveCollection";

const LAYOUTS = [
  { value: "grid", label: "Grid" },
  { value: "rows", label: "List" },
] as const;

export function OptionsSheet({ onClose }: { onClose: () => void }) {
  const sort = useStore(prefs.sort);
  const layout = useStore(prefs.layout);
  const { prio, selecting } = useListUi();
  const coll = useActiveCollection();
  const { canWrite } = useAuth();
  return (
    <Sheet label="Sort and view" onClose={onClose}>
      <SheetHead title="Sort and view" />
      <div className="sheet-form">
        <label>
          Sort by
          <Select aria-label="Sort" value={sort} options={LIST_SORTS} onChange={(v) => prefs.sort.set(v)} />
        </label>
        <div className="field">
          <span>Layout</span>
          <Seg label="Layout" value={layout} options={LAYOUTS} onChange={(v) => prefs.layout.set(v)} />
        </div>
        <div className="row-btns">
          <button
            type="button"
            className="chip-toggle"
            aria-pressed={prio}
            onClick={() => patchListUi({ prio: !prio })}
          >
            Priority only
          </button>
          {canWrite ? (
            <button
              type="button"
              className="chip-toggle"
              aria-pressed={selecting}
              onClick={() => {
                onClose();
                if (selecting) stopSelecting();
                else startSelecting("", coll);
              }}
            >
              {selecting ? "Stop selecting" : "Select cards"}
            </button>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}
