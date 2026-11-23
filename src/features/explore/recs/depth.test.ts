import { beforeEach, describe, expect, it } from "vitest";
import { ALL_PICKS } from "../search";
import { depthOf, depthStore, depthToday, showDeeper } from "./depth";

const DAY = "2026-11-23";

describe("how far For You was scrolled", () => {
  beforeEach(() => depthStore.set({ day: "", tabs: {} }));

  it("shows a page more from the depth on screen, once per depth, up to the most", () => {
    showDeeper("Ocean", DAY, 8, 8, 20);
    showDeeper("Ocean", DAY, 8, 8, 20); // the same end seen twice before the page came in
    expect(depthToday(depthStore.get(), DAY)).toEqual({ Ocean: 16 });
    showDeeper("Ocean", DAY, 16, 8, 20);
    expect(depthToday(depthStore.get(), DAY).Ocean).toBe(20);
  });

  it("starts every tab from the top on a new day", () => {
    showDeeper("Ocean", DAY, 8, 8, 100);
    expect(depthToday(depthStore.get(), "2026-11-24")).toEqual({});
    showDeeper("Forest", "2026-11-24", 8, 8, 100);
    expect(depthStore.get()).toEqual({ day: "2026-11-24", tabs: { Forest: 16 } });
  });

  it("counts All picks for every collection", () => {
    showDeeper(ALL_PICKS, DAY, 8, 4, 100);
    showDeeper("Ocean", DAY, 8, 8, 100);
    const tabs = depthToday(depthStore.get(), DAY);
    expect([depthOf(tabs, "Ocean"), depthOf(tabs, "Forest")]).toEqual([16, 12]);
  });
});
