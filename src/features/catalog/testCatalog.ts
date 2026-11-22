import { parseCatalog, type Catalog } from "./catalog";

/** A small catalog in the same shape as catalog.json: two English sets, one Japanese, one undated promo. */
export function testCatalog(): Catalog {
  return parseCatalog({
    asOf: "2026-11-22",
    sets: [
      ["Newest Set", 0, "2026-10-01"],
      ["Older Set", 0, "2025-05-01"],
      ["Promos", 0, "2030-01-01"],
      ["Japan Set", 1, "2026-09-01"],
    ],
    rarities: ["Common", "Rare"],
    cards: [
      [1, "Gengar", 0, "5", 1, 12],
      [2, "Pikachu", 0, "12", 0, 0.5],
      [3, "Gengar ex", 1, "100", 1, 40],
      [4, "Pikachu", 2, "1", 0, 0],
      [5, "Gengar", 3, "7", 1, 3],
    ],
  });
}
