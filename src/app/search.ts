import { oneOf, str } from "~/lib/json";

/** Panels that open over any screen. */
export type Panel = "account" | "add" | "options" | "collections" | "sets" | "keys";

/**
 * Search params every screen understands. The open card sheet lives in the address, so the list
 * underneath stays put and the back button closes the sheet.
 */
export interface RootSearch {
  /** A card on the list, by id. */
  card?: string;
  /** A pick from Explore, by id. */
  pick?: string;
  /** A live card: a TCGdex id, or "cat:" and a TCGplayer product id. */
  live?: string;
  panel?: Panel;
}

export function validateRootSearch(s: Record<string, unknown>): RootSearch {
  return {
    card: str(s.card) || undefined,
    pick: str(s.pick) || undefined,
    live: str(s.live) || undefined,
    panel: oneOf(s.panel, ["account", "add", "options", "collections", "sets", "keys"] as const),
  };
}

export const NO_OVERLAY: RootSearch = { card: undefined, pick: undefined, live: undefined, panel: undefined };

/** The card whose details are open (a list card, a pick or a live card), if any. */
export const detailOf = (s: RootSearch): string | undefined => s.card ?? s.pick ?? s.live;
