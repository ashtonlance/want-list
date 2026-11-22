import { describe, expect, it } from "vitest";
import { parseCatalog } from "./catalog";
import { feedRows } from "./feed";
import { searchCatalog } from "./search";
import { testCatalog } from "./testCatalog";

const cat = testCatalog();
const pids = (idx: number[]) => idx.map((i) => cat.cards[i]?.pid);

describe("parseCatalog", () => {
  it("indexes cards by product id", () => {
    expect(cat.cards).toHaveLength(5);
    expect(cat.byPid.get(3)?.name).toBe("Gengar ex");
  });
  it("reads upcoming sets, and defaults to none", () => {
    expect(cat.upcoming).toEqual([]);
    const next = parseCatalog({
      asOf: "2026-11-22",
      sets: [],
      rarities: [],
      cards: [],
      upcoming: [["Aura Seeker", 1, "2026-11-27"]],
    });
    expect(next.upcoming).toMatchObject([{ name: "Aura Seeker", jp: true, date: "2026-11-27" }]);
  });
});

describe("feedRows", () => {
  it("lists newest sets first, with an out-of-order date treated as undated and kept last", () => {
    expect(pids(feedRows(cat, { lang: "en", sort: "new", cap: 0 }))).toEqual([2, 1, 3, 4]);
  });
  it("reverses for oldest first", () => {
    expect(pids(feedRows(cat, { lang: "en", sort: "old", cap: 0 }))).toEqual([3, 1, 2, 4]);
  });
  it("filters by language and price cap", () => {
    expect(pids(feedRows(cat, { lang: "jp", sort: "new", cap: 0 }))).toEqual([5]);
    expect(pids(feedRows(cat, { lang: "both", sort: "high", cap: 25 }))).toEqual([1, 5, 2]);
  });
  it("filters by rarity, full art and when the set came out", () => {
    expect(pids(feedRows(cat, { lang: "both", sort: "new", cap: 0, rarity: "Rare" }))).toEqual([1, 5, 3]);
    expect(pids(feedRows(cat, { lang: "both", sort: "new", cap: 0, look: "fullart" }))).toEqual([]);
    expect(pids(feedRows(cat, { lang: "en", sort: "new", cap: 0, era: "2020s" }))).toEqual([2, 1, 3]);
  });
  it("puts unpriced cards last when sorting by price, low to high", () => {
    expect(pids(feedRows(cat, { lang: "en", sort: "low", cap: 0 }))).toEqual([2, 1, 3, 4]);
  });
});

describe("searchCatalog", () => {
  it("matches every word, names starting with the first word first", () => {
    expect(searchCatalog(cat, "gengar", false).map((c) => c.pid)).toEqual([1, 3]);
    expect(searchCatalog(cat, "gengar 100", false).map((c) => c.pid)).toEqual([3]);
  });
  it("includes Japanese cards only when asked", () => {
    expect(searchCatalog(cat, "gengar", true).map((c) => c.pid)).toContain(5);
    expect(searchCatalog(cat, "   ", true)).toEqual([]);
  });
});
