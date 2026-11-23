import type { Era } from "~/features/catalog/era";
import type { FeedLang, FeedPrice, FeedSort } from "~/features/catalog/feed";
import type { Look } from "~/features/catalog/looks";
import { FEED_PRICE_OPTIONS } from "~/features/catalog/feed";
import { ERA_OPTIONS, FEED_ERA_OPTIONS } from "~/features/catalog/era";
import { LOOK_OPTIONS } from "~/features/catalog/looks";
import { createSettingsStore } from "~/lib/settings";
import { isRecord } from "~/lib/json";
import { createPersistedStore, useStore } from "~/lib/store";
import { validateLiveSearch, validatePicksSearch, type LiveSearch, type PicksSearch } from "./search";

export type PriceCap = 0 | 5 | 25 | 100;

export const CAP_OPTIONS: readonly { value: PriceCap; label: string }[] = [
  { value: 0, label: "Any price" },
  { value: 5, label: "Under $5" },
  { value: 25, label: "Under $25" },
  { value: 100, label: "Under $100" },
];

/** A search or set's own order ("num": newest or chase cards first), or by price. */
export type LiveSort = "num" | "high" | "low";

export type PicksSort = "rec" | "new" | "old" | "low" | "high" | "name";

export type PicksEra = Era;
export { ERA_OPTIONS, inEra } from "~/features/catalog/era";

/**
 * Explore's live view settings. Saved, so they survive a trip to another tab and the phone closing the app
 * in the background; the feed's scroll position is only found again in the same feed.
 */
export interface LiveUi {
  /** Order of the "Every card" feed. */
  feedSort: FeedSort;
  sort: LiveSort;
  lang: FeedLang;
  cap: PriceCap;
  /** The collection quick adds go to, or "" for none. */
  addTo: string;
  /** "Every card" filters: how the card looks, a rarity name or "", a price band, and when the set came out. */
  look: Look;
  rarity: string;
  feedPrice: FeedPrice;
  era: Era;
}

export const DEFAULT_LIVE_UI: LiveUi = {
  feedSort: "new",
  sort: "num",
  lang: "en",
  cap: 0,
  addTo: "",
  look: "any",
  rarity: "",
  feedPrice: "any",
  era: "any",
};

const values = <T>(options: readonly { value: T }[]): T[] => options.map((o) => o.value);

export const liveUi = createSettingsStore<LiveUi>("wl-live-ui", DEFAULT_LIVE_UI, {
  feedSort: ["new", "old", "rare", "high", "low", "name"],
  sort: ["num", "high", "low"],
  lang: ["en", "jp", "both"],
  cap: values(CAP_OPTIONS),
  look: values(LOOK_OPTIONS),
  feedPrice: values(FEED_PRICE_OPTIONS),
  era: values(FEED_ERA_OPTIONS),
});
export const useLiveUi = (): LiveUi => useStore(liveUi);
export const patchLiveUi = (patch: Partial<LiveUi>): void => liveUi.set((prev) => ({ ...prev, ...patch }));

/** Explore's picks filters. The tab and artist live in the address. */
export interface PicksUi {
  q: string;
  cap: PriceCap;
  sort: PicksSort;
  /** A rarity name, or "" for any. */
  rarity: string;
  era: PicksEra;
  fullArt: boolean;
  showPassed: boolean;
  hideAdded: boolean;
}

export const DEFAULT_PICKS_UI: PicksUi = {
  q: "",
  cap: 0,
  sort: "rec",
  rarity: "",
  era: "any",
  fullArt: false,
  showPassed: false,
  hideAdded: true,
};

export const picksUi = createSettingsStore<PicksUi>("wl-picks-ui", DEFAULT_PICKS_UI, {
  cap: values(CAP_OPTIONS),
  sort: ["rec", "new", "old", "low", "high", "name"],
  era: values(ERA_OPTIONS),
});
export const usePicksUi = (): PicksUi => useStore(picksUi);
export const patchPicksUi = (patch: Partial<PicksUi>): void => picksUi.set((prev) => ({ ...prev, ...patch }));

/**
 * The last address of each Explore tab, so switching tabs, or reopening the app after the phone closed it,
 * comes back to the same search or collection.
 */
export interface TabSearch {
  live: LiveSearch;
  picks: PicksSearch;
}

const TAB_SEARCH_KEY = "wl-extab-search";

export function readTabSearch(raw: string | null): TabSearch {
  let v: unknown;
  try {
    v = raw ? JSON.parse(raw) : null;
  } catch {
    v = null;
  }
  const rec = (x: unknown): Record<string, unknown> => (isRecord(x) ? x : {});
  return { live: validateLiveSearch(rec(rec(v).live)), picks: validatePicksSearch(rec(rec(v).picks)) };
}

export const tabSearch = createPersistedStore<TabSearch>(TAB_SEARCH_KEY, readTabSearch, (v) =>
  JSON.stringify(v),
);
