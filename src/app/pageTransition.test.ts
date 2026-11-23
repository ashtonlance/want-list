import type { ParsedLocation } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import { transitionTypes } from "./pageTransition";

vi.mock("~/lib/motion", () => ({ canTransition: () => true, viewTransitionsSupported: true }));

const at = (pathname: string, search: Record<string, unknown> = {}) =>
  ({ pathname, search }) as unknown as ParsedLocation;

const types = (from: ParsedLocation | undefined, to: ParsedLocation) =>
  transitionTypes({ fromLocation: from, toLocation: to, pathChanged: from?.pathname !== to.pathname });

describe("transitionTypes", () => {
  it("slides screens the way the tab bar reads", () => {
    expect(types(at("/"), at("/explore"))).toEqual(["forward"]);
    expect(types(at("/binders"), at("/explore/picks"))).toEqual(["back"]);
    expect(types(at("/explore"), at("/explore/picks"))).toEqual(["forward", "within"]);
    expect(types(at("/binders/scan"), at("/binders"))).toEqual(["back", "within"]);
  });

  it("slides a sheet away when it closes, but leaves opening and filters alone", () => {
    expect(types(at("/", { card: "a" }), at("/"))).toEqual(["sheet-close"]);
    expect(types(at("/binders", { sheet: "new" }), at("/binders"))).toEqual(["sheet-close"]);
    expect(types(at("/"), at("/", { card: "a" }))).toBe(false);
    expect(types(at("/explore", { look: "any" }), at("/explore", { look: "fullart" }))).toBe(false);
    expect(types(at("/", { card: "a" }), at("/", { card: "b" }))).toBe(false);
  });

  it("leaves a docked details pane to its own slide on a desktop", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q === "(min-width: 1024px)" }));
    try {
      expect(types(at("/", { card: "a" }), at("/"))).toBe(false);
      expect(types(at("/binders", { sheet: "new" }), at("/binders"))).toEqual(["sheet-close"]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does nothing on the first load", () => {
    expect(types(undefined, at("/"))).toBe(false);
  });
});
