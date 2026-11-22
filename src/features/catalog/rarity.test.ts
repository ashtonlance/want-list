import { describe, expect, it } from "vitest";
import { isFullArt } from "./rarity";

describe("isFullArt", () => {
  it.each([
    ["Special Illustration Rare", ""],
    ["Illustration rare", ""],
    ["Full Art Trainer", ""],
    ["Hyper Rare", ""],
    ["Character Super Rare", ""],
    ["Rare Holo", "TG06"],
  ])("counts %s %s", (rarity, number) => expect(isFullArt(rarity, number)).toBe(true));

  it("counts an Ultra Rare only when its name or number shows full art", () => {
    expect(isFullArt("Ultra Rare", "18")).toBe(false);
    expect(isFullArt("Ultra Rare", "18", { mainSize: 111 })).toBe(false);
    expect(isFullArt("Ultra Rare", "205", { mainSize: 193 })).toBe(true);
    expect(isFullArt("Ultra Rare", "140", { name: "Espeon GX (Full Art)", mainSize: 149 })).toBe(true);
  });

  it.each(["Common", "Holo Rare", "Double Rare", "Rare", "Ultra Rare", ""])("skips %s", (rarity) =>
    expect(isFullArt(rarity, "12")).toBe(false),
  );
});
