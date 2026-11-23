import { describe, expect, it } from "vitest";
import { addSearch, searchCatalog, wantsJapanese } from "./search";
import { parseCatalog } from "./catalog";
import { testCatalog } from "./testCatalog";

const cat = testCatalog();
const pids = (cards: { pid: number }[]) => cards.map((c) => c.pid);

describe("addSearch", () => {
  it("waits for two letters", () => {
    expect(addSearch(cat, "g", 10)).toEqual({ rows: [], total: 0 });
  });
  it("finds English printings, names starting with the word first, then newer sets", () => {
    expect(pids(addSearch(cat, "gengar", 10).rows)).toEqual([1, 3]);
  });
  it("puts store listings and catch-all groups after real set printings", () => {
    const mixed = parseCatalog({
      asOf: "2026-11-22",
      sets: [
        ["Older Set", 0, "2025-05-01"],
        ["Miscellaneous Cards & Products", 0, "2026-11-01"],
      ],
      rarities: ["Rare"],
      cards: [
        [1, "Gengar", 0, "5", 0, 12],
        [2, "Gengar - 050/088 (Cosmos Holo)", 1, "", 0, 8],
        [3, "Gengar", 1, "", 0, 9],
      ],
    });
    expect(pids(searchCatalog(mixed, "gengar", false))).toEqual([2, 3, 1]);
    expect(pids(addSearch(mixed, "gengar", 10).rows)).toEqual([1, 2, 3]);
  });
  it("keeps real printings with a number or variant in the name among the real ones", () => {
    const real = parseCatalog({
      asOf: "2026-11-22",
      sets: [
        ["Evolving Skies", 0, "2021-08-27"],
        ["Prize Pack Series Cards", 0, "2026-10-01"],
        ["Black Bolt", 0, "2025-07-18"],
      ],
      rarities: ["Rare"],
      cards: [
        [1, "Umbreon VMAX", 0, "95", 0, 20],
        [2, "Umbreon VMAX (Alternate Art Secret)", 0, "215", 0, 1500],
        [3, "Umbreon VMAX", 1, "95", 0, 18],
        [4, "Umbreon - 074/086 (Master Ball Pattern)", 2, "074/086", 0, 30],
      ],
    });
    expect(pids(addSearch(real, "umbreon", 10).rows)).toEqual([4, 1, 2, 3]);
  });
  it("includes Japanese cards only when asked", () => {
    expect(pids(addSearch(cat, "gengar jp", 10).rows)).toEqual([5]);
    expect(pids(addSearch(cat, "gengar japanese", 10).rows)).toEqual([5]);
  });
  it("narrows by number, with or without #", () => {
    expect(pids(addSearch(cat, "gengar 100", 10).rows)).toEqual([3]);
    expect(pids(addSearch(cat, "gengar #100", 10).rows)).toEqual([3]);
  });
  it("caps the rows and keeps the full count", () => {
    const r = addSearch(cat, "pikachu", 1);
    expect(r.rows).toHaveLength(1);
    expect(r.total).toBe(2);
  });
});

describe("wantsJapanese", () => {
  it("matches jp or japanese as a word only", () => {
    expect(wantsJapanese("umbreon jp")).toBe(true);
    expect(wantsJapanese("Japanese pikachu")).toBe(true);
    expect(wantsJapanese("jumpluff")).toBe(false);
  });
});

describe("searchCatalog", () => {
  it("ignores a leading # on a number", () => {
    expect(pids(searchCatalog(cat, "#12", false))).toEqual([2]);
  });
});
