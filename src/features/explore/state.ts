import type { FeedLang, FeedSort } from "~/features/catalog/feed";
import { createStore, useStore } from "~/lib/store";
import type { LiveSearch, PicksSearch } from "./search";

export type PriceCap = 0 | 5 | 25 | 100;

export const CAP_OPTIONS: readonly { value: PriceCap; label: string }[] = [
  { value: 0, label: "Any price" },
  { value: 5, label: "Under $5" },
  { value: 25, label: "Under $25" },
  { value: 100, label: "Under $100" },
];

/** A search or set's own order ("num": newest or chase cards first), or by price. */
export type LiveSort = "num" | "high" | "low";

export type PicksSort = "rec" | "low" | "high";

/** Explore's live view settings. Kept outside the screen so they survive a trip to another tab. */
export interface LiveUi {
  /** Order of the "Every card" feed. */
  feedSort: FeedSort;
  sort: LiveSort;
  lang: FeedLang;
  cap: PriceCap;
  /** The collection quick adds go to, or "" for none. */
  addTo: string;
}

export const liveUi = createStore<LiveUi>({ feedSort: "new", sort: "num", lang: "en", cap: 0, addTo: "" });
export const useLiveUi = (): LiveUi => useStore(liveUi);
export const patchLiveUi = (patch: Partial<LiveUi>): void => liveUi.set((prev) => ({ ...prev, ...patch }));

/** Explore's picks filters. The tab and artist live in the address. */
export interface PicksUi {
  q: string;
  cap: PriceCap;
  sort: PicksSort;
  showPassed: boolean;
  hideAdded: boolean;
}

export const picksUi = createStore<PicksUi>({
  q: "",
  cap: 0,
  sort: "rec",
  showPassed: false,
  hideAdded: true,
});
export const usePicksUi = (): PicksUi => useStore(picksUi);
export const patchPicksUi = (patch: Partial<PicksUi>): void => picksUi.set((prev) => ({ ...prev, ...patch }));

/** The last address of each Explore tab, so switching tabs comes back to the same search or collection. */
export const tabSearch = createStore<{ live: LiveSearch; picks: PicksSearch }>({ live: {}, picks: {} });
