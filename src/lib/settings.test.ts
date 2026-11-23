import { describe, expect, it } from "vitest";
import { readSettings } from "./settings";

const defaults = { sort: "new", cap: 0, full: false, q: "" };
const allowed = { sort: ["new", "old"], cap: [0, 5, 25] };

describe("readSettings", () => {
  it("gives the defaults when nothing was saved or the copy is unreadable", () => {
    expect(readSettings(null, defaults, allowed)).toEqual(defaults);
    expect(readSettings("{not json", defaults, allowed)).toEqual(defaults);
    expect(readSettings("[1,2]", defaults, allowed)).toEqual(defaults);
  });
  it("reads back saved values", () => {
    const saved = JSON.stringify({ sort: "old", cap: 25, full: true, q: "gengar" });
    expect(readSettings(saved, defaults, allowed)).toEqual({ sort: "old", cap: 25, full: true, q: "gengar" });
  });
  it("drops values of the wrong type or outside the allowed list, and keys it doesn't know", () => {
    const saved = JSON.stringify({ sort: "random", cap: "5", full: 1, q: "pikachu", extra: true });
    expect(readSettings(saved, defaults, allowed)).toEqual({ ...defaults, q: "pikachu" });
  });
});
