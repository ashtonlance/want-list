import { describe, expect, it } from "vitest";
import { testCard } from "~/features/cards/testCard";
import { pickMark, type PickCard } from "./picks";

const pick = (over: Partial<PickCard>): PickCard => ({
  id: "p1",
  name: "Raikou ex",
  set: "Delta Reign",
  number: "136",
  lang: "EN",
  coll: "Legends",
  status: "new",
  batch: 1,
  rank: 0,
  tcgdexId: null,
  tcgProduct: null,
  img: null,
  market: 101.83,
  priceAsOf: "2026-11-23",
  live: false,
  rarity: "",
  illustrator: "",
  reason: "",
  auto: false,
  ...over,
});
const onList = (status: "want" | "got") =>
  testCard({ name: "Raikou ex", set: "Delta Reign", number: "136", status });

describe("pickMark", () => {
  it("goes by the list card when the pick is on the list", () => {
    expect(pickMark([onList("got")], pick({}))).toBe("Got it");
    expect(pickMark([onList("got")], pick({ status: "added" }))).toBe("Got it");
    expect(pickMark([onList("want")], pick({ status: "owned" }))).toBe("On your list");
  });
  it("falls back to the pick's own status, and is empty for an open pick", () => {
    expect(pickMark([], pick({ status: "owned" }))).toBe("Got it");
    expect(pickMark([], pick({ status: "added" }))).toBe("On your list");
    expect(pickMark([], pick({}))).toBeUndefined();
    expect(pickMark([], pick({ status: "passed" }))).toBeUndefined();
  });
});
