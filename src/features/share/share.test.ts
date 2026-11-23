import { describe, expect, it } from "vitest";
import { testCard } from "~/features/cards/testCard";
import { buyUrl, printingOf, sharedList, shareUrl } from "./share";

const price = (market: number) => ({ sub: "Holofoil", market, low: null, productId: 1, asOf: "" });

describe("sharedList", () => {
  const cards = [
    testCard({ id: "a", name: "Pikachu", tcg: price(40), collections: ["Gifts"] }),
    testCard({ id: "b", name: "Gengar", tcg: price(12), priority: true }),
    testCard({ id: "c", name: "Mew", tcg: price(5) }),
    testCard({ id: "d", name: "Eevee", status: "got", tcg: price(9) }),
    testCard({ id: "e", name: "Snorlax", priority: true, tcg: price(80), collections: ["Gifts"] }),
    testCard({ id: "f", name: "Ditto" }),
  ];

  it("leaves out cards already got, puts priority first and sorts each part cheapest first", () => {
    const l = sharedList(cards, null);
    expect(l.top.map((c) => c.id)).toEqual(["b", "e"]);
    expect(l.rest.map((c) => c.id)).toEqual(["c", "a", "f"]);
    expect(l.count).toBe(5);
    expect(l.total).toBe(137);
  });

  it("narrows to one collection", () => {
    const l = sharedList(cards, "Gifts");
    expect([...l.top, ...l.rest].map((c) => c.id)).toEqual(["e", "a"]);
    expect(l.total).toBe(120);
  });
});

describe("shareUrl", () => {
  it("builds the page address under the app's base path", () => {
    expect(shareUrl("https://x.io", "/want-list/", null)).toBe("https://x.io/want-list/share/");
    expect(shareUrl("https://x.io", "/want-list", "Gengar & friends")).toBe(
      "https://x.io/want-list/share/?c=Gengar%20%26%20friends",
    );
  });
});

describe("printingOf", () => {
  it("prefers the typed variant over TCGplayer's printing", () => {
    expect(printingOf({ variant: "Reverse Holo", tcg: price(1) })).toBe("Reverse Holo");
    expect(printingOf({ variant: "", tcg: price(1) })).toBe("Holofoil");
    expect(printingOf({ variant: "", tcg: null })).toBe("");
  });
});

describe("buyUrl", () => {
  const deal = {
    site: "eBay",
    seller: "",
    condition: "",
    url: "https://ebay.com/itm/1",
    price: 10,
    shipping: 2,
    total: 12,
    checkedAt: "",
  };
  it("links to the deal when the deal sets the price", () => {
    expect(buyUrl(testCard({ deal, tcg: price(20) }))).toBe("https://ebay.com/itm/1");
  });
  it("links to the TCGplayer product, or searches for the card", () => {
    expect(buyUrl(testCard({ tcg: price(20) }))).toBe("https://www.tcgplayer.com/product/1");
    expect(buyUrl(testCard({ deal: { ...deal, url: "" } }))).toContain(
      "tcgplayer.com/search/pokemon/product?q=Gengar%2094",
    );
  });
});
