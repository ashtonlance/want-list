import { describe, expect, it } from "vitest";
import { parseCatalog } from "~/features/catalog/catalog";
import { setNameFixes } from "./setNames";
import { testCard } from "./testCard";
import type { TcgPrice } from "./types";

const cat = parseCatalog({
  asOf: "2026-11-23",
  sets: [
    ["Scarlet & Violet 151", 0, "2023-09-22"],
    ["30th Celebration", 0, "2026-09-16"],
    ["30th Celebration Classic Collection", 0, "2026-09-16"],
    ["Pokemon Card 151", 1, "2023-06-16"],
  ],
  rarities: [],
  cards: [
    [10, "Wartortle", 0, "171", 0, 1],
    [11, "Tangela", 0, "178", 0, 1],
    [20, "Gengar", 1, "40", 0, 1],
    [30, "Charizard", 2, "4", 0, 1],
    [31, "Gengar", 2, "18", 0, 1],
    [40, "Tangela", 3, "178", 0, 1],
  ],
});

const tcg = (productId: number) => ({ productId }) as unknown as TcgPrice;
const fixes = (cards: Parameters<typeof setNameFixes>[0]) =>
  setNameFixes(cards, cat).map((f) => [f.card.id, f.from, f.to]);

describe("setNameFixes", () => {
  it("renames a short set name to the catalog name already on the list", () => {
    expect(
      fixes([
        testCard({ id: "a", name: "Wartortle", set: "Scarlet & Violet 151", tcg: tcg(10) }),
        testCard({ id: "b", name: "Tangela", set: "151" }),
      ]),
    ).toEqual([["b", "151", "Scarlet & Violet 151"]]);
  });

  it("picks the one set that has every word, not a shorter one", () => {
    expect(
      fixes([
        testCard({ id: "a", name: "Gengar", set: "30th Celebration" }),
        testCard({ id: "b", name: "Charizard", set: "30th Celebration Classic Collection" }),
        testCard({ id: "c", name: "Gengar", set: "30th Classic Collection" }),
      ]),
    ).toEqual([["c", "30th Classic Collection", "30th Celebration Classic Collection"]]);
  });

  it("trusts the card's product over its name", () => {
    expect(
      fixes([
        testCard({ id: "a", name: "Charizard", set: "30th Celebration Classic Collection" }),
        testCard({ id: "b", name: "Gengar", set: "Classic", tcg: tcg(31) }),
      ]),
    ).toEqual([["b", "Classic", "30th Celebration Classic Collection"]]);
  });

  it("leaves a set alone when its catalog name isn't on the list yet", () => {
    expect(fixes([testCard({ id: "b", name: "Tangela", set: "151" })])).toEqual([]);
  });

  it("leaves a card alone when the matching set has no card of that name", () => {
    expect(
      fixes([
        testCard({ id: "a", name: "Wartortle", set: "Scarlet & Violet 151" }),
        testCard({ id: "b", name: "Mew", set: "151" }),
      ]),
    ).toEqual([]);
  });

  it("keeps Japanese and English sets apart", () => {
    expect(
      fixes([
        testCard({ id: "a", name: "Wartortle", set: "Scarlet & Violet 151" }),
        testCard({ id: "b", name: "Tangela", set: "151", lang: "JP" }),
      ]),
    ).toEqual([]);
  });

  it("never touches a set that already has a catalog name", () => {
    expect(
      fixes([
        testCard({ id: "a", name: "Gengar", set: "30th Celebration" }),
        testCard({ id: "b", name: "Charizard", set: "30th Celebration Classic Collection" }),
      ]),
    ).toEqual([]);
  });
});
