import { PlusIcon } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { Toggle } from "~/components/ui/toggle";
import type { CollectionSummary } from "~/features/cards/collections";
import { useOverlayNav } from "~/app/overlayNav";
import { byRecentUse, useRecentCollections } from "~/features/cards/recentCollections";
import { patchListUi, showCollection } from "./state";

interface TabProps {
  label: string;
  sub: string;
  pressed: boolean;
  onPick: () => void;
}

/** One collection to show. Pressing the one already shown keeps it shown. */
function Tab({ label, sub, pressed, onPick }: TabProps) {
  return (
    <Toggle pressed={pressed} onPressedChange={onPick}>
      <b>{label}</b>
      <span>{sub}</span>
    </Toggle>
  );
}

/** The quieter pills after the collections, which open something instead of picking a collection. */
function ActionTab({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className="rounded-full" onClick={onClick}>
      {children}
    </Button>
  );
}

interface Props {
  colls: readonly CollectionSummary[];
  current: string | null;
  cardCount: number;
  canWrite: boolean;
}

export function CollectionTabs({ colls, current, cardCount, canWrite }: Props) {
  const { open } = useOverlayNav();
  const used = useRecentCollections();
  const ordered = useMemo(() => byRecentUse(colls, (c) => c.name, used), [colls, used]);
  return (
    <div className="colltabs">
      <Tab
        label="All cards"
        sub={`${cardCount} cards`}
        pressed={!current}
        onPick={() => showCollection(null)}
      />
      {ordered.map((c) => (
        <Tab
          key={c.name}
          label={c.name}
          sub={`${c.got}/${c.total}`}
          pressed={current === c.name}
          onPick={() => showCollection(c.name)}
        />
      ))}
      {canWrite ? (
        <ActionTab
          onClick={() => {
            showCollection(null);
            patchListUi({ collForm: "new" });
          }}
        >
          <PlusIcon />
          New collection
        </ActionTab>
      ) : null}
      <ActionTab onClick={() => open({ panel: "collections" })}>
        {canWrite ? "Edit collections" : "All collections"}
      </ActionTab>
    </div>
  );
}
