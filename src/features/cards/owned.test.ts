import { describe, expect, it } from "vitest";
import { formatMoney } from "~/lib/format";
import { collectionValue, gradeLabel, ONE_COPY, ownedBadge, signedMoney, valueEach } from "./owned";
import { parseOwned } from "./parse";
import { testCard } from "./testCard";

const tcg = (market: number) => ({ sub: "Holofoil", market, low: null, productId: 1, asOf: "" });

describe("parseOwned", () => {
  it("reads nothing as no details, so saved cards stay as they were", () => {
    expect(parseOwned(undefined)).toBeNull();
    expect(parseOwned("x")).toBeNull();
  });
  it("cleans bad values back to safe ones", () => {
    expect(
      parseOwned({ qty: 0, condition: "Mint", grader: " PSA ", grade: 10, paid: -4, value: "3" }),
    ).toEqual({
      qty: 1,
      condition: null,
      grader: "PSA",
      grade: "10",
      paid: null,
      value: null,
    });
    expect(parseOwned({ qty: 2.7, condition: "LP", paid: 12.5 })).toMatchObject({
      qty: 2,
      condition: "LP",
      paid: 12.5,
    });
  });
});

describe("labels", () => {
  it("names the grade or the condition", () => {
    expect(gradeLabel({ ...ONE_COPY, grader: "PSA", grade: "10", condition: "NM" })).toBe("PSA 10");
    expect(gradeLabel({ ...ONE_COPY, condition: "LP" })).toBe("LP");
    expect(gradeLabel(ONE_COPY)).toBe("");
  });
  it("puts copies and grade on the tile badge", () => {
    expect(ownedBadge(ONE_COPY)).toBe("Got it");
    expect(ownedBadge({ ...ONE_COPY, qty: 3 })).toBe("Got 3");
    expect(ownedBadge({ ...ONE_COPY, grader: "CGC", grade: "9.5" })).toBe("CGC 9.5");
    expect(ownedBadge({ ...ONE_COPY, qty: 2, condition: "NM" })).toBe("Got 2 · NM");
    expect(ownedBadge({ ...ONE_COPY, condition: "LP" })).toBe("Got it · LP");
    expect(ownedBadge({ ...ONE_COPY, qty: 2, grader: "PSA", grade: "10" })).toBe("Got 2 · PSA 10");
  });
});

describe("valueEach", () => {
  it("prefers your own value, then the market price", () => {
    expect(valueEach(testCard({ tcg: tcg(20), owned: { ...ONE_COPY, value: 300 } }))).toBe(300);
    expect(valueEach(testCard({ tcg: tcg(20) }))).toBe(20);
    expect(valueEach(testCard())).toBeNull();
  });
});

describe("collectionValue", () => {
  it("counts copies, worth, paid and gain over got cards only", () => {
    const v = collectionValue([
      testCard({ id: "a", status: "got", tcg: tcg(10), owned: { ...ONE_COPY, qty: 3, paid: 4 } }),
      testCard({
        id: "b",
        status: "got",
        tcg: tcg(50),
        owned: { ...ONE_COPY, grader: "PSA", grade: "10", value: 200, paid: 120 },
      }),
      testCard({ id: "c", status: "got", tcg: tcg(7) }),
      testCard({ id: "d", status: "got", owned: { ...ONE_COPY, paid: 15 } }),
      testCard({ id: "e", status: "want", tcg: tcg(999) }),
    ]);
    // Card d has a price paid but no value, so it's left out of paid as well as gain.
    expect(v).toEqual({ cards: 4, copies: 6, worth: 237, paid: 132, gain: 98, hasPaid: true });
  });
});

describe("signedMoney", () => {
  it("signs gains and losses", () => {
    expect(signedMoney(12.5, formatMoney)).toBe("+$12.50");
    expect(signedMoney(-3, formatMoney)).toBe("−$3.00");
    expect(signedMoney(0, formatMoney)).toBe("$0.00");
  });
});
