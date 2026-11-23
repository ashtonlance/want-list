/* Reading one straightened card: shared by the binder page scan and the single-card camera scan. */
import { pidOf } from "~/features/cards/pricing";
import type { Card } from "~/features/cards/types";
import type { Catalog } from "~/features/catalog/catalog";
import { release } from "./engine/image";
import { buildIndex, matchCell, type Match, type ScanIndex } from "./engine/match";
import { readCell } from "./engine/ocr";

/* Building the index walks the whole catalog, so it's kept until the catalog or the list changes. */
let indexCache: { catalog: Catalog; cards: readonly Card[]; index: ScanIndex } | null = null;

export function indexFor(catalog: Catalog, cards: readonly Card[]): ScanIndex {
  if (indexCache?.catalog !== catalog || indexCache.cards !== cards) {
    const mine = cards.map((c) => ({ id: c.id, name: c.name, set: c.set, number: c.number, pid: pidOf(c) }));
    indexCache = { catalog, cards, index: buildIndex(catalog, mine) };
  }
  return indexCache.index;
}

/** Reads a card-shaped canvas (CW × CH) and ranks the printings it could be. Never throws. */
export async function readPocket(index: ScanIndex, cell: HTMLCanvasElement): Promise<Match> {
  try {
    const read = await readCell(cell);
    try {
      return await matchCell(index, read, cell);
    } finally {
      release(read.topC);
      release(read.botC);
    }
  } catch {
    // One unreadable card shouldn't stop the scan; the person picks the card instead.
    return { conf: "none", alts: [], hint: "" };
  }
}
