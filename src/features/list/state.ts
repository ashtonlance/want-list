import { prefs } from "~/app/prefs";
import type { StatusFilter } from "~/features/cards/filters";
import { createStore, useStore } from "~/lib/store";

/** What the list screen is showing. Kept outside the screen so it survives a trip to another tab. */
export interface ListUi {
  status: StatusFilter;
  q: string;
  prio: boolean;
  selecting: boolean;
  selected: ReadonlySet<string>;
  /** The collection typed in the bar at the bottom while selecting. */
  bulkColl: string;
  /** The collection header's inline form, if one is open. */
  collForm: "new" | "rename" | null;
  confirmDelete: boolean;
}

const initial: ListUi = {
  status: "want",
  q: "",
  prio: false,
  selecting: false,
  selected: new Set(),
  bulkColl: "",
  collForm: null,
  confirmDelete: false,
};

export const listUi = createStore<ListUi>(initial);

export const useListUi = (): ListUi => useStore(listUi);

export const patchListUi = (patch: Partial<ListUi>): void => listUi.set((prev) => ({ ...prev, ...patch }));

/** Shows one collection, or every card when `name` is null. */
export function showCollection(name: string | null): void {
  prefs.coll.set(name);
  if (!name) prefs.view.set("list");
  patchListUi({ collForm: null, confirmDelete: false });
}

/** Starts picking cards, with the collection to add them to filled in. */
export function startSelecting(prefill: string, currentColl: string | null): void {
  prefs.view.set("list");
  patchListUi({
    selecting: true,
    selected: new Set(),
    bulkColl: prefill || currentColl || "",
    collForm: null,
    // Adding cards to the collection on screen: show every card so the rest of the list can be picked.
    ...(prefill && prefill === currentColl ? { status: "all" as const } : {}),
  });
}

export const stopSelecting = (): void => patchListUi({ selecting: false, selected: new Set() });

export function toggleSelected(id: string): void {
  listUi.set((prev) => {
    const selected = new Set(prev.selected);
    if (!selected.delete(id)) selected.add(id);
    return { ...prev, selected };
  });
}
