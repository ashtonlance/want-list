import { defaultParseSearch } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Saved choices are read when the stores are made, so each case loads the module fresh. */
async function reopenAt(saved: Record<string, string>): Promise<{ path: string; search: unknown }> {
  localStorage.clear();
  for (const [k, v] of Object.entries(saved)) localStorage.setItem(k, v);
  history.replaceState(null, "", "/");
  vi.resetModules();
  const { restoreLastSection } = await import("./sections");
  restoreLastSection("/");
  return { path: location.pathname, search: defaultParseSearch(location.search) };
}

describe("restoreLastSection", () => {
  beforeEach(() => localStorage.clear());

  it("stays on My list when that was the last tab", async () => {
    expect(await reopenAt({ "wl-mode": "list" })).toEqual({ path: "/", search: {} });
  });
  it("reopens Explore with the search it last showed, keeping a number as text", async () => {
    const saved = { "wl-mode": "explore", "wl-extab": "live", "wl-extab-search": '{"live":{"q":"151"}}' };
    expect(await reopenAt(saved)).toEqual({ path: "/explore", search: { q: "151" } });
  });
  it("reopens For you on the collection it last showed", async () => {
    const saved = {
      "wl-mode": "explore",
      "wl-extab": "picks",
      "wl-extab-search": '{"picks":{"coll":"Ocean"}}',
    };
    expect(await reopenAt(saved)).toEqual({ path: "/explore/picks", search: { coll: "Ocean" } });
  });
  it("ignores a damaged saved search", async () => {
    const saved = { "wl-mode": "explore", "wl-extab": "live", "wl-extab-search": "{oops" };
    expect(await reopenAt(saved)).toEqual({ path: "/explore", search: {} });
  });
});
