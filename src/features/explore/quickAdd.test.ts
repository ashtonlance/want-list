import { describe, expect, it } from "vitest";
import { quickAddTarget } from "./quickAdd";

describe("quickAddTarget", () => {
  it("keeps a collection that still exists", () => {
    expect(quickAddTarget("Ocean", ["Ocean", "Eeveelutions"], true)).toBe("Ocean");
  });
  it("drops one that was deleted or renamed", () => {
    expect(quickAddTarget("Ocean", ["Sea"], true)).toBe("");
  });
  it("keeps the saved choice until the collections have loaded", () => {
    expect(quickAddTarget("Ocean", [], false)).toBe("Ocean");
  });
  it("keeps no collection as none", () => {
    expect(quickAddTarget("", ["Ocean"], true)).toBe("");
  });
});
