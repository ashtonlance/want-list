import { describe, expect, it } from "vitest";
import { inEra } from "./era";

describe("inEra", () => {
  const now = "2026-11-22";
  it("matches decades and the current sets", () => {
    expect(inEra("1999-01-09", "1990s", now)).toBe(true);
    expect(inEra("2009-05-01", "2010s", now)).toBe(false);
    expect(inEra("2025-09-26", "now", now)).toBe(true);
    expect(inEra("2024-11-08", "now", now)).toBe(false);
  });
  it("counts only later dates as not out yet, and an unknown date as no year", () => {
    expect(inEra("2027-02-06", "soon", now)).toBe(true);
    expect(inEra(now, "soon", now)).toBe(false);
    expect(inEra("", "2020s", now)).toBe(false);
    expect(inEra("", "any", now)).toBe(true);
  });
});
