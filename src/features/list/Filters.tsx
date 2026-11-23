import { prefs } from "~/app/prefs";
import { useOverlayNav } from "~/app/overlayNav";
import type { StatusFilter } from "~/features/cards/filters";
import { plural } from "~/lib/format";
import { useStore } from "~/lib/store";
import { SlidersIcon } from "~/ui/icons";
import { Seg } from "~/ui/Seg";
import { patchListUi, useListUi } from "./state";

const STATUSES: { value: StatusFilter; label: string }[] = [
  { value: "want", label: "Want" },
  { value: "got", label: "Got" },
  { value: "all", label: "All" },
];

export function Filters({ count }: { count: number }) {
  const { q, status, prio } = useListUi();
  const sort = useStore(prefs.sort);
  const { open } = useOverlayNav();
  return (
    <div className="filters">
      <div className="filter-row">
        <input
          type="search"
          value={q}
          onChange={(e) => patchListUi({ q: e.target.value })}
          placeholder="Search name, set or number"
          aria-label="Search"
          enterKeyHint="search"
        />
        <button
          type="button"
          className="icon-btn opt-btn"
          aria-label="Sort and view options"
          onClick={() => open({ panel: "options" })}
        >
          <SlidersIcon />
          {prio || sort !== "list" ? <span className="dot" /> : null}
        </button>
      </div>
      <div className="filter-row">
        {q.trim() ? (
          // A search looks through wanted and collected cards together (see visibleCards).
          <span className="search-scope">Searching Want and Got</span>
        ) : (
          <Seg label="Show" value={status} options={STATUSES} onChange={(s) => patchListUi({ status: s })} />
        )}
        <span className="count">{plural(count, "card")}</span>
      </div>
    </div>
  );
}
