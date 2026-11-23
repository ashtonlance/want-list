import { describe, expect, it } from "vitest";
import { allCollections } from "./collections";
import { NO_ASK, type Card } from "./types";

const card = (id: string, collections: string[]): Card => ({
  id,
  name: "Gengar",
  number: "5",
  variant: "",
  set: "Fossil",
  lang: "EN",
  note: "",
  addedAt: "2026-11-01",
  ask: NO_ASK,
  deal: null,
  listing: null,
  dhUrl: null,
  img: null,
  imgSource: "",
  priority: false,
  status: "want",
  checkRequested: false,
  tcgProduct: null,
  noPrice: null,
  order: null,
  collections,
  slots: {},
  tcg: null,
  owned: null,
});

describe("allCollections", () => {
  it("keeps saved order, includes empty saved collections, and adds the rest by name", () => {
    const got = allCollections([card("a", ["Zebra", "Spooky"]), card("b", ["Apple"])], ["Spooky", "Kids"]);
    expect(got.map((c) => [c.name, c.total])).toEqual([
      ["Spooky", 1],
      ["Kids", 0],
      ["Apple", 1],
      ["Zebra", 1],
    ]);
  });
});
