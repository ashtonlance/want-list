/* The arithmetic behind the single-card camera scan: which part of the camera's picture sits under the
   card guide on screen, whether a found outline is card shaped, and what to offer after a read. No DOM,
   so it's easy to test. */
import type { CatalogCard } from "~/features/catalog/catalog";
import type { Quad } from "./engine/image";
import type { Match } from "./engine/match";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

/** A card's width over its height (63 × 88 mm). */
export const CARD_RATIO = 63 / 88;

/**
 * Where `rect` (in the video element's CSS pixels) falls in the camera's own picture, when the picture is
 * shown with `object-fit: cover`: scaled to fill the element and cropped evenly on the overflowing sides.
 * Clamped to the picture.
 */
export function coverCrop(video: Size, el: Size, rect: Rect): Rect {
  const s = Math.max(el.w / video.w, el.h / video.h);
  const ox = (el.w - video.w * s) / 2;
  const oy = (el.h - video.h * s) / 2;
  const x0 = Math.max(0, (rect.x - ox) / s);
  const y0 = Math.max(0, (rect.y - oy) / s);
  const x1 = Math.min(video.w, (rect.x + rect.w - ox) / s);
  const y1 = Math.min(video.h, (rect.y + rect.h - oy) / s);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/** `r` grown by `k` of its size on every side, kept inside `bounds`. */
export function grow(r: Rect, k: number, bounds: Size): Rect {
  const x0 = Math.max(0, r.x - r.w * k);
  const y0 = Math.max(0, r.y - r.h * k);
  const x1 = Math.min(bounds.w, r.x + r.w * (1 + k));
  const y1 = Math.min(bounds.h, r.y + r.h * (1 + k));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** The largest card-shaped box filling `fill` of a picture, centred: where a card in a photo most likely is. */
export function centreCard(size: Size, fill = 0.8): Rect {
  const h = Math.min(size.h, size.w / CARD_RATIO) * fill;
  const w = h * CARD_RATIO;
  return { x: (size.w - w) / 2, y: (size.h - h) / 2, w, h };
}

/**
 * True when an outline found in a w × h crop (corners as 0..1 fractions) is a card filling most of it:
 * at least `minArea` of the crop and roughly card shaped. Anything else (the artwork box, a hand, the
 * table) is ignored and the guide's own crop is used instead.
 */
export function cardOutline(q: Quad, w: number, h: number, minArea = 0.4): boolean {
  const px = q.map(([x, y]) => [x * w, y * h] as const);
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const [a, b] = px[i] ?? [0, 0];
    const [c, d] = px[(i + 1) % 4] ?? [0, 0];
    area += a * d - c * b;
  }
  area = Math.abs(area) / 2;
  if (area < minArea * w * h) return false;
  const len = (i: number, j: number) => {
    const [a, b] = px[i] ?? [0, 0];
    const [c, d] = px[j] ?? [0, 0];
    return Math.hypot(c - a, d - b);
  };
  const wide = (len(0, 1) + len(3, 2)) / 2;
  const tall = (len(0, 3) + len(1, 2)) / 2;
  const ratio = tall > 0 ? wide / tall : 0;
  return ratio > CARD_RATIO * 0.85 && ratio < CARD_RATIO * 1.18;
}

export interface ScanPicks {
  /** Likeliest printings first, at most `max`. */
  rows: CatalogCard[];
  /** What to tell the person about them. */
  note: string;
}

/** The printings to offer after a shot, and a line saying how sure the read was. */
export function scanPicks(m: Match, byPid: ReadonlyMap<number, CatalogCard>, max = 6): ScanPicks {
  const rows: CatalogCard[] = [];
  // "none" can still carry guesses, but ones the binder scan also treats as no match.
  if (m.conf !== "empty" && m.conf !== "none")
    for (const e of m.alts) {
      const c = byPid.get(e.pid);
      if (c && !rows.includes(c)) rows.push(c);
      if (rows.length >= max) break;
    }
  const note = !rows.length
    ? m.conf === "empty"
      ? "No card in the frame. Line one up inside the outline."
      : "Couldn't read that card. Try again in brighter light, or search by name."
    : m.conf === "high"
      ? "Found it. Tap it to add."
      : "Not sure which printing. Tap the right one to add.";
  return { rows, note };
}
