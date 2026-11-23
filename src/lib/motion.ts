import { useEffect, useRef, type RefObject } from "react";
import { flushSync } from "react-dom";
import { bigImage } from "./images";

/**
 * Motion for the whole app, in one place.
 *
 * Page changes, a card's picture flying into the photo view or a sheet, and cards gliding when one
 * leaves all use the View Transitions API. Where it isn't supported (or only partly), or the person
 * asked for reduced motion, the change simply happens, and CSS entrances still play where motion is on.
 * The look of each transition lives in styles/motion.css, keyed by the transition's type.
 */

/** Needs view transition types too, so CSS can tell a page change from a picture flying across. */
const SUPPORTED =
  typeof document !== "undefined" &&
  "startViewTransition" in document &&
  typeof CSS !== "undefined" &&
  CSS.supports("selector(:active-view-transition-type(a))");

const reducedQuery =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

/** Whether this browser can run the transitions here at all, motion settings aside. */
export const viewTransitionsSupported = SUPPORTED;

export const prefersReducedMotion = (): boolean => reducedQuery?.matches ?? false;

/** Whether a view transition can run right now. */
export const canTransition = (): boolean => SUPPORTED && !prefersReducedMotion();

/** The easing and lengths shared with CSS (styles/tokens.css), for animations started from code. */
export const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.2, 1)";
export const EASE_IN = "cubic-bezier(0.4, 0, 1, 1)";

let running = 0;

/**
 * True while one of the transitions started here is on screen. Something that mounts during one
 * (the photo view, a sheet) skips its own CSS entrance, since the transition already animates it.
 */
export const isTransitioning = (): boolean => running > 0;

function start(update: () => Promise<void>, types: string[]): ViewTransition {
  running += 1;
  const vt = document.startViewTransition({ update, types });
  // A skipped transition (say, two elements briefly sharing a name) still applies the change.
  vt.ready.catch(() => undefined);
  void vt.finished.catch(() => undefined).finally(() => (running -= 1));
  return vt;
}

const setName = (el: HTMLElement, name: string, cls?: string) => {
  el.style.setProperty("view-transition-name", name);
  if (cls) el.style.setProperty("view-transition-class", cls);
};
const clearName = (el: HTMLElement) => {
  el.style.removeProperty("view-transition-name");
  el.style.removeProperty("view-transition-class");
};

/** Resolves once `test` passes, or after `ms` regardless. Polls with timers, which run during a transition. */
function until(test: () => boolean, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const check = () => {
      if (test() || performance.now() - t0 > ms) resolve();
      else setTimeout(check, 16);
    };
    check();
  });
}

/** Waits for a picture to be ready to draw, briefly, so the transition doesn't capture an empty box. */
async function decoded(img: HTMLImageElement): Promise<void> {
  if (img.complete) return;
  await Promise.race([img.decode().catch(() => undefined), new Promise((r) => setTimeout(r, 200))]);
}

function onScreen(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return (
    r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth
  );
}

/**
 * The picture on screen showing `src` (small or large version), topmost first: a card sheet's picture
 * before the grid behind it. `within` narrows the search; `skip` leaves out one part of the page.
 */
export function findPicture(
  src: string,
  within?: Element | null,
  skip?: Element | null,
): HTMLImageElement | null {
  const want = bigImage(src);
  const imgs = (within ?? document).querySelectorAll("img");
  for (let i = imgs.length - 1; i >= 0; i -= 1) {
    const img = imgs[i];
    if (!img || skip?.contains(img)) continue;
    const s = img.getAttribute("src");
    if (s && bigImage(s) === want && onScreen(img)) return img;
  }
  return null;
}

/** The picture of the card tile anchored as `sr` (see lib/scroll.ts), if it's on screen. */
export function tilePicture(sr: string): HTMLImageElement | null {
  const img = document.querySelector<HTMLImageElement>(`[data-sr="${CSS.escape(sr)}"] .tile-img img`);
  return img && onScreen(img) ? img : null;
}

const MORPH = "card-art";

/** Where a card's picture lands in an open sheet: its picture box, there even while the card loads. */
export const sheetPicture = (): HTMLElement | null =>
  document.querySelector<HTMLElement>(".sheet .detail-img");

interface MorphOptions {
  /** The picture to fly from. Without one, `update` runs with no transition. */
  from: HTMLElement | null;
  /** The change: open the photo, a sheet, or close one. May navigate. */
  update: () => unknown;
  /** Finds the picture to fly to once the change is on screen. */
  to: () => HTMLElement | null;
  /** How long to wait for `to` (a sheet opened by navigating renders a moment later). */
  wait?: number;
}

/** Flies a card picture from one place to another while the rest of the screen cross-fades. */
export function morph({ from, update, to, wait = 300 }: MorphOptions): void {
  if (!from || !canTransition()) {
    void update();
    return;
  }
  let target: HTMLElement | null = null;
  setName(from, MORPH);
  const vt = start(async () => {
    clearName(from);
    await flushSync(update);
    await until(() => (target = to()) !== null, wait);
    if (!target) return;
    setName(target, MORPH);
    // A picture, or a frame holding one, is shown only once decoded, so it doesn't fly in blank.
    const pic = target instanceof HTMLImageElement ? target : target.querySelector("img");
    if (pic) await decoded(pic);
  }, ["morph"]);
  void vt.finished
    .catch(() => undefined)
    .finally(() => {
      clearName(from);
      if (target) clearName(target);
    });
}

/**
 * Closes a sheet that isn't kept in the address (a filter sheet) with the same slide down as one
 * that is (app/pageTransition.ts's "sheet-close").
 */
export function closeSheet(update: () => void): void {
  if (!canTransition()) {
    update();
    return;
  }
  start(() => {
    flushSync(update);
    return Promise.resolve();
  }, ["sheet-close"]);
}

/** Card tiles fully on screen between the top bar and the tab bar, at most a screenful. */
function tilesOnScreen(): HTMLElement[] {
  const top = document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0;
  const bottom = document.querySelector(".tabbar")?.getBoundingClientRect().top ?? innerHeight;
  const out: HTMLElement[] = [];
  for (const el of document.querySelectorAll<HTMLElement>("main [data-sr]")) {
    const r = el.getBoundingClientRect();
    if (r.top >= top && r.bottom <= bottom && r.width > 0) out.push(el);
    if (out.length >= 48) break;
  }
  return out;
}

/**
 * Runs `update` so the cards on screen glide to their new places and a removed one fades out.
 * `settled` says when the change has reached the screen (a write that updates the list a moment later).
 */
export function glide(update: () => unknown, settled: () => boolean = () => true): void {
  if (!canTransition()) {
    void update();
    return;
  }
  const tiles = tilesOnScreen();
  tiles.forEach((el, i) => setName(el, `glide-${String(i)}`, "glide"));
  const vt = start(async () => {
    flushSync(() => void update());
    await until(settled, 400);
  }, ["glide"]);
  void vt.finished.catch(() => undefined).finally(() => tiles.forEach(clearName));
}

/**
 * Fades a block in, rising a few pixels, each time `key` changes after the first render: a new
 * filter, sort or collection. The first render is left to the page transition.
 */
export function useEnterAnimation(ref: RefObject<HTMLElement | null>, key: unknown): void {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = ref.current;
    if (!el || prefersReducedMotion() || isTransitioning() || typeof el.animate !== "function") return;
    el.animate(
      [
        { opacity: 0, transform: "translateY(4px)" },
        { opacity: 1, transform: "none" },
      ],
      {
        duration: 200,
        easing: EASE_OUT,
      },
    );
  }, [ref, key]);
}
