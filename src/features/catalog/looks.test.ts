import { describe, expect, it } from "vitest";
import { parseCatalog } from "./catalog";
import { feedRows } from "./feed";
import { lookCards, rarityTiers } from "./looks";

const cat = parseCatalog({
  asOf: "2026-11-22",
  sets: [
    ["Big Set", 0, "2026-10-01"],
    ["Black Star Promos", 0, "2020-01-01"],
    ["Old Set", 0, "1999-01-09"],
  ],
  rarities: [
    "Common",
    "Special Illustration Rare",
    "Illustration Rare",
    "Hyper Rare",
    "Shiny Rare",
    "Holo Rare",
    "Promo",
    "Ultra Rare",
    "Rare",
  ],
  cards: [
    [1, "Pikachu", 0, "10", 0, 0.2],
    [2, "Gengar ex", 0, "200", 1, 300],
    [3, "Eevee", 0, "180", 2, 20],
    [4, "Charizard ex", 0, "250", 3, 90],
    [5, "Mew", 0, "120", 4, 4],
    [6, "Umbreon VMAX (Alternate Art Secret)", 0, "215", 7, 900],
    [7, "Pikachu", 1, "SWSH020", 6, 3],
    [8, "Charizard", 2, "4", 5, 400],
    [9, "Gengar", 0, "50", 8, 1],
  ],
});
const pidsOf = (look: Parameters<typeof lookCards>[1]) => [...(lookCards(cat, look) ?? [])].map((c) => c.pid);
const pids = (idx: readonly number[]) => idx.map((i) => cat.cards[i]?.pid);

describe("lookCards", () => {
  it("returns null for any look", () => {
    expect(lookCards(cat, "any")).toBeNull();
  });
  it("finds each look", () => {
    expect(pidsOf("special")).toEqual([2, 6]);
    expect(pidsOf("illustration")).toEqual([3]);
    expect(pidsOf("gold")).toEqual([4, 6]);
    expect(pidsOf("shiny")).toEqual([5]);
    expect(pidsOf("ex")).toEqual([2, 4, 6]);
    expect(pidsOf("holo")).toEqual([8]);
    expect(pidsOf("promo")).toEqual([7]);
  });
});

describe("feed sorts and price floor", () => {
  it("puts the rarest first, then the priciest", () => {
    const tiers = rarityTiers(cat);
    const first = cat.cards[0];
    expect(first && tiers.get(first)).toBe(0);
    expect(pids(feedRows(cat, { lang: "en", sort: "rare", cap: 0 }))).toEqual([2, 4, 6, 3, 8, 5, 9, 7, 1]);
  });
  it("sorts by name, priciest printing first", () => {
    expect(pids(feedRows(cat, { lang: "en", sort: "name", cap: 0 })).slice(0, 4)).toEqual([8, 4, 3, 9]);
  });
  it("keeps cards at or over a floor", () => {
    expect(pids(feedRows(cat, { lang: "en", sort: "high", cap: 0, floor: 100 }))).toEqual([6, 8, 2]);
  });
  it("filters by look", () => {
    expect(pids(feedRows(cat, { lang: "en", sort: "high", cap: 0, look: "gold" }))).toEqual([6, 4]);
  });
});
