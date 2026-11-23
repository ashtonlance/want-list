import { describe, expect, it } from "vitest";
import { parseMoney } from "./format";

describe("parseMoney", () => {
  it("reads dollars, thousands separators and decimal commas", () => {
    expect(parseMoney("$12.50")).toBe(12.5);
    expect(parseMoney(" 1,250 ")).toBe(1250);
    expect(parseMoney("1,250.99")).toBe(1250.99);
    expect(parseMoney("12,50")).toBe(12.5);
    expect(parseMoney(".99")).toBe(0.99);
  });
  it("rejects anything else", () => {
    for (const v of ["", "0", "abc", "12,5000", "1.2.3", "-4"]) expect(parseMoney(v)).toBeNull();
  });
});
