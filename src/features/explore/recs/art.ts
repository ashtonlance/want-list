/**
 * Art fingerprints: art.bin, built daily by the art workflow (tools/art/embed.mjs). Each fingerprinted
 * card has a short int8 vector of its picture (CLIP, reduced with PCA, unit length), so the dot product of
 * two vectors says how alike two cards look: about 127² for the same picture, around 0 for unrelated ones.
 *
 * File layout: "ART1", uint8 version, uint8 dims, uint16 zero, uint32 count, then count uint32 product
 * ids in ascending order, then count x dims int8 vectors in the same order.
 */
export interface ArtIndex {
  dims: number;
  pids: Uint32Array;
  vectors: Int8Array;
}

const HEADER = 12;

export function parseArt(buf: ArrayBuffer): ArtIndex {
  const view = new DataView(buf);
  const magic = String.fromCharCode(...new Uint8Array(buf, 0, Math.min(4, buf.byteLength)));
  if (magic !== "ART1" || buf.byteLength < HEADER) throw new Error("art.bin is malformed");
  if (view.getUint8(4) !== 1) throw new Error("art.bin is a newer version");
  const dims = view.getUint8(5);
  const count = view.getUint32(8, true);
  if (!dims || buf.byteLength !== HEADER + count * (4 + dims)) throw new Error("art.bin is malformed");
  // Copied out so the ids sit on a 4-byte boundary whatever the header length.
  const pids = new Uint32Array(buf.slice(HEADER, HEADER + count * 4));
  const vectors = new Int8Array(buf, HEADER + count * 4, count * dims);
  return { dims, pids, vectors };
}

/** The row of a product id in the index, or -1. */
export function rowOf(index: ArtIndex, pid: number): number {
  let lo = 0;
  let hi = index.pids.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const v = index.pids[mid] ?? 0;
    if (v === pid) return mid;
    if (v < pid) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

/** How alike two rows look, from -1 to 1. */
export function similarity(index: ArtIndex, a: number, b: number): number {
  const { dims, vectors } = index;
  let s = 0;
  for (let k = 0; k < dims; k++) s += (vectors[a * dims + k] ?? 0) * (vectors[b * dims + k] ?? 0);
  return s / (127 * 127);
}

export interface ArtMatch {
  /** For every row: its likeness to the closest seed. */
  top: Float32Array;
  /** For every row: its likeness to the closest seed, blended (2:1) with the mean of its three closest. */
  score: Float32Array;
  /** For every row: which seed it looks most like, as an index into the seed rows. */
  closest: Uint16Array;
}

/** How much every fingerprinted card looks like a set of seed cards (rows in the index). */
export function matchSeeds(index: ArtIndex, seeds: readonly number[]): ArtMatch {
  const n = index.pids.length;
  const { dims, vectors } = index;
  const top = new Float32Array(n);
  const score = new Float32Array(n);
  const closest = new Uint16Array(n);
  if (!seeds.length) return { top, score, closest };
  const take = Math.min(3, seeds.length);
  const best = new Float64Array(take);
  for (let row = 0; row < n; row++) {
    best.fill(-Infinity);
    let best1 = -Infinity;
    let topSeed = 0;
    const base = row * dims;
    for (let s = 0; s < seeds.length; s++) {
      const sb = (seeds[s] ?? 0) * dims;
      let dot = 0;
      for (let k = 0; k < dims; k++) dot += (vectors[base + k] ?? 0) * (vectors[sb + k] ?? 0);
      if (dot > best1) {
        best1 = dot;
        topSeed = s;
      }
      // Keep the three largest, smallest last.
      if (dot > (best[take - 1] ?? -Infinity)) {
        let i = take - 1;
        while (i > 0 && dot > (best[i - 1] ?? -Infinity)) {
          best[i] = best[i - 1] ?? -Infinity;
          i--;
        }
        best[i] = dot;
      }
    }
    let sum = 0;
    for (let i = 0; i < take; i++) sum += best[i] ?? 0;
    // Mostly the closest seed, steadied by the next closest two.
    top[row] = best1 / (127 * 127);
    score[row] = (2 * best1 + sum / take) / 3 / (127 * 127);
    closest[row] = topSeed;
  }
  return { top, score, closest };
}

/** Ranks values 0 to 1 against a sample of all of them, so scores don't depend on how the model scales. */
export function percentiles(values: Float32Array): (v: number) => number {
  const sorted = Float32Array.from(values).sort();
  const n = sorted.length;
  return (v: number) => {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if ((sorted[mid] ?? 0) < v) lo = mid + 1;
      else hi = mid;
    }
    return n ? lo / n : 0;
  };
}
