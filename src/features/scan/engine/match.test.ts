import { describe, expect, it } from "vitest";
import type { OcrWord } from "./ocr";
import { fixDigits, nameSim, normNo, numbersIn, squash, subDist, textsOf } from "./match";

const words = (...ts: string[]): OcrWord[] => ts.map((t) => ({ t, c: 90, h: 20 }));

describe("normNo", () => {
  it("drops leading zeros, spaces and case", () => {
    expect(normNo("094")).toBe("94");
    expect(normNo("tg 05")).toBe("TG5");
    expect(normNo("SV052")).toBe("SV52");
    expect(normNo("SWSH123")).toBe("SWSH123");
  });
  it("keeps a letter suffix", () => {
    expect(normNo("012a")).toBe("12A");
  });
  it("leaves anything that isn't a card number as cleaned text", () => {
    expect(normNo("1 / 2")).toBe("1/2");
    expect(normNo("")).toBe("");
  });
});

describe("squash", () => {
  it("keeps only lowercase letters and digits", () => {
    expect(squash("Pikachu-EX")).toBe("pikachuex");
    expect(squash("Mr. Mime")).toBe("mrmime");
    expect(squash("Farfetch’d")).toBe("farfetchd");
  });
  it("strips accents", () => {
    expect(squash("Pokémon Center")).toBe("pokemoncenter");
    expect(squash("Flabébé")).toBe("flabebe");
  });
});

describe("fixDigits", () => {
  it("turns look-alike letters into digits", () => {
    expect(fixDigits("O9I")).toBe("091");
    expect(fixDigits("l|!")).toBe("111");
    expect(fixDigits("SsBZo")).toBe("55820");
  });
  it("leaves real digits alone", () => {
    expect(fixDigits("123")).toBe("123");
  });
});

describe("numbersIn", () => {
  it("reads slashed numbers", () => {
    expect(numbersIn(words("094/086"))).toEqual(["94"]);
    expect(numbersIn(words("Illus.", "Ken", "17", "/", "64"))).toEqual(["17"]);
  });
  it("keeps known prefixes and fixes misread digits", () => {
    // The prefixed total reads as a number too; the catalog lookup sorts out which one exists.
    expect(numbersIn(words("TG06/TG30"))).toEqual(["TG6", "TG30"]);
    expect(numbersIn(words("O4S/198"))).toEqual(["45"]);
  });
  it("drops prefixes that aren't set codes", () => {
    expect(numbersIn(words("abc12/99"))).toEqual(["12"]);
  });
  it("reads promo numbers without a slash, once each", () => {
    expect(numbersIn(words("SWSH123", "SV052", "SV052"))).toEqual(["SWSH123", "SV52"]);
  });
  it("finds nothing in plain text", () => {
    expect(numbersIn(words("Pikachu", "60", "HP"))).toEqual([]);
  });
});

describe("subDist and nameSim", () => {
  it("measures the closest stretch of the text", () => {
    expect(subDist("pikachu", "basicpikachuhp60")).toBe(0);
    expect(subDist("pikachu", "basicpikacnuhp")).toBe(1);
    expect(subDist("", "anything")).toBe(0);
  });
  it("scores a near miss by the share of letters right", () => {
    expect(nameSim("pikachu", "xxpikachuxx")).toBe(1);
    expect(nameSim("charizard", "charlzard")).toBeCloseTo(1 - 1 / 9);
  });
  it("needs short names to match exactly", () => {
    expect(nameSim("mew", "mewtwo")).toBe(1);
    expect(nameSim("mew", "rnew")).toBe(0);
  });
  it("is zero with nothing to compare", () => {
    expect(nameSim("", "pikachu")).toBe(0);
    expect(nameSim("pikachu", "")).toBe(0);
  });
});

describe("textsOf", () => {
  it("keeps the biggest words and drops card-face words", () => {
    const t = textsOf([
      { t: "BASIC", c: 90, h: 10 },
      { t: "Pikachu", c: 90, h: 30 },
      { t: "ex", c: 90, h: 24 },
      { t: "HP", c: 90, h: 12 },
      { t: "Thunder", c: 90, h: 12 },
    ]);
    expect(t.big).toBe("pikachuex");
    expect(t.bigWords).toBe("pikachu ex");
    expect(t.all).toBe("pikachuexthunder");
  });
});
