import { describe, expect, it } from "vitest";
import { startingSlots } from "./slots";

describe("startingSlots", () => {
  it("gives two empty pages for a blank binder", () => {
    expect(startingSlots(9)).toEqual(Array.from({ length: 18 }, () => null));
  });
  it("fills pockets in order and pads the last page", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `c${String(i)}`);
    const slots = startingSlots(9, ids);
    expect(slots).toHaveLength(27);
    expect(slots.slice(0, 20)).toEqual(ids.map((id) => ({ k: "c", id })));
    expect(slots.slice(20).every((s) => s === null)).toBe(true);
  });
  it("keeps two pages when a few cards fit on the first", () => {
    const slots = startingSlots(4, ["a", "b"]);
    expect(slots).toEqual([{ k: "c", id: "a" }, { k: "c", id: "b" }, null, null, null, null, null, null]);
  });
});
