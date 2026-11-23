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
      released: { "1": "2026-11-07", "2": 5, "3": "2026-11-07T00:00:00Z" },
    });
    expect(h?.items["1"]).toEqual({ Holofoil: [100, null] });
    expect(h?.released).toEqual({ "1": "2026-11-07" });
  });

  it("reads a file without release dates", () => {
    expect(parseHistory({ days: [], items: {} })?.released).toEqual({});
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

  it("leaves out a market price of zero", () => {
    expect(pricePoints(hist, card(0, "2026-11-23")).at(-1)).toEqual({ day: "2026-11-22", price: 11 });
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
  const flat = (n: number, price: number) => Array<number>(n).fill(price);
  /** One price every `step` days, ending on 2026-11-23. */
  const sparse = (prices: number[], step: number) =>
    days(prices.flatMap((p) => [...flat(step - 1, 0), p])).filter((p) => p.price > 0);

  it("flags a price well under its usual level", () => {
    const d = priceDrop(days([...flat(20, 40), 41, 39, ...flat(18, 40), 32]), "2026-11-23");
    expect(d).toEqual({ from: 40, now: 32, share: 0.2 });
    expect(sharePct(d?.share ?? 0)).toBe("20%");
  });

  it("counts a drop of exactly 15%", () => {
    expect(priceDrop(days([...flat(40, 40), 34]), "2026-11-23")?.share).toBe(0.15);
    expect(priceDrop(days([...flat(40, 13.4), 11.39]), "2026-11-23")).not.toBeNull();
  });

  it("ignores small moves, cheap cards and spikes", () => {
    expect(priceDrop(days([...flat(40, 40), 35]), "2026-11-23")).toBeNull();
    expect(priceDrop(days([...flat(40, 5), 4.2]), "2026-11-23")).toBeNull();
    // Four days at $120 would lift an average to about $52, but the usual price stays $40.
    const spikes = [120, 40, 120, 40, 120, 40, 120];
    expect(priceDrop(days([...flat(30, 40), ...spikes, ...flat(4, 40)]), "2026-11-23")).toBeNull();
  });

  it("leaves out a new card's first two weeks after release", () => {
    // Counting its first $60 days, the usual price would be $50 and $40 a drop.
    const prices = days([...flat(14, 60), ...flat(15, 40)]);
    expect(priceDrop(prices, "2026-11-23")).not.toBeNull();
    expect(priceDrop(prices, "2026-11-23", "2026-10-26")).toBeNull();
    // A set that isn't out yet is all presale prices.
    expect(priceDrop(prices, "2026-11-23", "2026-12-05")).toBeNull();
    // Long after release, nothing is left out.
    expect(priceDrop(prices, "2026-11-23", "2026-08-01")).not.toBeNull();
  });

  it("needs a week of prices over two weeks, and a recent price", () => {
    // Thirteen days: too short a span, though more than a week of prices.
    expect(priceDrop(days([...flat(13, 40), 30]), "2026-11-23")).toBeNull();
    // Six prices over three weeks: too few, though the span is long enough.
    expect(priceDrop(sparse([...flat(6, 40), 30], 4), "2026-11-23")).toBeNull();
    expect(priceDrop(days([...flat(40, 40), 30], "2026-11-10"), "2026-11-23")).toBeNull();
    expect(priceDrop(days([...flat(40, 40), 0]), "2026-11-23")).toBeNull();
    // A card priced every other day still has enough.
    expect(priceDrop(sparse([...flat(15, 40), 30], 2), "2026-11-23")).toEqual({
      from: 40,
      now: 30,
      share: 0.25,
    });
  });

  it("says nothing right after a gap of more than a week", () => {
    const before = days(flat(30, 40), "2026-11-05");
    expect(priceDrop([...before, { day: "2026-11-23", price: 30 }], "2026-11-23")).toBeNull();
  });

  it("leaves out days before a gap of more than a week", () => {
    // Counting the $60 days before the gap, the usual price would be $50.
    const old = days(flat(30, 60), "2026-11-01");
    const recent = days([40, 50, 40, 50, 40, 50, 40, 50, 40, 50, 40, 50, 40, 50, 38]);
    expect(priceDrop([...old, ...recent], "2026-11-23")).toEqual({ from: 45, now: 38, share: 700 / 4500 });
  });

  it("only looks back 30 days for the usual price", () => {
    // Two days further back, there'd be as many $100 days as $40 days, and the usual price $70.
    expect(priceDrop(days([...flat(46, 100), ...flat(16, 40), 30]), "2026-11-23")).toEqual({
      from: 40,
      now: 30,
      share: 0.25,
    });
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
