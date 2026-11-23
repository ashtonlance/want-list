import { PlusIcon } from "lucide-react";
import { useMemo } from "react";
import type { CollectionSummary } from "~/features/cards/collections";
import { useOverlayNav } from "~/app/overlayNav";
import { byRecentUse, useRecentCollections } from "~/features/cards/recentCollections";
import { Rail, RailAction, RailItem } from "~/ui/Rail";
import { useInSideBar } from "~/ui/sideSlot";
import { patchListUi, showCollection } from "./state";

interface Props {
  colls: readonly CollectionSummary[];
  current: string | null;
  cardCount: number;
  canWrite: boolean;
}

export function CollectionTabs({ colls, current, cardCount, canWrite }: Props) {
  const { open } = useOverlayNav();
  const used = useRecentCollections();
  // Chips put the ones in use first, so they're in reach without scrolling. The side bar shows every
  // collection at once, so it keeps their saved order and nothing moves under the pointer.
  const side = useInSideBar();
  const ordered = useMemo(
    () => (side ? colls : byRecentUse(colls, (c) => c.name, used)),
    [colls, used, side],
  );
  return (
    <Rail label="Collections">
      <RailItem
        label="All cards"
        sub={`${cardCount} cards`}
        pressed={!current}
        onPick={() => showCollection(null)}
      />
      {ordered.map((c) => (
        <RailItem
          key={c.name}
          label={c.name}
          sub={`${c.got}/${c.total}`}
          progress={c.total ? c.got / c.total : 0}
          pressed={current === c.name}
          onPick={() => showCollection(c.name)}
        />
      ))}
      {canWrite ? (
        <RailAction
          onClick={() => {
            showCollection(null);
            patchListUi({ collForm: "new" });
          }}
        >
          <PlusIcon />
          New collection
        </RailAction>
      ) : null}
      <RailAction onClick={() => open({ panel: "collections" })}>
        {canWrite ? "Edit collections" : "All collections"}
      </RailAction>
    </Rail>
  );
}
