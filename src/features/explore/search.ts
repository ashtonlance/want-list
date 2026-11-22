import { str } from "~/lib/json";

/** Explore's live view: a search, a set, or (neither) every card. */
export interface LiveSearch {
  q?: string;
  set?: string;
}

/** Explore's picks: a collection's tab (or every pick) and an artist filter. */
export interface PicksSearch {
  coll?: string;
  artist?: string;
}

/** The "All picks" tab. */
export const ALL_PICKS = "__all";

export const validateLiveSearch = (s: Record<string, unknown>): LiveSearch => ({
  q: str(s.q) || undefined,
  set: str(s.set) || undefined,
});

export const validatePicksSearch = (s: Record<string, unknown>): PicksSearch => ({
  coll: str(s.coll) || undefined,
  artist: str(s.artist) || undefined,
});
