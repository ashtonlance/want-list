import { XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { Toggle } from "~/components/ui/toggle";
import { SlidersIcon } from "./icons";
import { Sheet, SheetHead } from "./Sheet";

/**
 * The pieces of a "Filter and sort" setup: one button in the toolbar, the filters that are on shown as
 * chips under it, and every option in a sheet. Keeps a screen calm while leaving every filter a tap away.
 */

/** The toolbar button that opens the sheet. The dot says something is filtered or re-sorted. */
export function FilterButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <Button
      size="icon-lg"
      className="opt-btn"
      aria-label={on ? "Filter and sort, some on" : "Filter and sort"}
      onClick={onClick}
    >
      <SlidersIcon />
      {on ? <span className="dot" /> : null}
    </Button>
  );
}

export interface ActiveFilter {
  key: string;
  label: string;
  clear: () => void;
}

/** The filters that are on, each a chip that turns it off, plus Clear all when there are several. */
export function ActiveFilters({
  items,
  onClearAll,
}: {
  items: readonly ActiveFilter[];
  onClearAll: () => void;
}) {
  if (!items.length) return null;
  return (
    <div className="scroller active-filters" role="group" aria-label="Filters on">
      {items.map((f) => (
        <Button
          key={f.key}
          size="sm"
          className="rounded-full"
          aria-label={`Remove ${f.label}`}
          onClick={f.clear}
        >
          {f.label}
          <XIcon className="size-3.5 text-muted-foreground" strokeWidth={2.4} />
        </Button>
      ))}
      {items.length > 1 ? (
        <Button variant="link" onClick={onClearAll}>
          Clear all
        </Button>
      ) : null}
    </div>
  );
}

interface FilterSheetProps {
  onClose: () => void;
  onReset: () => void;
  /** Whether anything differs from the defaults, so Reset has something to do. */
  changed: boolean;
  /** The main button: "Show 1,204 cards". */
  showLabel: string;
  children: ReactNode;
}

/** The sheet itself: sections of choices, with Reset and Show results kept in reach at the bottom. */
export function FilterSheet({ onClose, onReset, changed, showLabel, children }: FilterSheetProps) {
  return (
    <Sheet label="Filter and sort" onClose={onClose}>
      <SheetHead title="Filter and sort" />
      <div className="sheet-form filter-form">{children}</div>
      <div className="filter-foot">
        <Button className="flex-1" disabled={!changed} onClick={onReset}>
          Reset
        </Button>
        <Button variant="default" className="flex-2" onClick={onClose}>
          {showLabel}
        </Button>
      </div>
    </Sheet>
  );
}

interface Choice<T> {
  value: T;
  label: string;
  /** How many cards it would show, where that's known. */
  count?: number;
}

interface ChoicesProps<T> {
  label: string;
  value: T;
  options: readonly Choice<T>[];
  onChange: (value: T) => void;
}

/** One section of the sheet: its options as chips, one chosen. */
export function Choices<T extends string | number>({ label, value, options, onChange }: ChoicesProps<T>) {
  return (
    <section className="filter-sec">
      <h4>{label}</h4>
      <div className="choice-wrap" role="group" aria-label={label}>
        {options.map((o) => (
          <Toggle key={String(o.value)} pressed={o.value === value} onPressedChange={() => onChange(o.value)}>
            {o.label}
            {o.count != null ? <span>{o.count.toLocaleString()}</span> : null}
          </Toggle>
        ))}
      </div>
    </section>
  );
}

/** A section holding anything else: a list too long for chips, or a few on/off toggles. */
export function FilterSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="filter-sec">
      <h4>{label}</h4>
      {children}
    </section>
  );
}
