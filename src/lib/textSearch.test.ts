import { describe, expect, it } from "vitest";
import { numberTag, queryWords, textMatcher } from "./textSearch";

const matches = (q: string, text: string) => textMatcher(q)?.(text) ?? false;

describe("textMatcher", () => {
  it("matches every word in any order", () => {
    expect(matches("gengar arceus", "gengar arceus 16 reverse holo")).toBe(true);
    expect(matches("arceus gengar", "gengar arceus 16 reverse holo")).toBe(true);
    expect(matches("gengar fossil", "gengar arceus 16")).toBe(false);
  });
  it("matches the card's own number, with promo letters and zeros", () => {
    const card = (rest: string, no: string) => `${rest} ${numberTag(no)}`;
    expect(matches("gengar 16", card("gengar arceus", "16"))).toBe(true);
    expect(matches("gengar #16", card("gengar arceus", "016/099"))).toBe(true);
    expect(matches("gengar 16/99", card("gengar arceus", "16"))).toBe(true);
    expect(matches("gengar 16", card("gengar arceus", "116"))).toBe(false);
    expect(matches("pikachu 49", card("pikachu promos", "SV049"))).toBe(true);
    expect(matches("umbreon 5", card("umbreon", "TG05"))).toBe(true);
    expect(matches("crobat 5", card("crobat (h5) skyridge", "H05"))).toBe(true);
    expect(matches("pikachu 4", card("pikachu jungle", "4a"))).toBe(true);
    expect(matches("pikachu 103", card("pikachu", "SM103a"))).toBe(true);
    expect(matches("umbreon 5", card("umbreon", "15"))).toBe(false);
  });
  it("matches other numbers only when they stand alone", () => {
    expect(matches("151 pikachu", `pikachu scarlet & violet 151 ${numberTag("173")}`)).toBe(true);
    expect(matches("pikachu 25", `pikachu 25th anniversary ${numberTag("5")}`)).toBe(false);
    expect(matches("gengar 2", `gengar pt2: bonds to the end of time ${numberTag("40")}`)).toBe(false);
    expect(matches("latias 1", `latias ex trainer kit 1: latias & latios ${numberTag("5")}`)).toBe(false);
    expect(matches("charizard 4", `charizard - s1/s4 (box topper) base set ${numberTag("s1")}`)).toBe(false);
    expect(matches("pikachu 8", `pikachu s8a-g: 25th anniversary golden box ${numberTag("5")}`)).toBe(false);
  });
  it("matches words inside other words", () => {
    expect(matches("chu", "pikachu 151 173")).toBe(true);
  });
  it("has no test for an empty query", () => {
    expect(numberTag(" ")).toBe("");
    expect(textMatcher("   ")).toBeNull();
    expect(queryWords(" #7  Mew ")).toEqual(["7", "mew"]);
  });
});
