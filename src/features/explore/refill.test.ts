import { describe, expect, it } from "vitest";
import { testCatalog } from "~/features/catalog/testCatalog";
import { NO_ASK, type Card } from "~/features/cards/types";
import type { PickCard } from "./picks";
import { MIN_OPEN, refillPicks, speciesOf } from "./refill";

const cat = testCatalog();

const card = (over: Partial<Card>): Card => ({
  id: "c1",
  name: "Gengar",
  number: "5",
  variant: "",
  set: "Newest Set",
  lang: "EN",
  note: "",
  addedAt: "2026-11-01",
  ask: NO_ASK,
  deal: null,
  listing: null,
  dhUrl: null,
  img: null,
  imgSource: "",
  priority: false,
  status: "want",
  checkRequested: false,
  order: null,
  collections: ["Spooky"],
  slots: {},
  tcg: null,
  ...over,
});

const pick = (over: Partial<PickCard>): PickCard => ({
  id: "p1",
  name: "Gengar ex",
  set: "Older Set",
  number: "100",
  lang: "EN",
  coll: "Spooky",
  status: "new",
  batch: 1,
  rank: 0,
  tcgdexId: null,
  tcgProduct: 3,
  img: null,
  market: 40,
  priceAsOf: "2026-11-22",
  live: false,
  rarity: "Rare",
  illustrator: "",
  reason: "",
  auto: false,
  ...over,
});

describe("speciesOf", () => {
  it("drops forms and prefixes and splits tag teams", () => {
    expect(speciesOf("Mega Gengar ex")).toEqual(["gengar"]);
    expect(speciesOf("Umbreon & Darkrai GX")).toEqual(["umbreon", "darkrai"]);
    expect(speciesOf("Team Rocket's Mewtwo ex")).toEqual(["mewtwo"]);
    expect(speciesOf("Misty's Psyduck")).toEqual(["psyduck"]);
    expect(speciesOf("Farfetch'd")).toEqual(["farfetch'd"]);
  });
});

describe("refillPicks", () => {
  const base = { catalog: cat, collections: ["Spooky"], day: "2026-11-22" };

  it("tops a collection up with the same Pokémon from the catalog, never a card already listed", () => {
    const out = refillPicks({ ...base, cards: [card({})], picks: [] });
    const spooky = out.filter((p) => p.coll === "Spooky");
    expect(spooky.map((p) => p.id)).toEqual(["auto:Spooky:3"]);
    expect(spooky[0]).toMatchObject({ auto: true, status: "new", name: "Gengar ex" });
  });

  it("skips cards that are already a pick somewhere", () => {
    const out = refillPicks({
      ...base,
      cards: [card({})],
      picks: [pick({ coll: "Other", status: "passed" })],
    });
    expect(out.filter((p) => p.coll === "Spooky")).toEqual([]);
  });

  it("adds nothing to a collection that already has enough open picks", () => {
    const open = Array.from({ length: MIN_OPEN }, (_, i) =>
      pick({ id: `p${String(i)}`, tcgProduct: 1000 + i, name: `Card ${String(i)}`, number: String(i) }),
    );
    const out = refillPicks({ ...base, cards: [card({})], picks: open });
    expect(out.filter((p) => p.coll === "Spooky")).toEqual([]);
  });
});
