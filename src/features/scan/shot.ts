/* Turning one camera frame or photo into a straightened card the scan engine can read. */
import { CH, CW, canvas, context, findPage, rectify, release, type Point } from "./engine/image";
import { cardOutline, grow, type Rect } from "./single";

/** The crop is drawn no larger than this on its long side: plenty for the card's text, quick to straighten. */
const MAX_SIDE = 1400;

/**
 * Cuts the card out of `src`. `guide` is where the card should be, in `src` pixels. A little around it
 * is kept so the card's own edges can be found and straightened; when they can't, the guide is used as is.
 * The caller releases the returned canvas.
 */
export function cardFrom(
  src: CanvasImageSource,
  size: { w: number; h: number },
  guide: Rect,
): HTMLCanvasElement {
  const area = grow(guide, 0.12, size);
  const k = Math.min(1, MAX_SIDE / Math.max(area.w, area.h));
  const crop = canvas(Math.max(1, Math.round(area.w * k)), Math.max(1, Math.round(area.h * k)));
  context(crop).drawImage(src, area.x, area.y, area.w, area.h, 0, 0, crop.width, crop.height);

  const card = outlined(crop) ?? guided(crop, guide, area, k);
  release(crop);
  return card;
}

/** The card straightened from its own outline in the crop, when one is clearly there. */
function outlined(crop: HTMLCanvasElement): HTMLCanvasElement | null {
  const q = findPage(crop);
  if (!q || !cardOutline(q, crop.width, crop.height)) return null;
  const { width: w, height: h } = crop;
  const at = ([x, y]: Point): Point => [x * w, y * h];
  const [tl, tr, br, bl] = q;
  return rectify(crop, [at(tl), at(tr), at(br), at(bl)], 1, 1)[0] ?? null;
}

/** Exactly the guide, which the person lined the card up with. */
function guided(crop: HTMLCanvasElement, guide: Rect, area: Rect, k: number): HTMLCanvasElement {
  const card = canvas(CW, CH);
  context(card).drawImage(
    crop,
    (guide.x - area.x) * k,
    (guide.y - area.y) * k,
    guide.w * k,
    guide.h * k,
    0,
    0,
    CW,
    CH,
  );
  return card;
}
