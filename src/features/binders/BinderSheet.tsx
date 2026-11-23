import type { ReactNode } from "react";
import type { Pockets } from "~/app/prefs";
import type { Card } from "~/features/cards/types";
import { Sheet, SheetHead } from "~/ui/Sheet";
import { ImportSheet } from "./ImportSheet";
import { NewBinderSheet } from "./NewBinderSheet";
import { OptionsSheet } from "./OptionsSheet";
import { PickCardSheet } from "./PickCardSheet";
import { PocketSheet } from "./PocketSheet";
import { cardIdsIn, withSlot, type SlotInfo, type Slots } from "./slots";
import type { Binder, WebSlot } from "./types";

export type SheetState =
  | { kind: "new" }
  | { kind: "import" }
  | { kind: "options" }
  | { kind: "pocket"; idx: number }
  | { kind: "pick"; idx: number };

export interface BinderSheetActions {
  open: (sheet: SheetState) => void;
  close: () => void;
  scan: () => void;
  /** Makes a binder, filled with a collection's cards when `from` names one. */
  make: (name: string, pockets: Pockets, from: string) => void;
  importBinder: (b: Binder) => void;
  saveOptions: (b: Binder) => void;
  /** Saves new slots with an Undo toast. */
  changeSlots: (slots: Slots, message: string) => void;
  deleteBinder: () => void;
  startMove: (idx: number) => void;
  addToList: (idx: number, s: WebSlot) => Promise<void>;
}

interface BinderSheetProps {
  sheet: SheetState;
  binder: Binder | null;
  infos: readonly (SlotInfo | null)[];
  cards: readonly Card[];
  local: boolean;
  canScan: boolean;
  canAddToList: boolean;
  actions: BinderSheetActions;
}

/** Whichever bottom sheet is open over the binders. */
export function BinderSheet(props: BinderSheetProps) {
  const body = sheetBody(props);
  if (!body) return null;
  return (
    <Sheet label={body.title} onClose={props.actions.close} contentKey={body.key}>
      <SheetHead title={body.title} />
      {body.content}
    </Sheet>
  );
}

interface SheetBody {
  title: string;
  /** Changes when the sheet shows something else, so it scrolls back to the top and starts fresh. */
  key: string;
  content: ReactNode;
}

function sheetBody({
  sheet,
  binder,
  infos,
  cards,
  local,
  canScan,
  canAddToList,
  actions,
}: BinderSheetProps): SheetBody | null {
  if (sheet.kind === "new")
    return {
      title: "New binder",
      key: "new",
      content: (
        <NewBinderSheet
          canScan={canScan}
          onMake={actions.make}
          onImport={() => actions.open({ kind: "import" })}
          onScan={actions.scan}
        />
      ),
    };
  if (sheet.kind === "import")
    return {
      title: "Import a binder",
      key: "import",
      content: <ImportSheet onImport={actions.importBinder} />,
    };
  if (!binder) return null;
  if (sheet.kind === "options")
    return {
      title: "Binder options",
      key: "options",
      content: (
        <OptionsSheet
          binder={binder}
          cards={cards}
          local={local}
          onSave={actions.saveOptions}
          onFill={actions.changeSlots}
          onDelete={actions.deleteBinder}
        />
      ),
    };
  const { idx } = sheet;
  const key = `${sheet.kind}-${idx}`;
  if (sheet.kind === "pick")
    return {
      title: binder.slots[idx] ? "Replace card" : "Add a card",
      key,
      content: (
        <PickCardSheet
          key={key}
          cards={cards}
          inBinder={cardIdsIn(binder.slots)}
          onPlace={(slot, name) => actions.changeSlots(withSlot(binder.slots, idx, slot), `Added ${name}`)}
        />
      ),
    };
  const info = infos[idx];
  if (!info) return null;
  return {
    title: `Pocket ${(idx % binder.pockets) + 1}, page ${Math.floor(idx / binder.pockets) + 1}`,
    key,
    content: (
      <PocketSheet
        key={key}
        info={info}
        canAddToList={canAddToList}
        onMove={() => actions.startMove(idx)}
        onReplace={() => actions.open({ kind: "pick", idx })}
        onRemove={() => actions.changeSlots(withSlot(binder.slots, idx, null), `Removed ${info.name}`)}
        onAddToList={(s) => actions.addToList(idx, s)}
      />
    ),
  };
}
