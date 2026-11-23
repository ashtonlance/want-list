import { describe, expect, it } from "vitest";
import { parseCatalog } from "./catalog";
import { matchCatalog, normalNumber, type CardIdentity } from "./match";

const cat = parseCatalog({
  asOf: "2026-11-22",
  sets: [
    ["Scarlet & Violet 151", 0, "2023-09-22"],
    ["Black Bolt", 0, "2025-07-18"],
    ["Base Set", 0, "1999-01-09"],
    ["Pokemon Card 151", 1, "2023-06-16"],
  ],
  rarities: ["Rare"],
  cards: [
    [10, "Mew ex", 0, "151", 0, 30],
    [11, "Mew ex - 205/165 (151 Metal Card)", 0, "205", 0, 400],
    [12, "Mew ex", 0, "205", 0, 500],
    [20, "Audino", 1, "74", 0, 0.2],
    [21, "Audino - 074/086 (Master Ball Pattern)", 1, "74", 0, 4],
    [30, "Pikachu", 2, "58", 0, 5],
    [40, "Mew ex", 3, "151", 0, 20],
  ],
});

const card = (over: Partial<CardIdentity>): CardIdentity => ({
  name: "Mew ex",
  set: "Scarlet & Violet 151",
  number: "151",
  variant: "",
  lang: "EN",
  ...over,
});

describe("normalNumber", () => {
  it("reads numbers the way the catalog writes them", () => {
    expect(normalNumber("074/086")).toBe("74");
    expect(normalNumber("#TG01")).toBe("tg01");
  });
});

describe("matchCatalog", () => {
  it("finds a card by set, number and name", () => {
    expect(matchCatalog(cat, card({}))).toEqual({ pid: 10 });
    expect(matchCatalog(cat, card({ name: "Pikachu", set: "Base Set", number: "58/102" }))).toEqual({
      pid: 30,
    });
  });
  it("takes a set name with fewer words, and Japanese sets only for Japanese cards", () => {
    expect(matchCatalog(cat, card({ set: "151" }))).toEqual({ pid: 10 });
    expect(matchCatalog(cat, card({ set: "151", lang: "JP" }))).toEqual({ pid: 40 });
  });
  it("prefers the plain printing unless the variant is named", () => {
    expect(matchCatalog(cat, card({ name: "Audino", set: "Black Bolt", number: "074/086" }))).toEqual({
      pid: 20,
    });
    expect(
      matchCatalog(cat, card({ name: "Audino", set: "Black Bolt", number: "74", variant: "Master Ball" })),
    ).toEqual({ pid: 21 });
    expect(matchCatalog(cat, card({ number: "205" }))).toEqual({ pid: 12 });
  });
  it("says why when nothing or too much fits", () => {
    expect(matchCatalog(cat, card({ set: "Fossil" }))).toEqual({
      reason: 'TCGplayer has no set called "Fossil".',
    });
    expect(matchCatalog(cat, card({ number: "999" }))).toEqual({
      reason: 'No Mew ex numbered 999 in "Scarlet & Violet 151". Check the number.',
    });
    expect(matchCatalog(cat, card({ set: "", number: "" }))).toEqual({
      reason: "2 printings match. Add the set to find the right one.",
    });
  });
});
