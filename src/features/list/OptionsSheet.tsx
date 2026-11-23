import { prefs } from "~/app/prefs";
import { Label } from "~/components/ui/label";
import { Toggle } from "~/components/ui/toggle";
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
        <Label>
          Sort by
          <Select aria-label="Sort" value={sort} options={LIST_SORTS} onChange={(v) => prefs.sort.set(v)} />
        </Label>
        <div className="field">
          <span>Layout</span>
          <Seg label="Layout" value={layout} options={LAYOUTS} onChange={(v) => prefs.layout.set(v)} />
        </div>
        <div className="row-btns">
          <Toggle pressed={prio} onPressedChange={(on) => patchListUi({ prio: on })}>
            Priority only
          </Toggle>
          {canWrite ? (
            <Toggle
              pressed={selecting}
              onPressedChange={(on) => {
                onClose();
                if (on) startSelecting("", coll);
                else stopSelecting();
              }}
            >
              {selecting ? "Stop selecting" : "Select cards"}
            </Toggle>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}
