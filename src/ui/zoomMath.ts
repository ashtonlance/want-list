/**
 * The geometry behind zooming the full-screen photo, kept apart from the DOM so it can be tested.
 * A zoom is a scale about the picture's centre plus a shift, both in screen pixels.
 */

export interface Zoom {
  s: number;
  x: number;
  y: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Where the unzoomed picture sits: its centre and size, and the size of the view it sits in. */
export interface Frame {
  cx: number;
  cy: number;
  w: number;
  h: number;
  vw: number;
  vh: number;
}

export const NO_ZOOM: Zoom = { s: 1, x: 0, y: 0 };
/** The furthest the photo zooms in. */
export const MAX_SCALE = 4;
/** Where a double tap zooms to. */
export const TAP_SCALE = 2.5;

export const isZoomed = (z: Zoom): boolean => z.s > 1.001;

/** Drawn whenever it moves the picture at all, so a pinch below 1 shows its give. */
export const toTransform = (z: Zoom): string =>
  z.s === 1 && z.x === 0 && z.y === 0
    ? ""
    : `translate(${String(z.x)}px, ${String(z.y)}px) scale(${String(z.s)})`;

/** Past a limit, movement gives less and less, like the edge of a scroll view on iPhone. */
export function rubber(v: number, lo: number, hi: number, dim: number): number {
  const give = (over: number) => (1 - 1 / ((over * 0.55) / dim + 1)) * dim;
  if (v < lo) return lo - give(lo - v);
  if (v > hi) return hi + give(v - hi);
  return v;
}

/** Scale that resists below 1 and past the most zoom, rather than stopping dead. */
export function rubberScale(s: number): number {
  if (s < 1) return s ** 0.35;
  if (s > MAX_SCALE) return MAX_SCALE * (s / MAX_SCALE) ** 0.35;
  return s;
}

/**
 * How far the picture may shift at a scale. Bigger than the view, it may pan until an edge meets the
 * view's edge; smaller, it may move only as far as it stays inside the view.
 */
export function shiftRange(f: Frame, s: number): { x: [number, number]; y: [number, number] } {
  const axis = (c: number, size: number, view: number): [number, number] => {
    const a = view - c - (size * s) / 2;
    const b = (size * s) / 2 - c;
    return [Math.min(a, b), Math.max(a, b)];
  };
  return { x: axis(f.cx, f.w, f.vw), y: axis(f.cy, f.h, f.vh) };
}

const clamp = (v: number, [lo, hi]: [number, number]) => Math.min(Math.max(v, lo), hi);

/** The point of the unzoomed picture, relative to its centre, that sits under a screen point. */
const pictureAt = (f: Frame, z: Zoom, p: Point): Point => ({
  x: (p.x - f.cx - z.x) / z.s,
  y: (p.y - f.cy - z.y) / z.s,
});

/** Scales to `s` keeping the picture under `p` where it is, as a pinch or a double tap does. */
function scaleAbout(f: Frame, z: Zoom, p: Point, s: number, under: Point = pictureAt(f, z, p)): Zoom {
  return { s, x: p.x - f.cx - s * under.x, y: p.y - f.cy - s * under.y };
}

/** Where the picture comes to rest: scale within limits, edges back inside the view. */
export function settle(f: Frame, z: Zoom): Zoom {
  const s = Math.min(Math.max(z.s, 1), MAX_SCALE);
  if (!isZoomed({ ...z, s })) return NO_ZOOM;
  const range = shiftRange(f, s);
  return { s, x: clamp(z.x, range.x), y: clamp(z.y, range.y) };
}

/** A shift that gives way past the edges while a finger holds it there. */
function loose(f: Frame, z: Zoom): Zoom {
  const range = shiftRange(f, z.s);
  return { s: z.s, x: rubber(z.x, ...range.x, f.vw), y: rubber(z.y, ...range.y, f.vh) };
}

/**
 * A pinch under way. It started at `from` with the fingers' midpoint at `m0` and `d0` apart; the
 * picture point that was under the midpoint stays under it as the fingers move and spread.
 */
export function pinch(f: Frame, from: Zoom, m0: Point, d0: number, m: Point, d: number): Zoom {
  const s = rubberScale((from.s * d) / Math.max(d0, 1));
  return loose(f, scaleAbout(f, from, m, s, pictureAt(f, from, m0)));
}

/** One finger panning a zoomed picture. */
export function pan(f: Frame, from: Zoom, dx: number, dy: number): Zoom {
  return loose(f, { s: from.s, x: from.x + dx, y: from.y + dy });
}

/** Zooms to `s` about a point and settles, for a double tap or a scroll-wheel pinch. */
export function zoomTo(f: Frame, z: Zoom, p: Point, s: number): Zoom {
  return settle(f, scaleAbout(f, z, p, s));
}
