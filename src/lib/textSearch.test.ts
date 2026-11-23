import { describe, expect, it } from "vitest";
import { queryWords, textMatcher } from "./textSearch";

const matches = (q: string, text: string) => textMatcher(q)?.(text) ?? false;

describe("textMatcher", () => {
  it("matches every word in any order", () => {
    expect(matches("gengar arceus", "gengar arceus 16 reverse holo")).toBe(true);
    expect(matches("arceus gengar", "gengar arceus 16 reverse holo")).toBe(true);
    expect(matches("gengar fossil", "gengar arceus 16")).toBe(false);
  });
  it("matches numbers whole, ignoring leading zeros, a # and a printed total", () => {
    expect(matches("gengar 16", "gengar arceus 16")).toBe(true);
    expect(matches("gengar #16", "gengar arceus 016")).toBe(true);
    expect(matches("gengar 16/99", "gengar arceus 16")).toBe(true);
    expect(matches("gengar 16", "gengar arceus 116")).toBe(false);
    expect(matches("151 pikachu", "pikachu 151 173")).toBe(true);
    expect(matches("pikachu 49", "pikachu promos sv049")).toBe(true);
    expect(matches("umbreon 5", "umbreon tg05")).toBe(true);
    expect(matches("umbreon 5", "umbreon 15")).toBe(false);
    expect(matches("pikachu 25", "pikachu 25th anniversary 5")).toBe(false);
    expect(matches("charizard 9", "charizard hidden fates sv9")).toBe(true);
    expect(matches("gardevoir 5", "gardevoir generations rc5")).toBe(true);
    expect(matches("pikachu 4", "pikachu jungle 4a")).toBe(true);
    expect(matches("crobat 5", "crobat (h5) skyridge h05")).toBe(true);
    expect(matches("9", "grade 9: sharp corners")).toBe(true);
    expect(matches("gengar 2", "gengar pt2: bonds to the end of time 40")).toBe(false);
    expect(matches("mew 4", "mew sp4: eevee heroes 10")).toBe(false);
    expect(matches("pikachu 8", "pikachu s8a-g: 25th anniversary golden box 5")).toBe(false);
  });
  it("matches words inside other words", () => {
    expect(matches("chu", "pikachu 151 173")).toBe(true);
  });
  it("has no test for an empty query", () => {
    expect(textMatcher("   ")).toBeNull();
    expect(queryWords(" #7  Mew ")).toEqual(["7", "mew"]);
  });
});
