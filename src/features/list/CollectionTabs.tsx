import type { CollectionSummary } from "~/features/cards/collections";
import { patchListUi, showCollection } from "./state";

interface TabProps {
  label: string;
  sub?: string;
  pressed: boolean;
  onClick: () => void;
  className?: string;
}

function Tab({ label, sub, pressed, onClick, className = "" }: TabProps) {
  return (
    <button className={"colltab " + className} type="button" aria-pressed={pressed} onClick={onClick}>
      <b>{label}</b>
      {sub ? <span>{sub}</span> : null}
    </button>
  );
}

interface Props {
  colls: readonly CollectionSummary[];
  current: string | null;
  cardCount: number;
  canWrite: boolean;
}

export function CollectionTabs({ colls, current, cardCount, canWrite }: Props) {
  return (
    <div className="colltabs">
      <Tab
        label="All cards"
        sub={`${cardCount} cards`}
        pressed={!current}
        onClick={() => showCollection(null)}
      />
      {colls.map((c) => (
        <Tab
          key={c.name}
          label={c.name}
          sub={`${c.got}/${c.total}`}
          pressed={current === c.name}
          onClick={() => showCollection(c.name)}
        />
      ))}
      {canWrite ? (
        <Tab
          label="+ New collection"
          pressed={false}
          className="new"
          onClick={() => {
            showCollection(null);
            patchListUi({ collForm: "new" });
          }}
        />
      ) : null}
    </div>
  );
}
