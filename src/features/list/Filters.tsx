import { prefs } from "~/app/prefs";
import { Button } from "~/components/ui/button";
import { useOverlayNav } from "~/app/overlayNav";
import type { StatusFilter } from "~/features/cards/filters";
import { plural } from "~/lib/format";
import { queryWords } from "~/lib/textSearch";
import { useStore } from "~/lib/store";
import { SlidersIcon } from "~/ui/icons";
import { Seg } from "~/ui/Seg";
import { SearchInput } from "~/ui/SearchInput";
import { useStuck } from "~/ui/useStuck";
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
  const tools = useStuck();
  return (
    <div className="filters" ref={tools}>
      <div className="filter-row">
        <SearchInput
          wrapClassName="flex-1"
          value={q}
          onChange={(e) => patchListUi({ q: e.target.value })}
          placeholder="Search name, set or number"
          aria-label="Search"
          enterKeyHint="search"
        />
        <Button
          size="icon-lg"
          className="opt-btn"
          aria-label="Sort and view options"
          onClick={() => open({ panel: "options" })}
        >
          <SlidersIcon />
          {prio || sort !== "list" ? <span className="dot" /> : null}
        </Button>
      </div>
      <div className="filter-row">
        {queryWords(q).length ? (
          // A search looks through wanted and collected cards together (see visibleCards).
          <span className="search-scope">Searching Want and Got</span>
        ) : (
          <Seg
            label="Show"
            className="max-w-[340px] flex-1"
            value={status}
            options={STATUSES}
            onChange={(s) => patchListUi({ status: s })}
          />
        )}
        <span className="count">{plural(count, "card")}</span>
      </div>
    </div>
  );
}
