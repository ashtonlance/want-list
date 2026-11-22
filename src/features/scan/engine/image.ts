/* Canvas work for scanning: turning photos, finding and straightening the page, and the small
   pixel grids used to compare a pocket with each printing's picture. */

/** One straightened pocket, card shaped (63 × 88). */
export const CW = 600;
export const CH = 838;

export type Point = readonly [number, number];
/** Corners in the order top left, top right, bottom right, bottom left. */
export type Quad = readonly [Point, Point, Point, Point];
/** The eight coefficients of a projective map (the ninth is 1). */
export type Homography = readonly [number, number, number, number, number, number, number, number];
/** A picture the canvas can draw. */
export type Drawable = HTMLCanvasElement | HTMLImageElement;

export function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function context(
  c: HTMLCanvasElement,
  settings?: CanvasRenderingContext2DSettings,
): CanvasRenderingContext2D {
  const ctx = c.getContext("2d", settings);
  if (!ctx) throw new Error("This browser can't draw on a canvas");
  return ctx;
}

const sizeOf = (src: Drawable): Point =>
  src instanceof HTMLImageElement ? [src.naturalWidth, src.naturalHeight] : [src.width, src.height];

/** Frees a canvas's pixels now rather than whenever it's collected; phones run out of canvas memory. */
export function release(c: HTMLCanvasElement): void {
  c.width = 0;
  c.height = 0;
}

export function fileToImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    // A decoded image stays drawable after its URL is revoked, so nothing holds the file afterwards.
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}

/** The photo turned by `rot` quarter turns, long side up to `max` px. Browsers apply EXIF rotation when drawing. */
export function turned(img: HTMLImageElement, rot: number, max: number): HTMLCanvasElement {
  const [w0, h0] = sizeOf(img);
  const k = Math.min(1, max / Math.max(w0, h0));
  const w = Math.round(w0 * k);
  const h = Math.round(h0 * k);
  const side = rot % 2 === 1;
  const c = canvas(side ? h : w, side ? w : h);
  const ctx = context(c);
  ctx.imageSmoothingQuality = "high";
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((rot * Math.PI) / 2);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return c;
}

/** Homography that maps the unit square (0,0) (1,0) (1,1) (0,1) onto a quad. */
export function squareToQuad(q: Quad): Homography {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  let g = 0;
  let h = 0;
  if (sx || sy) {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / den;
    h = (dx1 * sy - sx * dy1) / den;
  }
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h];
}

/** Where the point (u, v) of the unit square lands under `m`. */
export function project(m: Homography, u: number, v: number): Point {
  const [a, b, c, d, e, f, g, h] = m;
  const den = g * u + h * v + 1;
  return [(a * u + b * v + c) / den, (d * u + e * v + f) / den];
}

/** Straightens the page inside `corners` (in source pixels) into a cols × rows grid of pocket canvases, row by row. */
export function rectify(
  src: HTMLCanvasElement,
  corners: Quad,
  cols: number,
  rows: number,
): HTMLCanvasElement[] {
  const W = cols * CW;
  const H = rows * CH;
  const sw = src.width;
  const sh = src.height;
  const sd = context(src).getImageData(0, 0, sw, sh).data;
  const px = (i: number) => sd[i] ?? 0;
  const out = canvas(W, H);
  const octx = context(out);
  const od = octx.createImageData(W, H);
  const o = od.data;
  const m = squareToQuad(corners);
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    for (let x = 0; x < W; x++) {
      let [X, Y] = project(m, (x + 0.5) / W, v);
      // Keep one pixel inside the edge so the bilinear neighbours below always exist.
      X = Math.min(Math.max(X, 0), sw - 1.001);
      Y = Math.min(Math.max(Y, 0), sh - 1.001);
      const xi = Math.floor(X);
      const yi = Math.floor(Y);
      const fx = X - xi;
      const fy = Y - yi;
      const i00 = (yi * sw + xi) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + sw * 4;
      const i11 = i01 + 4;
      const k = (y * W + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const t = px(i00 + ch) + (px(i10 + ch) - px(i00 + ch)) * fx;
        const b = px(i01 + ch) + (px(i11 + ch) - px(i01 + ch)) * fx;
        o[k + ch] = t + (b - t) * fy;
      }
      o[k + 3] = 255;
    }
  }
  octx.putImageData(od, 0, 0);
  const cells: HTMLCanvasElement[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const cell = canvas(CW, CH);
      context(cell).drawImage(out, c * CW, r * CH, CW, CH, 0, 0, CW, CH);
      cells.push(cell);
    }
  release(out);
  return cells;
}

const grey = (p: Uint8ClampedArray, i: number): number =>
  (p[i] ?? 0) * 0.299 + (p[i + 1] ?? 0) * 0.587 + (p[i + 2] ?? 0) * 0.114;

/** A strip of a pocket (fractions of its size), grey, contrast stretched and enlarged for OCR. */
export function strip(
  cell: HTMLCanvasElement,
  y0: number,
  y1: number,
  x0 = 0,
  x1 = 1,
  scale = 2.2,
): HTMLCanvasElement {
  const sx = Math.round(x0 * cell.width);
  const sy = Math.round(y0 * cell.height);
  const w = Math.round((x1 - x0) * cell.width);
  const h = Math.round((y1 - y0) * cell.height);
  const c = canvas(Math.round(w * scale), Math.round(h * scale));
  const ctx = context(c);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cell, sx, sy, w, h, 0, 0, c.width, c.height);
  const id = ctx.getImageData(0, 0, c.width, c.height);
  const p = id.data;
  const hist = new Uint32Array(256);
  const n = p.length / 4;
  for (let i = 0; i < p.length; i += 4) {
    const g = Math.floor(grey(p, i));
    p[i] = g;
    hist[g] = (hist[g] ?? 0) + 1;
  }
  // Stretch so the darkest and brightest 2% clip: faded or glary print reads as solid black on white.
  let lo = 0;
  let hi = 255;
  let acc = 0;
  while (lo < 255 && (acc += hist[lo] ?? 0) < n * 0.02) lo++;
  acc = 0;
  while (hi > 0 && (acc += hist[hi] ?? 0) < n * 0.02) hi--;
  const k = hi > lo ? 255 / (hi - lo) : 1;
  for (let i = 0; i < p.length; i += 4) {
    const g = Math.max(0, Math.min(255, ((p[i] ?? 0) - lo) * k));
    p[i] = g;
    p[i + 1] = g;
    p[i + 2] = g;
  }
  ctx.putImageData(id, 0, 0);
  return c;
}

/** Spread of brightness in the middle of a pocket. An empty sleeve over a plain backing reads very flat. */
export function flatness(cell: HTMLCanvasElement): number {
  const c = canvas(60, 84);
  const ctx = context(c);
  ctx.drawImage(
    cell,
    cell.width * 0.15,
    cell.height * 0.15,
    cell.width * 0.7,
    cell.height * 0.7,
    0,
    0,
    60,
    84,
  );
  const p = ctx.getImageData(0, 0, 60, 84).data;
  let s = 0;
  let s2 = 0;
  let n = 0;
  for (let i = 0; i < p.length; i += 4) {
    const g = grey(p, i);
    s += g;
    s2 += g * g;
    n++;
  }
  return Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2));
}

/** A picture shrunk to w × h, as RGBA bytes. */
export function pixels(src: Drawable, w: number, h: number): Uint8ClampedArray {
  const [sw, sh] = sizeOf(src);
  const c = canvas(w, h);
  const ctx = context(c, { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, sw, sh, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

const thumbs = new Map<number, Promise<HTMLImageElement | null>>();

/** A printing's small TCGplayer picture, loaded once per session. Null when it can't be had in time. */
export function loadThumb(pid: number): Promise<HTMLImageElement | null> {
  let p = thumbs.get(pid);
  if (!p) {
    p = new Promise((resolve) => {
      const im = new Image();
      // Anonymous CORS so the picture's pixels can be read back from a canvas.
      im.crossOrigin = "anonymous";
      im.decoding = "async";
      const t = setTimeout(() => resolve(null), 8000);
      im.onload = () => {
        clearTimeout(t);
        resolve(im);
      };
      im.onerror = () => {
        clearTimeout(t);
        resolve(null);
      };
      im.src = `https://tcgplayer-cdn.tcgplayer.com/product/${pid}_200w.jpg`;
    });
    thumbs.set(pid, p);
  }
  return p;
}

/**
 * Guesses where the page sits in a photo: everything that differs from the colour around the photo's
 * edge, its largest connected patch, and that patch's four extreme corners. Corners are 0..1 fractions.
 */
export function findPage(src: HTMLCanvasElement): Quad | null {
  const k = 260 / Math.max(src.width, src.height);
  const w = Math.max(8, Math.round(src.width * k));
  const h = Math.max(8, Math.round(src.height * k));
  const c = canvas(w, h);
  const ctx = context(c);
  ctx.drawImage(src, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const at = (i: number) => d[i] ?? 0;
  const bw = Math.max(2, Math.round(Math.min(w, h) * 0.025));
  const border: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (y < bw || y >= h - bw || x < bw || x >= w - bw) border.push((y * w + x) * 4);
  const median = (ch: number) => {
    const v = border.map((i) => at(i + ch)).sort((a, b) => a - b);
    return v[v.length >> 1] ?? 0;
  };
  const bg = [median(0), median(1), median(2)] as const;
  const dist = (i: number) => Math.hypot(at(i) - bg[0], at(i + 1) - bg[1], at(i + 2) - bg[2]);
  // How much the edge itself varies sets the bar, so a busy table needs a bigger difference to count as page.
  const bd = border.map(dist).sort((a, b) => a - b);
  const th = Math.max(38, (bd[Math.floor(bd.length * 0.9)] ?? 0) * 1.4);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = dist(i * 4) > th ? 1 : 0;

  const lab = new Int32Array(w * h);
  const stack: number[] = [];
  let best = 0;
  let bestN = 0;
  let cur = 0;
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || lab[i]) continue;
    cur++;
    let n = 0;
    stack.push(i);
    lab[i] = cur;
    for (let j = stack.pop(); j !== undefined; j = stack.pop()) {
      n++;
      const x = j % w;
      const y = Math.floor(j / w);
      for (const q of [
        x > 0 ? j - 1 : -1,
        x < w - 1 ? j + 1 : -1,
        y > 0 ? j - w : -1,
        y < h - 1 ? j + w : -1,
      ])
        if (q >= 0 && mask[q] && !lab[q]) {
          lab[q] = cur;
          stack.push(q);
        }
    }
    if (n > bestN) {
      bestN = n;
      best = cur;
    }
  }
  if (bestN < w * h * 0.2) return null;

  let tl: Point = [0, 0];
  let tr: Point = [0, 0];
  let br: Point = [0, 0];
  let bl: Point = [0, 0];
  let tlS = 1e9;
  let trS = -1e9;
  let brS = -1e9;
  let blS = 1e9;
  for (let i = 0; i < w * h; i++) {
    if (lab[i] !== best) continue;
    const x = i % w;
    const y = Math.floor(i / w);
    if (x + y < tlS) [tl, tlS] = [[x, y], x + y];
    if (x - y > trS) [tr, trS] = [[x, y], x - y];
    if (x + y > brS) [br, brS] = [[x, y], x + y];
    if (x - y < blS) [bl, blS] = [[x, y], x - y];
  }
  const frac = ([x, y]: Point): Point => [(x + 0.5) / w, (y + 0.5) / h];
  const q: Quad = [frac(tl), frac(tr), frac(br), frac(bl)];
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const [a, b] = q[i] ?? [0, 0];
    const [e, f] = q[(i + 1) % 4] ?? [0, 0];
    area += a * f - e * b;
  }
  area = Math.abs(area) / 2;
  // Too small is a card or a hand; nearly everything means the edge colour wasn't background.
  return area < 0.25 || area > 0.96 ? null : q;
}
