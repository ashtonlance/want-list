import { describe, expect, it } from "vitest";
import { parseCatalog } from "./catalog";
import { feedRows } from "./feed";
import { searchCatalog } from "./search";
import { testCatalog } from "./testCatalog";

const cat = testCatalog();
const pids = (idx: readonly number[], from = cat) => idx.map((i) => from.cards[i]?.pid);

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
  it("merges rarities and artists spelled differently, so each is one filter choice", () => {
    const c = parseCatalog({
      sets: [["Set", 0, "2026-01-01"]],
      rarities: ["Illustration Rare", "Common", "Illustration rare"],
      artists: ["MikiTanaka", "Miki Tanaka", "takuyoa"],
      cards: [
        [1, "A", 0, "1", 0, 1, 1],
        [2, "B", 0, "2", 2, 1, 0],
        [3, "C", 0, "3", 2, 1, 1],
        [4, "D", 0, "4", 1, 1, 2],
      ],
    });
    expect(c.rarities).toEqual(["Illustration Rare", "Common"]);
    expect(c.artists).toEqual(["Miki Tanaka", "takuyoa"]);
    expect(c.cards.map((x) => [c.rarities[x.rarity], c.artists[x.artist]])).toEqual([
      ["Illustration Rare", "Miki Tanaka"],
      ["Illustration Rare", "Miki Tanaka"],
      ["Illustration Rare", "Miki Tanaka"],
      ["Common", "takuyoa"],
    ]);
    expect(
      pids(feedRows(c, { lang: "en", sort: "name", cap: 0, rarity: "illustration rare" }), c).sort(),
    ).toEqual([1, 2, 3]);
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
  it("narrows to a search, leading with cards named what was typed", () => {
    expect(pids(feedRows(cat, { lang: "en", sort: "new", cap: 0, q: "gengar" }))).toEqual([1, 3]);
    expect(pids(feedRows(cat, { lang: "both", sort: "new", cap: 0, q: "set gengar 7" }))).toEqual([5]);
  });
  it("puts unpriced cards last when sorting by price, low to high", () => {
    expect(pids(feedRows(cat, { lang: "en", sort: "low", cap: 0 }))).toEqual([2, 1, 3, 4]);
  });
  it("sorts A to Z, the same name by price, high to low", () => {
    expect(pids(feedRows(cat, { lang: "both", sort: "name", cap: 0 }))).toEqual([1, 5, 3, 2, 4]);
  });
  it("hands back the same list for the same choices, so going back to a view is instant", () => {
    const opts = { lang: "en", sort: "new", cap: 0 } as const;
    expect(feedRows(cat, opts)).toBe(feedRows(cat, { ...opts }));
  });
});

describe("searchCatalog", () => {
  it("matches every word, names starting with the first word first", () => {
    expect(searchCatalog(cat, "gengar", false).map((c) => c.pid)).toEqual([1, 3]);
    expect(searchCatalog(cat, "gengar 100", false).map((c) => c.pid)).toEqual([3]);
    expect(searchCatalog(cat, "older gengar #100", false).map((c) => c.pid)).toEqual([3]);
  });
  it("includes Japanese cards only when asked", () => {
    expect(searchCatalog(cat, "gengar", true).map((c) => c.pid)).toContain(5);
    expect(searchCatalog(cat, "   ", true)).toEqual([]);
  });
});
