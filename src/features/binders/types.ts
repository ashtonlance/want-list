import type { Pockets } from "~/app/prefs";

/** A pocket holding a card from the list, by its id. */
export interface ListSlot {
  k: "c";
  id: string;
}

/** A pocket holding any card that exists (from the catalog), not necessarily on the list. */
export interface WebSlot {
  k: "w";
  /** TCGplayer product id. */
  pid: number;
  n: string;
  s: string;
  no: string;
  r: string;
  /** Market price when it was placed. */
  m: number | null;
  jp: boolean;
}

export type Slot = ListSlot | WebSlot;

export interface Binder {
  id: string;
  name: string;
  pockets: Pockets;
  /** One entry per pocket, page after page; null is an empty pocket. */
  slots: (Slot | null)[];
  createdAt: string;
  updatedAt: string;
}
