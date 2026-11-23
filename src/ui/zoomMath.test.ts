import { describe, expect, it } from "vitest";
import {
  MAX_SCALE,
  NO_ZOOM,
  pan,
  pinch,
  rubber,
  rubberScale,
  settle,
  shiftRange,
  toTransform,
  zoomTo,
  type Frame,
} from "./zoomMath";

// A 300 x 420 picture centred at (200, 300) in a 400 x 800 view.
const f: Frame = { cx: 200, cy: 300, w: 300, h: 420, vw: 400, vh: 800 };

describe("rubber", () => {
  it("leaves values inside the range alone", () => {
    expect(rubber(5, 0, 10, 100)).toBe(5);
  });
  it("gives less than the overshoot, and never past the view's size", () => {
    const over = rubber(60, 0, 10, 100) - 10;
    expect(over).toBeGreaterThan(0);
    expect(over).toBeLessThan(50);
    expect(rubber(1e9, 0, 10, 100)).toBeLessThan(110);
    expect(rubber(-30, 0, 10, 100)).toBeGreaterThan(-30);
  });
});

describe("rubberScale", () => {
  it("resists below 1 and past the most zoom", () => {
    expect(rubberScale(2)).toBe(2);
    expect(rubberScale(0.5)).toBeGreaterThan(0.5);
    expect(rubberScale(0.5)).toBeLessThan(1);
    expect(rubberScale(8)).toBeGreaterThan(MAX_SCALE);
    expect(rubberScale(8)).toBeLessThan(8);
  });
});

describe("shiftRange", () => {
  it("lets the unzoomed picture stay where it is", () => {
    const r = shiftRange(f, 1);
    expect(r.x[0]).toBeLessThanOrEqual(0);
    expect(r.x[1]).toBeGreaterThanOrEqual(0);
    expect(r.y[0]).toBeLessThanOrEqual(0);
    expect(r.y[1]).toBeGreaterThanOrEqual(0);
  });
  it("pans a zoomed picture until its edges meet the view's", () => {
    // At 2x the picture is 600 wide: its left edge may go from 0 to -200.
    expect(shiftRange(f, 2).x).toEqual([-100, 100]);
  });
});

describe("settle", () => {
  it("springs back to no zoom from below 1", () => {
    expect(settle(f, { s: 0.8, x: 30, y: -10 })).toEqual(NO_ZOOM);
  });
  it("caps the scale and pulls the edges back inside the view", () => {
    const z = settle(f, { s: 6, x: 5000, y: -5000 });
    expect(z.s).toBe(MAX_SCALE);
    const r = shiftRange(f, MAX_SCALE);
    expect(z.x).toBe(r.x[1]);
    expect(z.y).toBe(r.y[0]);
  });
});

describe("pinch", () => {
  it("keeps the point between the fingers under them", () => {
    const m0 = { x: 250, y: 200 };
    const z = pinch(f, NO_ZOOM, m0, 100, m0, 200);
    expect(z.s).toBe(2);
    // The picture point at m0 maps back to m0.
    expect(f.cx + z.x + 2 * (m0.x - f.cx)).toBeCloseTo(m0.x);
    expect(f.cy + z.y + 2 * (m0.y - f.cy)).toBeCloseTo(m0.y);
  });
  it("follows the fingers as they move together", () => {
    const z = pinch(f, { s: 2, x: 0, y: 0 }, { x: 200, y: 300 }, 100, { x: 220, y: 300 }, 100);
    expect(z.s).toBe(2);
    expect(z.x).toBeCloseTo(20);
  });
});

describe("pan", () => {
  it("moves freely inside the edges and resists past them", () => {
    const from = { s: 2, x: 0, y: 0 };
    expect(pan(f, from, 50, 0).x).toBe(50);
    expect(pan(f, from, 300, 0).x).toBeLessThan(300);
    expect(pan(f, from, 300, 0).x).toBeGreaterThan(100);
  });
});

describe("zoomTo", () => {
  it("zooms about the tapped point within the edges", () => {
    const z = zoomTo(f, NO_ZOOM, { x: 200, y: 300 }, 2.5);
    expect(z).toEqual({ s: 2.5, x: 0, y: 0 });
    const corner = zoomTo(f, NO_ZOOM, { x: 60, y: 100 }, 2.5);
    const r = shiftRange(f, 2.5);
    expect(corner.x).toBeLessThanOrEqual(r.x[1]);
    expect(corner.y).toBeLessThanOrEqual(r.y[1]);
  });
  it("goes back to no zoom at scale 1", () => {
    expect(zoomTo(f, { s: 2, x: 40, y: 40 }, { x: 0, y: 0 }, 1)).toEqual(NO_ZOOM);
  });
});

describe("toTransform", () => {
  it("is empty with no zoom, and drawn for any other", () => {
    expect(toTransform(NO_ZOOM)).toBe("");
    expect(toTransform({ s: 2, x: 1, y: -2 })).toBe("translate(1px, -2px) scale(2)");
    expect(toTransform({ s: 0.9, x: 0, y: 0 })).toBe("translate(0px, 0px) scale(0.9)");
  });
});
