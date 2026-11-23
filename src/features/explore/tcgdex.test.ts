import { describe, expect, it } from "vitest";
import { normalizeTdPrices } from "./tcgdex";

describe("normalizeTdPrices", () => {
  it("reads TCGplayer prices by sub-type, in either key style", () => {
    const r = normalizeTdPrices({
      pricing: {
        tcgplayer: {
          updated: "2026-11-22T10:00:00Z",
          "1st-edition-holofoil": { productId: 42, marketPrice: 300, lowPrice: 250 },
          unlimitedHolofoil: { productId: 42, marketPrice: 90, lowPrice: 70 },
          "reverse-holofoil": { productId: 42, midPrice: 5, lowPrice: 3 },
          somethingElse: { productId: 1, marketPrice: 1 },
        },
      },
    });
    expect(r).toEqual({
      pid: 42,
      asOf: "2026-11-22",
      subs: {
        "1st Edition Holofoil": [300, 250],
        "Unlimited Holofoil": [90, 70],
        "Reverse Holofoil": [null, 3],
      },
    });
  });
  it("keeps only the asked-for product's sub-types", () => {
    const r = normalizeTdPrices(
      {
        pricing: {
          tcgplayer: {
            holofoil: { productId: 1001, marketPrice: 90 },
            "1stEditionHolofoil": { productId: 2002, marketPrice: 300 },
          },
        },
      },
      2002,
    );
    expect(r.pid).toBe(2002);
    expect(r.subs).toEqual({ "1st Edition Holofoil": [300, null] });
  });
  it("is empty for a card without TCGplayer prices", () => {
    expect(normalizeTdPrices({ id: "x" })).toEqual({ pid: null, subs: {}, asOf: "" });
  });
});
