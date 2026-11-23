import { beforeEach, describe, expect, it } from "vitest";
import { byRecentUse, noteCollectionUse } from "./recentCollections";

const id = (s: string) => s;

describe("byRecentUse", () => {
  it("puts recently used names first, most recent first, and keeps the rest in order", () => {
    expect(byRecentUse(["a", "b", "c", "d"], id, ["c", "a"])).toEqual(["c", "a", "b", "d"]);
  });
  it("ignores names that aren't there any more", () => {
    expect(byRecentUse(["a", "b"], id, ["gone", "b"])).toEqual(["b", "a"]);
  });
  it("leaves the order alone with no history", () => {
    expect(byRecentUse(["b", "a"], id, [])).toEqual(["b", "a"]);
  });
});

describe("noteCollectionUse", () => {
  beforeEach(() => localStorage.clear());
  it("moves a collection to the front without repeats", () => {
    noteCollectionUse("a");
    noteCollectionUse("b");
    noteCollectionUse("a");
    expect(JSON.parse(localStorage.getItem("wl-recent-colls") ?? "[]")).toEqual(["a", "b"]);
  });
});
