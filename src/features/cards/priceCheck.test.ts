import { describe, expect, it, vi } from "vitest";
import { parseCatalog } from "~/features/catalog/catalog";
import { findPrice, pricePatch, type PriceSources } from "./priceCheck";
import { testCard } from "./testCard";
import { needsPriceCheck } from "./usePriceBackfill";

vi.mock("~/lib/supabase", () => ({ SUPABASE_URL: "https://x.supabase.co", supabase: {} }));

const cat = parseCatalog({
  asOf: "2026-11-23",
  sets: [
    ["Fossil", 0, "1999-10-10"],
    ["Pokemon Card 151", 1, "2023-06-16"],
  ],
  rarities: ["Rare"],
  cards: [
    [100, "Gengar", 0, "5", 0, 40],
    [101, "Haunter", 0, "6", 0, 0],
    [200, "Mew ex", 1, "151", 0, 20],
  ],
});

const sources = (over: Partial<PriceSources> = {}): PriceSources => ({
  catalog: () => Promise.resolve(cat),
  prices: { asOf: "2026-11-23", items: {} },
  live: () => Promise.resolve(null),
  ...over,
});

const gengar = testCard({ name: "Gengar", set: "Fossil", number: "5" });

describe("findPrice", () => {
  it("matches the card in the catalog and takes the daily price for its printing", async () => {
    const prices = { asOf: "2026-11-23", items: { "100": { Holofoil: [42, 30] as [number, number] } } };
    expect(await findPrice(gengar, sources({ prices }))).toEqual({
      found: true,
      pid: 100,
      ask: { kind: "market", amount: 42, source: "TCGplayer market", asOf: "2026-11-23" },
    });
  });
  it("asks TCGdex live when the sync doesn't track the product yet", async () => {
    const live = vi.fn(() =>
      Promise.resolve({
        pid: 100,
        subs: { "Reverse Holofoil": [9, 7] as [number, number] },
        asOf: "2026-11-22",
      }),
    );
    const r = await findPrice({ ...gengar, variant: "Reverse Holo" }, sources({ live }));
    expect(live).toHaveBeenCalledWith("Fossil", "5", 100);
    expect(r).toMatchObject({ found: true, ask: { amount: 9, asOf: "2026-11-22" } });
  });
  it("falls back to the catalog's price, but not for a reverse holo", async () => {
    expect(await findPrice(gengar, sources())).toMatchObject({ found: true, ask: { amount: 40 } });
    expect(await findPrice({ ...gengar, variant: "Reverse Holo" }, sources())).toMatchObject({
      found: false,
      pid: 100,
    });
  });
  it("skips TCGdex for Japanese cards", async () => {
    const live = vi.fn(() => Promise.resolve(null));
    const mew = testCard({ name: "Mew ex", set: "Pokemon Card 151", number: "151", lang: "JP" });
    expect(await findPrice(mew, sources({ live }))).toMatchObject({
      found: true,
      pid: 200,
      ask: { amount: 20 },
    });
    expect(live).not.toHaveBeenCalled();
  });
  it("says why when it can't find one", async () => {
    expect(await findPrice(testCard({ name: "Haunter", set: "Fossil", number: "6" }), sources())).toEqual({
      found: false,
      pid: 101,
      reason: "TCGplayer shows no recent sales or listings for this printing.",
    });
    expect(await findPrice(testCard({ set: "Jungle" }), sources())).toMatchObject({
      found: false,
      pid: null,
    });
  });
});

describe("pricePatch", () => {
  it("saves the price and product, and clears the old queue", () => {
    const ask = { kind: "market" as const, amount: 42, source: "TCGplayer market", asOf: "2026-11-23" };
    expect(pricePatch({ found: true, pid: 100, ask }, testCard())).toEqual({
      tcgProduct: 100,
      ask,
      noPrice: null,
      checkRequested: false,
    });
    expect(pricePatch({ found: false, pid: null, reason: "Nope." }, testCard(), "2026-11-23")).toEqual({
      noPrice: { reason: "Nope.", at: "2026-11-23" },
      checkRequested: false,
    });
  });
});

describe("pricePatch keeps", () => {
  it("a marketplace ask or a price typed in by hand", () => {
    const ask = { kind: "market" as const, amount: 42, source: "TCGplayer market", asOf: "2026-11-23" };
    const dh = testCard({ ask: { kind: "ask", amount: 8, source: "DoubleHolo", asOf: "2026-11-01" } });
    const mine = testCard({
      ask: { kind: "price", amount: 12, source: "Entered by hand", asOf: "2026-11-20" },
    });
    expect(pricePatch({ found: true, pid: 100, ask }, dh)).not.toHaveProperty("ask");
    expect(pricePatch({ found: true, pid: 100, ask }, mine)).not.toHaveProperty("ask");
  });
});

describe("needsPriceCheck", () => {
  it("picks cards with no price, the old queue, and week-old misses", () => {
    expect(needsPriceCheck(testCard())).toBe(true);
    expect(
      needsPriceCheck(
        testCard({ checkRequested: true, ask: { kind: "market", amount: 1, source: "", asOf: "" } }),
      ),
    ).toBe(true);
    expect(needsPriceCheck(testCard({ ask: { kind: "market", amount: 1, source: "", asOf: "" } }))).toBe(
      false,
    );
    const miss = (at: string) => testCard({ noPrice: { reason: "x", at } });
    expect(needsPriceCheck(miss("2026-11-20"), "2026-11-23")).toBe(false);
    expect(needsPriceCheck(miss("2026-11-10"), "2026-11-23")).toBe(true);
    expect(needsPriceCheck({ ...miss("2026-11-10"), status: "got" }, "2026-11-23")).toBe(false);
    expect(
      needsPriceCheck(testCard({ ask: { kind: "price", amount: 12, source: "Entered by hand", asOf: "" } })),
    ).toBe(false);
  });
});

describe("when a source doesn't answer", () => {
  it("saves nothing, so the next check tries again", async () => {
    const noCatalog = sources({ catalog: () => Promise.resolve(undefined) });
    const r = await findPrice(gengar, noCatalog);
    expect(r).toMatchObject({ found: false, transient: true });
    expect(pricePatch(r, gengar)).toBeNull();
  });
  it("uses the catalog's price when TCGdex is down, and retries when there's none", async () => {
    const live = () => Promise.reject(new Error("offline"));
    expect(await findPrice(gengar, sources({ live }))).toMatchObject({ found: true, ask: { amount: 40 } });
    const haunter = testCard({ name: "Haunter", set: "Fossil", number: "6" });
    expect(await findPrice(haunter, sources({ live }))).toMatchObject({ found: false, transient: true });
  });
});

describe("pricePatch replaces", () => {
  it("a lowest listing the check filled in earlier", () => {
    const ask = { kind: "market" as const, amount: 42, source: "TCGplayer market", asOf: "2026-11-23" };
    const auto = testCard({
      ask: { kind: "ask", amount: 30, source: "TCGplayer lowest listing", asOf: "2026-11-20" },
    });
    expect(pricePatch({ found: true, pid: 100, ask }, auto)).toMatchObject({ ask });
  });
});
