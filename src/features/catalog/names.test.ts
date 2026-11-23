import { describe, expect, it } from "vitest";
import { mergeNames, nameKey, sameName, tidyRarity } from "./names";

describe("names", () => {
  it("compares names with case, spaces and punctuation set aside", () => {
    expect(sameName("Illustration rare", "Illustration Rare")).toBe(true);
    expect(sameName("aky CG Works", "akyCG Works")).toBe(true);
    expect(sameName("Rare Holo", "Holo Rare")).toBe(false);
    expect(nameKey("Ultra-Rare Common")).toBe("ultrararecommon");
    expect(sameName("★", "◆")).toBe(false);
    expect(sameName("★", "")).toBe(false);
  });
  it("title-cases a rarity and keeps capitals already there", () => {
    expect(tidyRarity("Illustration rare")).toBe("Illustration Rare");
    expect(tidyRarity(" special  illustration rare ")).toBe("Special Illustration Rare");
    expect(tidyRarity("ACE SPEC Rare")).toBe("ACE SPEC Rare");
    expect(tidyRarity("Rare Holo LV.X")).toBe("Rare Holo LV.X");
    expect(tidyRarity("ultra-rare common")).toBe("Ultra-Rare Common");
    expect(tidyRarity("Shiny rare V or VMAX")).toBe("Shiny Rare V or VMAX");
    expect(tidyRarity("one of a kind")).toBe("One of a Kind");
  });
  it("keeps the most used spelling, then the one that reads best", () => {
    expect(mergeNames(["MikiTanaka", "Miki Tanaka"]).names).toEqual(["Miki Tanaka"]);
    expect(mergeNames(["inose yukie", "Inose yukie"], [5, 1])).toEqual({
      names: ["inose yukie"],
      index: [0, 0],
    });
    expect(mergeNames(["b", "a", "B"])).toEqual({ names: ["B", "a"], index: [0, 1, 0] });
  });
});
