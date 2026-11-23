import { describe, expect, it } from "vitest";
import { parseCatalog } from "~/features/catalog/catalog";
import { testCard } from "~/features/cards/testCard";
import type { Card } from "~/features/cards/types";
import type { PickCard } from "../picks";
import { artWarmup, offThemePicks, refillPicks } from "../refill";
import { matchSeeds, parseArt, percentiles, rowOf, type ArtIndex } from "./art";
import { catalogFeatures, eraOf, priceBand, type CardFeatures } from "./features";
import {
  buildTaste,
  distributionAffinity,
  identityAffinity,
  knownSpecies,
  pokemonTheme,
  withLines,
  type Example,
} from "./taste";

// Rarities: 0 Common, 1 Rare, 2 Illustration Rare, 3 Special Illustration Rare.
// Artists: 0 Aya, 1 Ben, 2 Cy.
const SV = "2024-05-24";
const cat = parseCatalog({
  asOf: "2026-11-22",
  sets: [
    ["Mask Set", 0, SV],
    ["Old Set", 0, "2004-01-01"],
    ["Japan Set", 1, SV],
  ],
  rarities: ["Common", "Rare", "Illustration Rare", "Special Illustration Rare"],
  artists: ["Aya", "Ben", "Cy"],
  cards: [
    // On the list, in "Spooky": illustration rares by Aya.
    [10, "Gengar", 0, "180", 2, 20, 0],
    [11, "Haunter", 0, "181", 2, 15, 0],
    // Candidates.
    [20, "Gengar", 0, "50", 0, 0.5, 1], // a common Gengar
    [21, "Gengar", 1, "5", 1, 8, 1], // an old plain rare Gengar
    [22, "Pikachu", 0, "182", 2, 18, 0], // an illustration rare by Aya
    [23, "Eevee", 0, "183", 2, 16, 2], // an illustration rare by Cy
    [24, "Mewtwo", 0, "200", 3, 400, 1], // far pricier than the collection
    [25, "Dragonite", 0, "184", 2, 12, 2], // an illustration rare by Cy
    [26, "Gengar", 2, "190", 2, 30, 0], // Japanese
  ],
});

const card = (over: Partial<Card>): Card =>
  testCard({ number: "180", set: "Mask Set", addedAt: "2026-11-01", collections: ["Spooky"], ...over });

const pick = (over: Partial<PickCard>): PickCard => ({
  id: "p",
  name: "Eevee",
  set: "Mask Set",
  number: "183",
  lang: "EN",
  coll: "Spooky",
  status: "passed",
  batch: 0,
  rank: 0,
  tcgdexId: null,
  tcgProduct: 23,
  img: null,
  market: 16,
  priceAsOf: "2026-11-22",
  live: false,
  rarity: "Illustration Rare",
  illustrator: "Cy",
  reason: "",
  auto: true,
  ...over,
});

const listed = [card({ id: "a" }), card({ id: "b", name: "Haunter", number: "181" })];
const base = { catalog: cat, collections: ["Spooky"], day: "2026-11-22" };
const spooky = (picks: PickCard[]) => picks.filter((p) => p.coll === "Spooky");

describe("refill ranking", () => {
  it("prefers the collection's kind of card by its artist over a plain card of the same Pokémon", () => {
    const out = spooky(refillPicks({ ...base, cards: listed, picks: [] }));
    const ids = out.map((p) => p.tcgProduct);
    expect(ids[0]).toBe(22); // Aya's Pikachu illustration rare first
    expect(ids).not.toContain(20); // commons stay out of a collection with none
    expect(ids).not.toContain(26); // Japanese stays out of an English collection
    if (ids.includes(21)) expect(ids.indexOf(21)).toBeGreaterThan(ids.indexOf(22));
  });

  it("explains each pick", () => {
    const out = spooky(refillPicks({ ...base, cards: listed, picks: [] }));
    expect(out[0]?.reason).toBe("Art by Aya, like 2 cards in Spooky");
    expect(out[0]?.illustrator).toBe("Aya");
  });

  it("learns from passes: passing on one artist's card ranks their other cards lower", () => {
    // Leaving out the passed card itself, which can't come back.
    const before = spooky(refillPicks({ ...base, cards: listed, picks: [] }))
      .map((p) => p.tcgProduct)
      .filter((id) => id !== 23);
    const after = spooky(refillPicks({ ...base, cards: listed, picks: [pick({})] })).map((p) => p.tcgProduct);
    expect(after).not.toContain(23); // the passed card itself
    const at = (ids: (number | null)[]) => (ids.includes(25) ? ids.indexOf(25) : Infinity);
    expect(at(after)).toBeGreaterThanOrEqual(at(before));
  });

  it("suggests commons once a collection is mostly commons", () => {
    const commons = [
      card({ id: "x", name: "Gengar", number: "50", set: "Mask Set" }),
      card({ id: "y", name: "Haunter", number: "181" }),
    ];
    const withCommons = parseCatalog({
      asOf: cat.asOf,
      sets: [["Mask Set", 0, SV]],
      rarities: ["Common", "Illustration Rare"],
      artists: ["Aya"],
      cards: [
        [20, "Gengar", 0, "50", 0, 0.5, 0],
        [11, "Haunter", 0, "181", 1, 15, 0],
        [30, "Gastly", 0, "51", 0, 0.3, 0],
      ],
    });
    const out = spooky(refillPicks({ ...base, catalog: withCommons, cards: commons, picks: [] }));
    expect(out.map((p) => p.tcgProduct)).toContain(30);
  });

  it("keeps picks already on screen in place, and fills only the gaps", () => {
    const keep = [
      { coll: "Spooky", pid: 25, reason: "Shown earlier" },
      { coll: "Spooky", pid: 23, reason: "Passed since" },
    ];
    const out = spooky(refillPicks({ ...base, cards: listed, picks: [pick({ tcgProduct: 23 })], keep }));
    expect(out[0]).toMatchObject({ tcgProduct: 25, reason: "Shown earlier", rank: 0 });
    expect(out.map((p) => p.tcgProduct)).not.toContain(23);
  });

  it("works without art, and uses it once it's there", () => {
    // Fingerprints: Dragonite (25) looks just like the Gengar on the list (10); the rest are unrelated.
    const index = artIndex(4, [
      [10, [127, 0, 0, 0]],
      [11, [0, 127, 0, 0]],
      [22, [0, 0, 127, 0]],
      [23, [0, 0, 0, 127]],
      [25, [125, 0, 20, 0]],
      // Plenty of unrelated cards, as in the real file.
      ...Array.from({ length: 30 }, (_, i): [number, number[]] => [1000 + i, [0, 0, i % 2 ? 127 : -127, 0]]),
    ]);
    const plain = spooky(refillPicks({ ...base, cards: listed, picks: [] }));
    const withArt = spooky(refillPicks({ ...base, cards: listed, picks: [], art: index }));
    const at = (ps: PickCard[]) => ps.findIndex((p) => p.tcgProduct === 25);
    expect(at(withArt)).toBeLessThan(at(plain) === -1 ? Infinity : at(plain));
    expect(withArt.find((p) => p.tcgProduct === 25)?.reason).toMatch(/^Looks like your Gengar|^Art by/);
  });

  it("keeps filling a one-Pokémon collection, even after passes on that Pokémon", () => {
    const mews = parseCatalog({
      asOf: cat.asOf,
      sets: [["Mask Set", 0, SV]],
      rarities: ["Common", "Illustration Rare"],
      artists: ["Aya", "Kai", "Rin", "Sho", "Tomo"],
      cards: Array.from({ length: 20 }, (_, i) => [
        100 + i,
        i % 2 ? "Mew ex" : "Mew",
        0,
        String(100 + i),
        1,
        10 + i,
        i % 5,
      ]),
    });
    const mine = [0].map((i) =>
      card({ id: String(i), name: "Mew", number: String(100 + i), collections: ["Mew"] }),
    );
    const passes = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) =>
      pick({ id: String(i), name: "Mew", number: String(100 + i), tcgProduct: 100 + i, coll: "Mew" }),
    );
    const out = refillPicks({ ...base, catalog: mews, collections: ["Mew"], cards: mine, picks: passes });
    expect(out.filter((p) => p.coll === "Mew")).toHaveLength(8);
  });

  it("keeps a collection about its Pokémon to those Pokémon, older printings included", () => {
    const MM = "Mew & Mewtwo";
    const mixed = parseCatalog({
      asOf: cat.asOf,
      sets: [
        ["Mask Set", 0, SV],
        ["Old Set", 0, "2004-01-01"],
      ],
      rarities: ["Common", "Rare", "Illustration Rare"],
      artists: ["Aya", "Kai", "Rin", "Sho", "Tomo"],
      cards: [
        // On the list: three modern illustration rares of Mew and Mewtwo.
        ...[0, 1, 2].map((i) => [100 + i, i ? "Mew ex" : "Mewtwo ex", 0, String(100 + i), 2, 30, i]),
        // Old plain rare Mews, and modern illustration rares of other Pokémon.
        ...Array.from({ length: 10 }, (_, i) => [200 + i, "Mew", 1, String(i + 1), 1, 20, i % 5]),
        ...Array.from({ length: 10 }, (_, i) => [300 + i, "Milotic ex", 0, String(300 + i), 2, 30, i % 5]),
      ],
    });
    const mine = [0, 1, 2].map((i) =>
      card({
        id: String(i),
        name: i ? "Mew ex" : "Mewtwo ex",
        number: String(100 + i),
        collections: [MM],
      }),
    );
    const out = refillPicks({ ...base, catalog: mixed, collections: [MM], cards: mine, picks: [] });
    const mew = out.filter((p) => p.coll === MM);
    expect(mew).toHaveLength(8);
    expect(mew.every((p) => p.name === "Mew")).toBe(true);

    // A pick of another Pokémon kept from before the collection was about Mew goes.
    const keep = [{ coll: MM, pid: 300, reason: "Shown earlier" }];
    const again = refillPicks({
      ...base,
      catalog: mixed,
      collections: [MM],
      cards: mine,
      picks: [],
      keep,
    });
    expect(again.some((p) => p.coll === MM && p.name === "Milotic ex")).toBe(false);

    // Its name says what it's about, so other Pokémon on its cards don't open it up to them, and a waiting
    // pick of another Pokémon saved for it before goes out of sight, its place filled with a Mew.
    const diluted = [
      ...mine,
      ...[0, 1, 2].map((i) =>
        card({ id: `m${String(i)}`, name: "Milotic ex", number: String(300 + i), collections: [MM] }),
      ),
    ];
    const stale = pick({
      id: "zekrom",
      coll: MM,
      status: "new",
      name: "Milotic ex",
      number: "305",
      tcgProduct: 305,
    });
    const input = { ...base, catalog: mixed, collections: [MM], cards: diluted, picks: [stale] };
    const named = refillPicks(input).filter((p) => p.coll === MM);
    expect(named).toHaveLength(8);
    expect(named.every((p) => p.name === "Mew")).toBe(true);
    expect([...offThemePicks(input)]).toEqual(["zekrom"]);
  });

  it("counts a pick he added once, as the card it put on the list", () => {
    const out = spooky(
      refillPicks({
        ...base,
        cards: listed,
        picks: [pick({ tcgProduct: 10, name: "Gengar", number: "180", status: "added" })],
      }),
    );
    expect(out[0]?.reason).toBe("Art by Aya, like 2 cards in Spooky");
  });

  it("never moves a pick on screen to another collection", () => {
    const keep = [{ coll: "Later", pid: 22, reason: "Shown earlier" }];
    const out = refillPicks({ ...base, collections: ["Spooky", "Later"], cards: listed, picks: [], keep });
    expect(out.filter((p) => p.tcgProduct === 22).map((p) => p.coll)).toEqual(["Later"]);
  });

  it("can work out the art rankings ahead, a step at a time, with the same picks", () => {
    const index = artIndex(2, [
      [10, [127, 0]],
      [25, [120, 30]],
      [23, [0, 127]],
    ]);
    const direct = refillPicks({ ...base, day: "2026-11-21", cards: listed, picks: [], art: index });
    const steps = artWarmup({ ...base, day: "2026-11-21", cards: listed, picks: [] }, index);
    expect(steps).toHaveLength(4); // two per collection, Spooky and Wildcards
    for (const step of steps) step();
    expect(refillPicks({ ...base, day: "2026-11-21", cards: listed, picks: [], art: index })).toEqual(direct);
  });

  it("fills Wildcards with cheap full art of Pokémon the collections don't have", () => {
    // No collections to fill first, so every candidate is free for Wildcards.
    const wild = refillPicks({ ...base, collections: [], cards: listed, picks: [] }).filter(
      (p) => p.coll === "Wildcards",
    );
    for (const p of wild) {
      expect(p.lang).toBe("EN");
      expect(p.market).toBeGreaterThanOrEqual(2);
      expect(p.market).toBeLessThanOrEqual(50);
      expect(["Gengar", "Haunter"]).not.toContain(p.name);
    }
    expect(wild.map((p) => p.tcgProduct)).toContain(22);
  });
});

describe("taste", () => {
  const ex = (...species: string[]): Example => ({ f: { species } as unknown as CardFeatures, weight: 1 });
  it("tells a collection about a few Pokémon from one about many or about a look", () => {
    const theme = (...cards: string[][]) => themeOf("", ...cards);
    const themeOf = (coll: string, ...cards: string[][]) => {
      const t = pokemonTheme(
        coll,
        cards.map((ss) => ex(...ss)),
        known,
      );
      return t ? [...t].sort() : null;
    };
    const known = knownSpecies(
      [
        "mew",
        "mewtwo",
        "ninetales",
        "gengar",
        "eevee",
        "umbreon",
        "gloom",
        "kyurem",
        "black kyurem",
        "mr. mime",
        "ho-oh",
        "nidoran f",
        "nidoran (f)",
        "tapu koko",
        "farfetch'd",
        "research",
      ].map((s) => ({ species: [s] })),
    );
    expect(theme(["mew"], ["mew"], ["mew"], ["mewtwo"], ["mewtwo"])).toEqual(["mew", "mewtwo"]);
    expect(theme(["gastly"], ["haunter"], ["gengar"], ["gengar"], ["haunter"], ["gastly"])).toEqual([
      "gastly",
      "gengar",
      "haunter",
    ]);
    // A line counts as one, with what its Pokémon evolve from and into, even ones not on the cards yet.
    expect(theme(["haunter"], ["gengar"], ["gengar"], ["haunter"])).toEqual(["gastly", "gengar", "haunter"]);
    expect(
      theme(["squirtle"], ["wartortle"], ["charmander"], ["charizard"], ["ivysaur"], ["venusaur"]),
    ).toEqual([
      "blastoise",
      "bulbasaur",
      "charizard",
      "charmander",
      "charmeleon",
      "ivysaur",
      "squirtle",
      "venusaur",
      "wartortle",
    ]);
    // Four lines, or too few cards to tell.
    expect(
      theme(
        ["squirtle"],
        ["squirtle"],
        ["charmander"],
        ["charmander"],
        ["oddish"],
        ["oddish"],
        ["pichu"],
        ["pichu"],
      ),
    ).toBeNull();
    expect(theme(["mew"], ["mew"])).toBeNull();
    // The name decides once the Pokémon it names are on half the cards, whatever the rest are.
    expect(themeOf("Mew & Mewtwo", ["mew"], ["mew"], ["mew"], ["mewtwo"])).toEqual(["mew", "mewtwo"]);
    expect(
      themeOf("Mew & Mewtwo", ["mew"], ["milotic"], ["milotic"], ["mewtwo"], ["mew"], ["zekrom"]),
    ).toEqual(["mew", "mewtwo"]);
    expect(themeOf("MEW & MEWTWO", ["mew"], ["milotic"], ["zekrom"], ["meowth"])).toBeNull();
    expect(themeOf("NINETALES", ["ninetales"])).toEqual(["ninetales", "vulpix"]);
    // What it evolves from and into, not its cousins: Umbreon takes Eevee, not Vaporeon.
    expect(themeOf("Umbreon", ["umbreon"], ["umbreon"], ["eevee"])).toEqual(["eevee", "umbreon"]);
    // Other lines its cards show still join a name.
    expect(themeOf("Mew", ["mew"], ["mew"], ["mewtwo"], ["mewtwo"])).toEqual(["mew", "mewtwo"]);
    expect(themeOf("Gloom", ["vileplume"], ["vileplume"], ["mewtwo"], ["mewtwo"], ["vileplume"])).toEqual([
      "bellossom",
      "gloom",
      "mewtwo",
      "oddish",
      "vileplume",
    ]);
    // Every branch, whichever Pokémon of a line comes first.
    expect([...withLines(["vileplume", "oddish"])].sort()).toEqual([
      "bellossom",
      "gloom",
      "oddish",
      "vileplume",
    ]);
    // However it's spelled: punctuation, every spelling of a name, the longest name that fits.
    expect(themeOf("Tapu Koko + Mr Mime", ["tapu koko"])).toEqual(["mimejr", "mrmime", "mrrime", "tapukoko"]);
    expect(themeOf("Rowan's Farfetch'd", ["farfetch'd"])).toEqual(["farfetchd", "sirfetchd"]);
    expect(themeOf("Ho Oh.", ["ho-oh"])).toEqual(["hooh"]);
    expect(themeOf("Nidoran F", ["nidoran (f)"])).toEqual(["nidoqueen", "nidoranf", "nidorina"]);
    expect(themeOf("Black Kyurem", ["black kyurem"])).toEqual(["blackkyurem"]);
    // A name about a line takes all of it.
    expect(themeOf("Gengar line", ["gastly"], ["haunter"], ["gengar"], ["haunter"], ["gastly"])).toEqual([
      "gastly",
      "gengar",
      "haunter",
    ]);
    expect(
      themeOf("Eevee Evolutions", ["eevee"], ["vaporeon"], ["jolteon"], ["flareon"], ["umbreon"]),
    ).toEqual([
      "eevee",
      "espeon",
      "flareon",
      "glaceon",
      "jolteon",
      "leafeon",
      "sylveon",
      "umbreon",
      "vaporeon",
    ]);
    // A word that's also a card's name counts only with cards of it in; a part of a name never does.
    expect(themeOf("Research binder", ["pikachu"], ["eevee"], ["snorlax"])).toBeNull();
    expect(themeOf("Mewtwo", ["mew"], ["mew"], ["eevee"])).toBeNull();
    expect(theme(["mew"], ["mew"], ["mew"], ["mew"], ["pikachu"])).toEqual(["mew"]);
    // Three different Pokémon in a new collection aren't a theme yet.
    expect(theme(["oddish"], ["tangela"], ["paras"])).toBeNull();
    // A look: no Pokémon on most of it.
    expect(
      theme(["oddish"], ["bellsprout"], ["oddish"], ["tangela"], ["exeggcute"], ["paras"], ["oddish"]),
    ).toBeNull();
  });

  const fs = catalogFeatures(cat);
  const f = (pid: number) => {
    const hit = fs.find((x) => x.c.pid === pid);
    if (!hit) throw new Error(`no card ${String(pid)}`);
    return hit;
  };

  it("scores identity matches by how often they were added versus passed", () => {
    const t = buildTaste([
      { f: f(10), weight: 1 },
      { f: f(11), weight: 1 },
      { f: f(23), weight: -1 },
    ]);
    expect(identityAffinity(t, "artist", "Aya")).toBeCloseTo(2 / 3.5);
    expect(identityAffinity(t, "artist", "Cy")).toBeCloseTo(-1 / 2.5);
    expect(identityAffinity(t, "artist", "Nobody")).toBe(0);
  });

  it("gives neighbouring tiers, eras and price bands half credit", () => {
    const t = buildTaste([{ f: f(10), weight: 1 }]);
    expect(distributionAffinity(t, "band", priceBand(20))).toBe(1);
    expect(distributionAffinity(t, "band", priceBand(50))).toBe(0.5);
    expect(distributionAffinity(t, "band", priceBand(500))).toBe(0);
  });

  it("knows the eras, with Japanese sets a few months ahead", () => {
    expect(eraOf("2024-05-24", false)).toBe(eraOf("2023-04-01", false));
    expect(eraOf("2023-01-20", false)).not.toBe(eraOf("2023-04-01", false));
    expect(eraOf("2023-01-20", true)).toBe(eraOf("2023-04-01", false));
    expect(eraOf("", false)).toBe(-1);
  });
});

/** Builds an art.bin in memory, the way tools/art/pca.mjs writes it. */
function artIndex(dims: number, rows: [number, number[]][]): ArtIndex {
  const sorted = [...rows].sort((a, b) => a[0] - b[0]);
  const buf = new ArrayBuffer(12 + sorted.length * (4 + dims));
  const view = new DataView(buf);
  "ART1".split("").forEach((ch, i) => view.setUint8(i, ch.charCodeAt(0)));
  view.setUint8(4, 1);
  view.setUint8(5, dims);
  view.setUint32(8, sorted.length, true);
  sorted.forEach(([pid, vec], i) => {
    view.setUint32(12 + i * 4, pid, true);
    vec.forEach((x, k) => view.setInt8(12 + sorted.length * 4 + i * dims + k, x));
  });
  return parseArt(buf);
}

describe("art fingerprints", () => {
  const index = artIndex(2, [
    [7, [127, 0]],
    [3, [0, 127]],
    [5, [90, 90]],
  ]);

  it("reads art.bin and finds cards by product id", () => {
    expect(index.dims).toBe(2);
    expect([...index.pids]).toEqual([3, 5, 7]);
    expect(rowOf(index, 7)).toBe(2);
    expect(rowOf(index, 4)).toBe(-1);
  });

  it("rejects a malformed file", () => {
    expect(() => parseArt(new ArrayBuffer(8))).toThrow();
  });

  it("scores likeness to seeds and remembers the closest one", () => {
    const m = matchSeeds(index, [rowOf(index, 7)]);
    expect(m.score[rowOf(index, 7)]).toBeCloseTo(1);
    expect(m.score[rowOf(index, 3)]).toBeCloseTo(0);
    expect(m.score[rowOf(index, 5)]).toBeCloseTo(90 / 127, 2);
    expect(m.closest[rowOf(index, 5)]).toBe(0);
  });

  it("ranks values as percentiles", () => {
    const rank = percentiles(Float32Array.from([0, 1, 2, 3]));
    expect(rank(0)).toBe(0);
    expect(rank(2)).toBe(0.5);
    expect(rank(10)).toBe(1);
  });
});
