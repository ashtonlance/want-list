import { afterEach, describe, expect, it, vi } from "vitest";
import { WriteError, writeFailure } from "./docs";

describe("writeFailure", () => {
  afterEach(() => vi.restoreAllMocks());

  it("says offline for a write that never reached the database", () => {
    expect(writeFailure(new WriteError("offline", "Failed to fetch"), "Couldn't save.")).toMatch(/offline/);
  });

  it("keeps the given words for other failures while online", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    expect(writeFailure(new WriteError("failed", "boom"), "Couldn't save.")).toBe("Couldn't save.");
    expect(writeFailure(undefined, "Saved 2 of 3.")).toBe("Saved 2 of 3.");
  });

  it("says offline when the phone has no connection", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(writeFailure(undefined, "Saved 2 of 3.")).toMatch(/offline/);
  });
});
