import { describe, expect, it } from "vitest";
import { visibleCards, type ListFilter } from "./filters";
import { testCard } from "./testCard";

const cards = [
  testCard({ id: "a", name: "Gengar", set: "Arceus", number: "16", variant: "Reverse Holo" }),
  testCard({ id: "b", name: "Gengar", set: "Fossil", number: "5", status: "got" }),
  testCard({ id: "c", name: "Haunter", set: "Fossil", number: "6", collections: ["Gengar line"] }),
];
const base: ListFilter = { status: "want", coll: null, prio: false, q: "", sort: "name" };
const ids = (f: Partial<ListFilter>) => visibleCards(cards, { ...base, ...f }).map((c) => c.id);

describe("visibleCards", () => {
  it("shows the chosen status when not searching", () => {
    expect(ids({})).toEqual(["a", "c"]);
    expect(ids({ status: "got" })).toEqual(["b"]);
  });
  it("searches wanted and collected cards together, words in any order", () => {
    expect(ids({ q: "gengar" })).toEqual(["a", "b", "c"]);
    expect(ids({ q: "fossil gengar" })).toEqual(["b", "c"]); // c is in the Gengar line collection
    expect(ids({ q: "5 fossil" })).toEqual(["b"]);
    expect(ids({ q: "gengar 16" })).toEqual(["a"]);
  });
  it("keeps a search inside the collection on screen", () => {
    expect(ids({ q: "fossil", coll: "Gengar line" })).toEqual(["c"]);
  });
});
