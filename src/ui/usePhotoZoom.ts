import { useEffect, useState, type PointerEvent, type RefObject } from "react";
import {
  isZoomed,
  MAX_SCALE,
  NO_ZOOM,
  pan,
  pinch,
  settle,
  TAP_SCALE,
  toTransform,
  zoomTo,
  type Frame,
  type Point,
  type Zoom,
} from "./zoomMath";

/** Two taps this close in time (ms) and space (px) are a double tap. */
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 30;
/** A finger moves this far before a pan counts as one rather than a tap. */
const SLOP = 8;
/** How far a released pan coasts, in ms of its speed at release. */
const COAST = 200;

type Gesture =
  | { kind: "pinch"; ids: [number, number]; from: Zoom; m0: Point; d0: number }
  | { kind: "pan"; id: number; from: Zoom; p0: Point; moved: boolean; last: Point; t: number; v: Point };

/** Safari's own pinch event, which isn't in the DOM types. */
interface GestureEvent extends UIEvent {
  scale: number;
  clientX: number;
  clientY: number;
}

export interface PhotoZoom {
  /** Returns true when zoom takes the pointer, so the photo's own swipe and pull leave it be. */
  down(e: PointerEvent): boolean;
  /** Returns true when the move zoomed or panned the photo. */
  move(e: PointerEvent): boolean;
  /** Return true when the pointer was zoom's. */
  up(e: PointerEvent): boolean;
  cancel(e: PointerEvent): boolean;
  /** A tap on the photo that nothing else used; a second one soon after zooms in or out. */
  tap(e: PointerEvent): void;
  zoomed(): boolean;
  /** Back to the whole photo, gliding there. */
  reset(): void;
}

/**
 * Pinch, double-tap and pan zoom for the full-screen photo, as in Photos. Only the picture zooms,
 * never the page. While zoomed the box carries the class "zoomed", and "dragging" while a finger
 * moves it; the photo's other controls hide and its swipe and pull-down step aside. `resetKey`
 * changing (another card, or the photo closing) starts unzoomed.
 */
export function usePhotoZoom(
  box: RefObject<HTMLElement | null>,
  photo: RefObject<HTMLElement | null>,
  resetKey: unknown,
): PhotoZoom {
  const [zoomer] = useState(() => new Zoomer(box, photo));
  useEffect(() => {
    zoomer.forget();
    return zoomer.listen();
  }, [zoomer, resetKey]);
  return zoomer;
}

class Zoomer implements PhotoZoom {
  private zoom: Zoom = NO_ZOOM;
  private frame: Frame | null = null;
  private readonly pointers = new Map<number, Point>();
  private gesture: Gesture | null = null;
  private lastTap: { t: number; p: Point } | null = null;

  constructor(
    private readonly box: RefObject<HTMLElement | null>,
    private readonly photo: RefObject<HTMLElement | null>,
  ) {}

  down = (e: PointerEvent): boolean => {
    const p = this.local(e.clientX, e.clientY);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2) {
      if (!this.frameNow()) return false;
      this.startPinch();
      for (const id of this.pointers.keys()) capture(e.currentTarget, id);
      return true;
    }
    if (this.pointers.size > 2) return true;
    if (!isZoomed(this.zoom)) return false;
    this.startPan(e.pointerId, p);
    return true;
  };

  move = (e: PointerEvent): boolean => {
    if (!this.pointers.has(e.pointerId)) return false;
    const p = this.local(e.clientX, e.clientY);
    this.pointers.set(e.pointerId, p);
    const g = this.gesture;
    const f = this.frameNow();
    if (!g || !f) return false;
    if (g.kind === "pinch") {
      const a = this.pointers.get(g.ids[0]);
      const b = this.pointers.get(g.ids[1]);
      if (!a || !b) return false;
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.show(pinch(f, g.from, g.m0, g.d0, m, Math.hypot(a.x - b.x, a.y - b.y)), true);
      return true;
    }
    if (g.id !== e.pointerId) return false;
    if (!g.moved) {
      if (Math.hypot(p.x - g.p0.x, p.y - g.p0.y) < SLOP) return false;
      g.moved = true;
      capture(e.currentTarget, e.pointerId);
    }
    const now = performance.now();
    const dt = now - g.t;
    if (dt > 0)
      g.v = {
        x: g.v.x * 0.4 + ((p.x - g.last.x) / dt) * 0.6,
        y: g.v.y * 0.4 + ((p.y - g.last.y) / dt) * 0.6,
      };
    g.last = p;
    g.t = now;
    this.show(pan(f, g.from, p.x - g.p0.x, p.y - g.p0.y), true);
    return true;
  };

  up = (e: PointerEvent): boolean => {
    const g = this.gesture;
    if (!this.pointers.delete(e.pointerId) || !g) return false;
    if (g.kind === "pinch") {
      if (!g.ids.includes(e.pointerId)) return true;
      this.gesture = null;
      this.rest(this.zoom);
      // A finger left on the glass carries on as a pan.
      const [left] = [...this.pointers.entries()];
      if (left && isZoomed(this.zoom)) this.startPan(left[0], left[1]);
      return true;
    }
    if (g.id !== e.pointerId) return true;
    this.gesture = null;
    if (!g.moved) {
      this.tap(e);
      return true;
    }
    // A flick coasts on a little; a finger held still before lifting doesn't.
    const v = performance.now() - g.t > 80 ? { x: 0, y: 0 } : g.v;
    this.rest({ ...this.zoom, x: this.zoom.x + v.x * COAST, y: this.zoom.y + v.y * COAST });
    return true;
  };

  cancel = (e: PointerEvent): boolean => {
    const g = this.gesture;
    if (!this.pointers.delete(e.pointerId) || !g) return false;
    const mine = g.kind === "pinch" ? g.ids.includes(e.pointerId) : g.id === e.pointerId;
    if (mine) {
      this.gesture = null;
      this.rest(this.zoom);
    }
    return true;
  };

  tap = (e: PointerEvent): void => {
    if (!(e.target instanceof Node) || !this.photo.current?.contains(e.target)) return;
    const p = this.local(e.clientX, e.clientY);
    const prev = this.lastTap;
    const now = performance.now();
    if (!prev || now - prev.t > DOUBLE_TAP_MS || Math.hypot(p.x - prev.p.x, p.y - prev.p.y) > DOUBLE_TAP_PX) {
      this.lastTap = { t: now, p };
      return;
    }
    this.lastTap = null;
    const f = this.frameNow();
    if (f) this.show(zoomTo(f, this.zoom, p, isZoomed(this.zoom) ? 1 : TAP_SCALE), false);
  };

  zoomed = (): boolean => isZoomed(this.zoom);

  reset = (): void => {
    this.gesture = null;
    this.show(NO_ZOOM, false);
  };

  /** Starts over unzoomed, for another card or a fresh viewing. */
  forget(): void {
    this.zoom = NO_ZOOM;
    this.frame = null;
    this.gesture = null;
    this.pointers.clear();
    this.lastTap = null;
    this.box.current?.classList.remove("zoomed", "dragging");
    if (this.photo.current) this.photo.current.style.transform = "";
  }

  /** Trackpads and wheels, and keeping the browser's own pinch from zooming the page. */
  listen(): (() => void) | undefined {
    const el = this.box.current;
    if (!el) return undefined;
    let idle = 0;
    // Wheel steps arrive in a stream, so the photo follows them without easing until they stop.
    const live = (z: Zoom) => {
      this.show(z, true);
      clearTimeout(idle);
      idle = window.setTimeout(() => this.rest(this.zoom), 120);
    };
    const onWheel = (e: WheelEvent) => {
      const f = this.frameNow();
      if (!f) return;
      if (e.ctrlKey) {
        // A trackpad pinch in Chrome and Firefox comes as a wheel with Ctrl held.
        e.preventDefault();
        const s = Math.min(Math.max(this.zoom.s * Math.exp(-e.deltaY * 0.01), 1), MAX_SCALE);
        live(zoomTo(f, this.zoom, this.local(e.clientX, e.clientY), s));
      } else if (isZoomed(this.zoom)) {
        e.preventDefault();
        live(settle(f, { ...this.zoom, x: this.zoom.x - e.deltaX, y: this.zoom.y - e.deltaY }));
      }
    };
    // Safari pinches with gesture events. On a touch screen the pointers drive the pinch instead.
    let from: Zoom = NO_ZOOM;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      from = this.zoom;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const f = this.frameNow();
      if (this.pointers.size > 0 || !f) return;
      const g = e as GestureEvent;
      const s = Math.min(Math.max(from.s * g.scale, 1), MAX_SCALE);
      live(zoomTo(f, this.zoom, this.local(g.clientX, g.clientY), s));
    };
    const prevent = (e: Event) => e.preventDefault();
    // A new window size moves the picture, so the zoom starts over.
    const onResize = () => this.reset();
    // The picture grows when the big image replaces the small one: measure it again, and keep a
    // zoom that's under way inside the new edges.
    const img = this.photo.current;
    const resized =
      img && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            this.frame = null;
            if (isZoomed(this.zoom) && !this.gesture) this.rest(this.zoom);
          })
        : null;
    if (img) resized?.observe(img);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGestureStart);
    el.addEventListener("gesturechange", onGestureChange);
    el.addEventListener("gestureend", prevent);
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(idle);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
      el.removeEventListener("gestureend", prevent);
      window.removeEventListener("resize", onResize);
      resized?.disconnect();
    };
  }

  /** Where the unzoomed picture sits in the box, from its layout so a transform doesn't skew it. */
  private frameNow(): Frame | null {
    if (this.frame) return this.frame;
    const el = this.box.current;
    const img = this.photo.current;
    if (!el || !img) return null;
    this.frame = {
      cx: img.offsetLeft + img.offsetWidth / 2,
      cy: img.offsetTop + img.offsetHeight / 2,
      w: img.offsetWidth,
      h: img.offsetHeight,
      vw: el.clientWidth,
      vh: el.clientHeight,
    };
    return this.frame;
  }

  /** Screen point to the box's own coordinates, which the picture's layout uses. */
  private local(x: number, y: number): Point {
    const r = this.box.current?.getBoundingClientRect();
    return { x: x - (r?.left ?? 0), y: y - (r?.top ?? 0) };
  }

  /** Shows a zoom: `live` while a finger holds it (no easing), otherwise it glides there. */
  private show(z: Zoom, live: boolean): void {
    this.zoom = z;
    const img = this.photo.current;
    if (img) img.style.transform = toTransform(z);
    const el = this.box.current;
    el?.classList.toggle("dragging", live);
    el?.classList.toggle("zoomed", isZoomed(z) || this.gesture?.kind === "pinch");
    // Unzoomed, the next zoom measures afresh, in case the picture's size changed (the big image).
    if (!live && !isZoomed(z)) this.frame = null;
  }

  private rest(z: Zoom): void {
    const f = this.frameNow();
    this.show(f ? settle(f, z) : NO_ZOOM, false);
  }

  private startPinch(): void {
    const [a, b] = [...this.pointers.entries()];
    if (!a || !b) return;
    this.gesture = {
      kind: "pinch",
      ids: [a[0], b[0]],
      from: this.zoom,
      m0: { x: (a[1].x + b[1].x) / 2, y: (a[1].y + b[1].y) / 2 },
      d0: Math.hypot(a[1].x - b[1].x, a[1].y - b[1].y),
    };
  }

  private startPan(id: number, p: Point): void {
    this.gesture = {
      kind: "pan",
      id,
      from: this.zoom,
      p0: p,
      moved: false,
      last: p,
      t: performance.now(),
      v: { x: 0, y: 0 },
    };
  }
}

function capture(target: EventTarget, id: number) {
  try {
    (target as Element).setPointerCapture(id);
  } catch {
    // The pointer already lifted.
  }
}
