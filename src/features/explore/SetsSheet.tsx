import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { Sheet, SheetHead } from "~/ui/Sheet";
import { LoadError } from "~/ui/LoadError";
import { useTdSets } from "./live";
import { SearchInput } from "~/ui/SearchInput";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Every English set, newest first, with a search box. Picking one shows its cards. */
export function SetsSheet({ onClose }: { onClose: () => void }) {
  const sets = useTdSets();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const all = sets.data?.sets ?? [];
    const words = fold(q).split(/\s+/).filter(Boolean);
    return words.length ? all.filter((s) => words.every((w) => fold(s.name).includes(w))) : all;
  }, [sets.data, q]);

  return (
    <Sheet label="All sets" onClose={onClose}>
      <SheetHead title="All sets" />
      <div className="sheet-form">
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a set, like Evolving Skies"
          aria-label="Find a set"
          enterKeyHint="search"
        />
        {sets.isError && !sets.data ? (
          <LoadError
            text="Couldn't load the sets. Check your connection and try again."
            onRetry={() => void sets.refetch()}
          />
        ) : !sets.data ? (
          <p className="hint">Loading sets…</p>
        ) : shown.length ? (
          <ul className="set-list">
            {shown.map((s) => (
              <li key={s.id}>
                <Button
                  variant="ghost"
                  className="min-h-0 w-full items-baseline justify-between gap-3 rounded-none px-0 py-3 text-left font-normal whitespace-normal hover:bg-transparent active:scale-100"
                  onClick={() => void navigate({ to: "/explore", search: { set: s.id }, replace: true })}
                >
                  <b>{s.name}</b>
                  <small>{s.count.toLocaleString()} cards</small>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">No set matches “{q.trim()}”.</p>
        )}
        <p className="hint">English sets, newest first. Japanese cards are in Every card.</p>
      </div>
    </Sheet>
  );
}
