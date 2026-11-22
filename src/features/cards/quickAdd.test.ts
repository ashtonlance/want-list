import { describe, expect, it } from "vitest";
import { parseLink, parseQuick, titleCase } from "./quickAdd";

const SETS = ["Evolutions", "Prismatic Evolutions", "Fossil"];

describe("parseQuick", () => {
  it("splits name, set and number, matching the longest set name", () => {
    expect(parseQuick("Umbreon ex Prismatic Evolutions 161", SETS)).toEqual({
      name: "Umbreon ex",
      set: "Prismatic Evolutions",
      number: "161",
      variant: "",
      lang: "EN",
    });
  });
  it("reads language and variant words", () => {
    const p = parseQuick("gengar fossil reverse holo jp 5/62", SETS);
    expect(p).toMatchObject({
      name: "Gengar",
      set: "Fossil",
      number: "5",
      variant: "Reverse Holo",
      lang: "JP",
    });
  });
});

describe("titleCase", () => {
  it("keeps card suffixes right and leaves typed capitals alone", () => {
    expect(titleCase("charizard vmax")).toBe("Charizard VMAX");
    expect(titleCase("Mew ex")).toBe("Mew ex");
  });
});

describe("parseLink", () => {
  it("reads a TCGplayer product link", () => {
    const p = parseLink(
      "https://www.tcgplayer.com/product/610461/pokemon-sv-prismatic-evolutions-umbreon-ex-161-131",
      SETS,
    );
    expect(p).toMatchObject({ site: "TCGplayer", found: true, number: "161", set: "Prismatic Evolutions" });
    expect(p?.name).toBe("Umbreon ex");
    expect(p?.listing?.url).toContain("tcgplayer.com/product/610461");
  });
  it("returns null for something that isn't a web link", () => {
    expect(parseLink("not a link", SETS)).toBeNull();
    expect(parseLink("ftp://example.com/x", SETS)).toBeNull();
  });
});
