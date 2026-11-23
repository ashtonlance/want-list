import { describe, expect, it } from "vitest";
import type { CatalogCard } from "~/features/catalog/catalog";
import type { Quad } from "./engine/image";
import type { Entry, Match } from "./engine/match";
import { CARD_RATIO, cardOutline, centreCard, coverCrop, grow, scanPicks } from "./single";

describe("coverCrop", () => {
  it("maps a guide on a portrait screen into a landscape camera picture", () => {
    // 1920 × 1080 shown in a 390 × 520 box: scaled by 520/1080, so 1/3 of the width overflows each side.
    const r = coverCrop({ w: 1920, h: 1080 }, { w: 390, h: 520 }, { x: 95, y: 60, w: 200, h: 280 });
    const s = 520 / 1080;
    const ox = (390 - 1920 * s) / 2;
    expect(r.x).toBeCloseTo((95 - ox) / s);
    expect(r.y).toBeCloseTo(60 / s);
    expect(r.w).toBeCloseTo(200 / s);
    expect(r.h).toBeCloseTo(280 / s);
  });

  it("is the identity when the element is the picture's own size", () => {
    expect(coverCrop({ w: 400, h: 300 }, { w: 400, h: 300 }, { x: 10, y: 20, w: 30, h: 40 })).toEqual({
      x: 10,
      y: 20,
      w: 30,
      h: 40,
    });
  });

  it("stays inside the picture", () => {
    const r = coverCrop({ w: 100, h: 100 }, { w: 100, h: 100 }, { x: -20, y: 90, w: 50, h: 50 });
    expect(r).toEqual({ x: 0, y: 90, w: 30, h: 10 });
  });
});

describe("grow", () => {
  it("adds a margin on every side, clamped to the bounds", () => {
    const r = grow({ x: 10, y: 10, w: 100, h: 100 }, 0.25, { w: 1000, h: 1000 });
    expect(r).toEqual({ x: 0, y: 0, w: 135, h: 135 });
  });
});

describe("centreCard", () => {
  it("fits a card-shaped box in the middle of a landscape photo", () => {
    const r = centreCard({ w: 1600, h: 1200 }, 0.8);
    expect(r.h).toBeCloseTo(960);
    expect(r.w / r.h).toBeCloseTo(CARD_RATIO);
    expect(r.x + r.w / 2).toBeCloseTo(800);
    expect(r.y + r.h / 2).toBeCloseTo(600);
  });

  it("is limited by the width of a narrow photo", () => {
    const r = centreCard({ w: 300, h: 1000 }, 1);
    expect(r.w).toBeCloseTo(300);
  });
});

describe("cardOutline", () => {
  const box = (x0: number, y0: number, x1: number, y1: number): Quad => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];

  it("accepts a card filling most of the crop", () => {
    // A 630 × 880 card in a 700 × 980 crop.
    expect(cardOutline(box(35 / 700, 50 / 980, 665 / 700, 930 / 980), 700, 980)).toBe(true);
  });

  it("rejects something too small", () => {
    expect(cardOutline(box(0.3, 0.3, 0.6, 0.6), 700, 980)).toBe(false);
  });

  it("rejects something that isn't card shaped", () => {
    expect(cardOutline(box(0, 0.2, 1, 0.8), 700, 980)).toBe(false);
  });
});

describe("scanPicks", () => {
  const card = (pid: number): CatalogCard => ({
    pid,
    name: "Umbreon ex",
    set: 0,
    number: "161",
    rarity: 0,
    market: 0,
    artist: -1,
  });
  const entry = (pid: number) => ({ pid }) as Entry;
  const byPid = new Map([1, 2, 3, 4].map((p) => [p, card(p)]));
  const match = (conf: Match["conf"], pids: number[]): Match => ({ conf, alts: pids.map(entry), hint: "" });

  it("offers the printings in order, skipping any the catalog doesn't have", () => {
    const r = scanPicks(match("high", [2, 9, 1, 3]), byPid, 2);
    expect(r.rows.map((c) => c.pid)).toEqual([2, 1]);
    expect(r.note).toBe("Found it. Tap it to add.");
  });

  it("asks the person to pick when the read wasn't sure", () => {
    expect(scanPicks(match("low", [1]), byPid).note).toBe(
      "Not sure which printing. Tap the right one to add.",
    );
  });

  it("says so when nothing was read", () => {
    expect(scanPicks(match("none", []), byPid)).toEqual({
      rows: [],
      note: "Couldn't read that card. Try again in brighter light, or search by name.",
    });
    expect(scanPicks(match("empty", [1]), byPid).rows).toEqual([]);
    expect(scanPicks(match("none", [1, 2]), byPid).rows).toEqual([]);
  });
});
