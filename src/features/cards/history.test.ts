import { describe, expect, it } from "vitest";
import {
  latestDay,
  parseHistory,
  priceDrop,
  pricePoints,
  priceTrend,
  sharePct,
  type PricePoint,
} from "./history";
import { testCard } from "./testCard";

/** Consecutive days ending on `last`, one per price. */
function days(prices: number[], last = "2026-11-23"): PricePoint[] {
  const end = Date.parse(last + "T00:00:00Z");
  return prices.map((price, i) => ({
    day: new Date(end - (prices.length - 1 - i) * 86_400_000).toISOString().slice(0, 10),
    price,
  }));
}

describe("parseHistory", () => {
  it("reads the file and drops series of the wrong length", () => {
    const h = parseHistory({
      asOf: "2026-11-23",
      days: ["2026-11-22", "2026-11-23"],
      items: { "1": { Holofoil: [100, null], Normal: [5] } },
    });
    expect(h?.items["1"]).toEqual({ Holofoil: [100, null] });
  });

  it("refuses something that isn't a history", () => {
    expect(parseHistory({ items: {} })).toBeNull();
    expect(parseHistory(null)).toBeNull();
  });
});

describe("pricePoints", () => {
  const hist = parseHistory({
    asOf: "2026-11-22",
    days: ["2026-11-20", "2026-11-21", "2026-11-22"],
    items: { "7": { Holofoil: [1000, null, 1100], Normal: [50, 50, 50] } },
  });
  const card = (market: number | null, asOf: string) =>
    testCard({ tcg: { sub: "Holofoil", market, low: null, productId: 7, asOf } });

  it("follows the printing the card is priced from, skipping missing days, and ends on today's price", () => {
    expect(pricePoints(hist, card(9, "2026-11-23"))).toEqual([
      { day: "2026-11-20", price: 10 },
      { day: "2026-11-22", price: 11 },
      { day: "2026-11-23", price: 9 },
    ]);
  });

  it("uses the card's own price for a day the history also has", () => {
    expect(pricePoints(hist, card(12, "2026-11-22")).at(-1)).toEqual({ day: "2026-11-22", price: 12 });
  });

  it("ends on the card's own price when the history is ahead of it", () => {
    expect(pricePoints(hist, card(10.5, "2026-11-21"))).toEqual([
      { day: "2026-11-20", price: 10 },
      { day: "2026-11-21", price: 10.5 },
    ]);
  });

  it("is empty for a card with no TCGplayer price", () => {
    expect(pricePoints(hist, testCard())).toEqual([]);
  });

  it("takes the newer of the two days as today", () => {
    if (!hist) throw new Error("no history");
    expect(latestDay(hist, card(9, "2026-11-23"))).toBe("2026-11-23");
    expect(latestDay(hist, card(9, "2026-11-01"))).toBe("2026-11-22");
  });
});

describe("priceDrop", () => {
  it("flags a price well under its usual level", () => {
    const d = priceDrop(days([40, 41, 40, 39, 40, 41, 40, 34]), "2026-11-23");
    expect(d).toEqual({ from: 40, now: 34, share: 0.15 });
    expect(sharePct(d?.share ?? 0)).toBe("15%");
  });

  it("ignores small moves, cheap cards and one-day spikes", () => {
    expect(priceDrop(days([40, 40, 40, 40, 40, 37]), "2026-11-23")).toBeNull();
    expect(priceDrop(days([3, 3, 3, 3, 3, 2.5]), "2026-11-23")).toBeNull();
    // A spike to 80 doesn't make the usual price 80, so 40 isn't a drop.
    expect(priceDrop(days([40, 40, 80, 40, 40, 40, 40]), "2026-11-23")).toBeNull();
  });

  it("needs enough days before today, and a recent price", () => {
    expect(priceDrop(days([40, 40, 40, 30]), "2026-11-23")).toBeNull();
    expect(priceDrop(days([40, 40, 40, 40, 40, 30], "2026-11-10"), "2026-11-23")).toBeNull();
  });

  it("says nothing after a gap of more than a week", () => {
    const before = days([40, 40, 40, 40, 40, 40], "2026-11-05");
    expect(priceDrop([...before, { day: "2026-11-23", price: 30 }], "2026-11-23")).toBeNull();
  });

  it("leaves out days before a gap of more than a week", () => {
    const old = days([40, 40, 40, 40, 40], "2026-10-29");
    const recent = days([30, 30, 30, 30, 30, 25], "2026-11-23");
    expect(priceDrop([...old, ...recent], "2026-11-23")).toEqual({ from: 30, now: 25, share: 1 / 6 });
    expect(priceDrop([...old, ...days([30, 25])], "2026-11-23")).toBeNull();
  });

  it("only looks back 30 days for the usual price", () => {
    const old = days(Array<number>(20).fill(100), "2026-10-01");
    expect(priceDrop([...old, ...days([40, 40, 40, 40, 40, 39])], "2026-11-23")).toBeNull();
  });
});

describe("priceTrend", () => {
  it("summarises the change, low and high", () => {
    expect(priceTrend(days([10, 8, 12, 11]))).toMatchObject({ low: 8, high: 12, change: 0.1 });
  });

  it("needs two days", () => {
    expect(priceTrend(days([10]))).toBeNull();
  });
});
