import { describe, expect, it } from "vitest";
import { pickSub, pidOf, priceOf, shortPrice, withPrices } from "./pricing";
import { testCard } from "./testCard";

const tcg = { sub: "Holofoil", market: 12.5, low: 10, productId: 42, asOf: "2026-11-01" };
const deal = {
  site: "eBay",
  seller: "",
  condition: "",
  url: "",
  price: 9,
  shipping: 1.5,
  total: 10.5,
  checkedAt: "2026-11-02",
};

describe("pickSub", () => {
  const subs = {
    Normal: [3, 2] as [number, number],
    "Reverse Holofoil": [5, 4] as [number, number],
    "1st Edition": [50, null] as [number, null],
  };
  it("picks the regular printing for a plain card", () => {
    expect(pickSub(subs, "")).toEqual({ sub: "Normal", market: 3, low: 2 });
  });
  it("picks reverse holo and 1st edition by variant", () => {
    expect(pickSub(subs, "Reverse Holo")?.sub).toBe("Reverse Holofoil");
    expect(pickSub(subs, "1st Edition")?.market).toBe(50);
  });
  it("skips printings with no prices at all", () => {
    expect(pickSub({ Holofoil: [null, null], Normal: [1, null] }, "")?.sub).toBe("Normal");
    expect(pickSub({ Holofoil: [null, null] }, "")).toBeNull();
  });
});

describe("pidOf", () => {
  it("prefers the saved price's product id, then a TCGplayer listing link", () => {
    expect(pidOf(testCard({ tcg }))).toBe(42);
    const listing = {
      url: "https://www.tcgplayer.com/product/7788/pokemon-gengar",
      site: "TCGplayer",
      addedAt: "",
    };
    expect(pidOf(testCard({ listing }))).toBe(7788);
    expect(pidOf(testCard())).toBeNull();
  });
});

describe("priceOf", () => {
  it("uses the shipped deal, then TCGplayer market, then an ask", () => {
    expect(priceOf(testCard({ deal, tcg }))).toBe(10.5);
    expect(priceOf(testCard({ tcg }))).toBe(12.5);
    expect(priceOf(testCard({ ask: { kind: "ask", amount: 8, source: "", asOf: "" } }))).toBe(8);
  });
  it("ignores a last sold price, which isn't something you can buy at", () => {
    expect(priceOf(testCard({ ask: { kind: "price", amount: 8, source: "", asOf: "" } }))).toBeNull();
  });
});

describe("withPrices", () => {
  it("applies today's price for the card's printing", () => {
    const listing = { url: "https://www.tcgplayer.com/product/42", site: "TCGplayer", addedAt: "" };
    const prices = { asOf: "2026-11-22", items: { "42": { Holofoil: [20, 18] as [number, number] } } };
    expect(withPrices(testCard({ listing }), prices).tcg).toEqual({
      sub: "Holofoil",
      market: 20,
      low: 18,
      productId: 42,
      asOf: "2026-11-22",
    });
  });
  it("leaves a card alone when the price file doesn't have it", () => {
    const c = testCard({ tcg });
    expect(withPrices(c, { asOf: "x", items: {} })).toBe(c);
  });
});

describe("shortPrice", () => {
  it("labels deals, market prices and missing prices", () => {
    expect(shortPrice(testCard({ deal }))).toEqual({ amt: "$10.50", deal: true, label: "shipped" });
    expect(shortPrice(testCard({ tcg }))).toEqual({ amt: "$12.50", deal: false, label: "market" });
    expect(shortPrice(testCard())?.label).toBe("No price yet");
    expect(shortPrice(testCard({ noPrice: { reason: "x", at: "2026-11-23" } }))?.label).toBe(
      "No price found",
    );
  });
  it("shows no price for a card you have", () => {
    expect(shortPrice(testCard({ status: "got", tcg }))).toBeNull();
  });
});
