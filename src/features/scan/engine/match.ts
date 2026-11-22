/* Matching a read pocket to the card catalog: clean up what OCR saw, shortlist printings by name and
   number, then let each printing's picture decide. Nothing here saves anything; the app asks the person
   to confirm every pocket. */
import { setOf, type Catalog } from "~/features/catalog/catalog";
import { loadThumb, pixels, type Drawable } from "./image";
import { rereadTop, type CellRead, type OcrWord } from "./ocr";

/** One catalog printing, with the keys matching needs worked out once. */
export interface Entry {
  pid: number;
  name: string;
  /** The name squashed: lowercase letters and digits only. */
  sq: string;
  set: string;
  jp: boolean;
  date: string;
  no: string;
  /** The number normalised for lookups ("TG05" → "TG5"). */
  nno: string;
  market: number | null;
  /** The id of the list card this printing is, if it's on the list. */
  mine: string | null;
}

export interface ScanIndex {
  byNo: Map<string, Entry[]>;
  byName: Map<string, Entry[]>;
  byPid: Map<number, Entry>;
  /** Squashed names long enough to search for. */
  names: string[];
}

/** A list card, as matching needs it. */
export interface MineCard {
  id: string;
  name: string;
  set: string;
  number: string;
  pid: number | null;
}

export type Conf = "high" | "medium" | "low" | "empty" | "none";

export interface Match {
  conf: Conf;
  /** Likeliest printings first. */
  alts: Entry[];
  /** The biggest words read at the top, for prefilling a search. */
  hint: string;
}

export interface Texts {
  /** The biggest words (the name, usually), squashed. */
  big: string;
  all: string;
  bigWords: string;
}

/* ---------- text ---------- */

export const norm = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const squash = (s: string): string => norm(s).replace(/ /g, "");

/** Card numbers compared without spaces, case or leading zeros: "tg 05" and "TG5" are the same. */
export function normNo(s: string): string {
  const clean = s.toUpperCase().replace(/\s+/g, "");
  const m = /^([A-Z]*)0*(\d+)([A-Z]*)$/.exec(clean);
  return m ? `${m[1] ?? ""}${m[2] ?? ""}${m[3] ?? ""}` : clean;
}

/** Smallest edit distance between p and any stretch of t. */
export function subDist(p: string, t: string): number {
  const m = p.length;
  if (!m) return 0;
  let prev = Array.from({ length: m + 1 }, (_, i) => i);
  let cur = new Array<number>(m + 1).fill(0);
  let best = m;
  for (let j = 1; j <= t.length; j++) {
    // Starting a match anywhere in t is free, which is what makes this a substring distance.
    cur[0] = 0;
    const tc = t.charCodeAt(j - 1);
    for (let i = 1; i <= m; i++) {
      const cost = p.charCodeAt(i - 1) === tc ? 0 : 1;
      cur[i] = Math.min((prev[i] ?? 0) + 1, (cur[i - 1] ?? 0) + 1, (prev[i - 1] ?? 0) + cost);
    }
    best = Math.min(best, cur[m] ?? best);
    [prev, cur] = [cur, prev];
  }
  return best;
}

/** How well a squashed name appears in squashed text, 0 to 1. Short names must appear exactly. */
export function nameSim(name: string, text: string): number {
  if (!name || !text) return 0;
  const d = subDist(name, text);
  if (name.length <= 4 && d) return 0;
  return 1 - d / name.length;
}

/** Card-face words that are never part of a name. */
const STOP =
  /^(basic|stage|stage1|stage2|hp|evolves|evolve|from|put|this|card|on|the|of|trainer|item|supporter|stadium|tool|energy|pokemon|tera|lv|level|restored|break|ace|spec|vunion|illus|illustrator)$/;

/** Letters OCR commonly reads in place of digits. */
export const fixDigits = (s: string): string =>
  s
    .replace(/[Oo]/g, "0")
    .replace(/[Il|!]/g, "1")
    .replace(/[Ss]/g, "5")
    .replace(/B/g, "8")
    .replace(/Z/g, "2");

/** Card numbers printed like 094/086, 17/64, TG06/TG30, SWSH123, SV052, normalised and without repeats. */
export function numbersIn(words: readonly OcrWord[]): string[] {
  const raw = words.map((w) => w.t).join(" ");
  const out: string[] = [];
  const add = (n: string) => {
    const k = normNo(n);
    if (k && !out.includes(k)) out.push(k);
  };
  for (const m of raw.matchAll(
    /([A-Za-z]{0,4})\s?([0-9OolIS|!]{1,3})\s*[/⁄]\s*([A-Za-z]{0,4})?\s?[0-9OolIS|!]{1,3}/g,
  )) {
    const prefix = m[1] ?? "";
    const d = fixDigits(m[2] ?? "");
    if (/^\d+$/.test(d))
      add((/^(TG|GG|RC|SV|SWSH|SM|XY|BW|H)$/i.test(prefix) ? prefix.toUpperCase() : "") + d);
  }
  for (const m of raw.matchAll(/\b(TG|GG|RC|SWSH|SVP|SV|SM|XY|BW)\s?(\d{1,3})\b/gi))
    add((m[1] ?? "").toUpperCase() + (m[2] ?? ""));
  return out;
}

export function textsOf(words: readonly OcrWord[]): Texts {
  const clean = words
    .filter((w) => /[a-z]/i.test(w.t))
    .map((w) => ({ ...w, n: norm(w.t) }))
    .filter((w) => w.n && !STOP.test(w.n.replace(/ /g, "")));
  const maxH = Math.max(0, ...clean.map((w) => w.h));
  // The name is the biggest type at the top; attacks and flavour text are smaller.
  const big = clean.filter((w) => w.h >= maxH * 0.6 && w.c > 10);
  return {
    big: big
      .map((w) => w.n)
      .join("")
      .replace(/ /g, ""),
    all: clean
      .map((w) => w.n)
      .join("")
      .replace(/ /g, ""),
    bigWords: big.map((w) => w.n).join(" "),
  };
}

/* ---------- the index ---------- */

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function buildIndex(catalog: Catalog, mine: readonly MineCard[]): ScanIndex {
  const myPids = new Map<number, string>();
  const myKeys = new Map<string, string>();
  for (const c of mine) {
    if (c.pid) myPids.set(c.pid, c.id);
    myKeys.set(`${squash(c.name)}#${normNo(c.number)}`, c.id);
  }
  const byNo = new Map<string, Entry[]>();
  const byName = new Map<string, Entry[]>();
  const byPid = new Map<number, Entry>();
  for (const r of catalog.cards) {
    const st = setOf(catalog, r);
    const sq = squash(r.name);
    const nno = normNo(r.number);
    const e: Entry = {
      pid: r.pid,
      name: r.name,
      sq,
      set: st.name,
      jp: st.jp,
      date: st.date,
      no: r.number,
      nno,
      market: r.market || null,
      mine: myPids.get(r.pid) || myKeys.get(`${sq}#${nno}`) || null,
    };
    push(byNo, nno, e);
    push(byName, sq, e);
    byPid.set(e.pid, e);
  }
  return { byNo, byName, byPid, names: [...byName.keys()].filter((n) => n.length >= 3) };
}

/* ---------- comparing the pocket with each printing's picture ---------- */

const PW = 40;
const PH = 56;
/** The coarser size used to sift the list's cards before the full comparison. */
const QW = 36;
const QH = 50;

/** The whole pocket shrunk to PW × PH, what every picture is compared against. */
export const pocketSig = (cell: HTMLCanvasElement): Uint8ClampedArray => pixels(cell, PW, PH);

/** Pearson correlation of one colour channel between the pocket (at an offset) and a picture of size w × h. */
function correlate(
  sig: Uint8ClampedArray,
  pic: Uint8ClampedArray,
  w: number,
  h: number,
  ox: number,
  oy: number,
  ch: number,
): number {
  let sa = 0;
  let sb = 0;
  let saa = 0;
  let sbb = 0;
  let sab = 0;
  let n = 0;
  // Skip a two-pixel rim: sleeve edges and card borders vary more than the art.
  for (let y = 2; y < h - 2; y++)
    for (let x = 2; x < w - 2; x++) {
      const a = sig[((y + oy) * PW + x + ox) * 4 + ch] ?? 0;
      const b = pic[(y * w + x) * 4 + ch] ?? 0;
      sa += a;
      sb += b;
      saa += a * a;
      sbb += b * b;
      sab += a * b;
      n++;
    }
  const va = saa - (sa * sa) / n;
  const vb = sbb - (sb * sb) / n;
  return va > 0 && vb > 0 ? (sab - (sa * sb) / n) / Math.sqrt(va * vb) : 0;
}

const colourMatch = (
  sig: Uint8ClampedArray,
  pic: Uint8ClampedArray,
  w: number,
  h: number,
  ox: number,
  oy: number,
) =>
  (correlate(sig, pic, w, h, ox, oy, 0) +
    correlate(sig, pic, w, h, ox, oy, 1) +
    correlate(sig, pic, w, h, ox, oy, 2)) /
  3;

/**
 * Best correlation of a printing's picture against the pocket, trying a few sizes and offsets because
 * the card never sits exactly in the middle of its sleeve.
 */
export function imageScore(sig: Uint8ClampedArray, im: Drawable): number {
  let best = -1;
  for (const s of [0.86, 0.91, 0.96, 1]) {
    const w = Math.round(PW * s);
    const h = Math.min(PH, Math.round((w * 88) / 63));
    const pic = pixels(im, w, h);
    const mx = PW - w;
    const my = PH - h;
    for (let oy = Math.max(0, (my >> 1) - 3); oy <= Math.min(my, (my >> 1) + 3); oy++)
      for (let ox = Math.max(0, (mx >> 1) - 3); ox <= Math.min(mx, (mx >> 1) + 3); ox++)
        best = Math.max(best, colourMatch(sig, pic, w, h, ox, oy));
  }
  return best;
}

interface MineSig {
  e: Entry;
  im: HTMLImageElement;
  sig: Uint8ClampedArray;
}

const mineCache = new WeakMap<ScanIndex, Promise<MineSig[]>>();

/** Pictures of every card on the list, loaded once per index. */
function mineSigs(idx: ScanIndex): Promise<MineSig[]> {
  let p = mineCache.get(idx);
  if (!p) {
    p = (async () => {
      const seen = new Set<string>();
      const es: Entry[] = [];
      for (const list of idx.byName.values())
        for (const e of list)
          if (e.mine && !seen.has(e.mine)) {
            seen.add(e.mine);
            es.push(e);
          }
      const ims = await Promise.all(es.map((e) => loadThumb(e.pid)));
      return es.flatMap((e, i) => {
        const im = ims[i];
        return im ? [{ e, im, sig: pixels(im, QW, QH) }] : [];
      });
    })();
    mineCache.set(idx, p);
  }
  return p;
}

function quickScore(sig: Uint8ClampedArray, q: Uint8ClampedArray): number {
  let best = -1;
  for (let oy = 1; oy <= 5; oy += 2)
    for (let ox = 0; ox <= 4; ox += 2) best = Math.max(best, colourMatch(sig, q, QW, QH, ox, oy));
  return best;
}

interface MineMatch {
  alts: Entry[];
  img: number;
  margin: number;
}

/** When no name can be read, compares the pocket's picture with the cards already on the list. */
async function mineMatch(idx: ScanIndex, sig: Uint8ClampedArray): Promise<MineMatch | null> {
  const all = await mineSigs(idx);
  const top = all
    .map((m) => ({ m, q: quickScore(sig, m.sig) }))
    .sort((a, b) => b.q - a.q)
    .slice(0, 5)
    .map((t) => ({ e: t.m.e, img: imageScore(sig, t.m.im) }))
    .sort((a, b) => b.img - a.img);
  const [first, second] = top;
  if (!first) return null;
  return { alts: top.map((t) => t.e), img: first.img, margin: first.img - (second?.img ?? 0) };
}

/* ---------- ranking ---------- */

/** A small nudge toward cards already on the list and away from Japanese printings. */
const prior = (e: Entry): number => (e.mine ? 0.06 : 0) - (e.jp ? 0.05 : 0);

type NameScore = readonly [name: string, score: number];

const byScore = (a: NameScore, b: NameScore): number => b[1] - a[1] || b[0].length - a[0].length;

function nameCands(idx: ScanIndex, t: Texts, nums: readonly string[]): NameScore[] {
  const out = new Map<string, number>();
  // Words outside the biggest type are noisier, so a match there counts for a little less.
  const sim = (n: string) => Math.max(nameSim(n, t.big), nameSim(n, t.all) - 0.08);
  for (const n of idx.names) {
    const s = sim(n);
    if (s >= 0.55) out.set(n, Math.max(out.get(n) ?? 0, s));
  }
  // A number that was read lets a weaker name match through.
  for (const no of nums)
    for (const e of idx.byNo.get(no) ?? []) {
      const s = sim(e.sq);
      if (s >= 0.4) out.set(e.sq, Math.max(out.get(e.sq) ?? 0, s));
    }
  return [...out.entries()].sort(byScore);
}

function mergeNames(a: readonly NameScore[], b: readonly NameScore[]): NameScore[] {
  const m = new Map(a);
  for (const [n, v] of b) m.set(n, Math.max(m.get(n) ?? 0, v));
  return [...m.entries()].sort(byScore);
}

interface Candidate {
  e: Entry;
  /** Name score. */
  ns: number;
  /** True when the printed number was read. */
  num: boolean;
  /** Picture score; undefined for printings whose picture wasn't looked at. */
  img?: number;
  score: number;
}

/** Reads one pocket's name and number and ranks the catalog printings it could be. */
export async function matchCell(idx: ScanIndex, read: CellRead, cell: HTMLCanvasElement): Promise<Match> {
  const t = textsOf(read.top);
  const nums = numbersIn(read.bot).concat(numbersIn(read.top).filter((n) => /[A-Z]/.test(n)));
  const textChars =
    t.all.length +
    read.bot
      .map((w) => w.t)
      .join("")
      .replace(/\W/g, "").length;
  if (read.flat < 14 && textChars < 4) return { conf: "empty", alts: [], hint: "" };

  let names = nameCands(idx, t, nums);
  let hint = t.bigWords.trim();
  for (const mode of ["white", "invert"] as const) {
    if ((names[0]?.[1] ?? 0) >= 0.85) break;
    const t2 = textsOf(await rereadTop(read, cell, mode));
    const n2 = nameCands(idx, t2, nums);
    const top2 = n2[0];
    if (top2 && (!names[0] || top2[1] > names[0][1])) hint = t2.bigWords.trim() || hint;
    names = mergeNames(names, n2);
  }

  const fromMine = async (): Promise<Match | null> => {
    const f = await mineMatch(idx, pocketSig(cell));
    return f && f.img >= 0.7 && f.margin >= 0.08 ? { conf: "medium", alts: f.alts, hint } : null;
  };
  const topName = names[0];
  if (!topName) return (await fromMine()) ?? { conf: "none", alts: [], hint };

  // Shortlist printings from the likeliest names, then let the pictures decide.
  const pool: Candidate[] = [];
  const seen = new Set<number>();
  for (const [n, s] of names.slice(0, 6))
    for (const e of idx.byName.get(n) ?? [])
      if (!seen.has(e.pid)) {
        seen.add(e.pid);
        pool.push({ e, ns: s, num: nums.includes(e.nno), score: 0 });
      }
  pool.sort(
    (a, b) =>
      Number(b.num) - Number(a.num) ||
      b.ns - a.ns ||
      Number(Boolean(b.e.mine)) - Number(Boolean(a.e.mine)) ||
      Number(a.e.jp) - Number(b.e.jp) ||
      b.e.date.localeCompare(a.e.date),
  );
  // Look at up to 48 pictures: plenty for the best name's many printings, a few for the rest.
  const look: Candidate[] = [];
  const perName = new Map<string, number>();
  for (const x of pool) {
    const k = perName.get(x.e.sq) ?? 0;
    if (x.num || k < (x.ns === topName[1] ? 40 : 10)) {
      look.push(x);
      perName.set(x.e.sq, k + 1);
    }
    if (look.length >= 48) break;
  }
  const sig = pocketSig(cell);
  const ims = await Promise.all(look.map((x) => loadThumb(x.e.pid)));
  look.forEach((x, i) => {
    const im = ims[i];
    x.img = im ? imageScore(sig, im) : 0;
  });
  for (const x of pool)
    x.score = x.ns + (x.num ? 0.4 : 0) + (x.img !== undefined ? 1.4 * x.img : -0.3) + prior(x.e);
  pool.sort((a, b) => b.score - a.score);

  const [best] = pool;
  if (!best) return (await fromMine()) ?? { conf: "none", alts: [], hint };
  const bestImg = best.img ?? 0;
  const second = pool.find((x) => x.e.pid !== best.e.pid && x.img !== undefined);
  const margin = second ? bestImg - (second.img ?? 0) : 1;
  const alts = pool.slice(0, 8).map((x) => x.e);
  if (bestImg < 0.4 && !best.num) return (await fromMine()) ?? { conf: "none", alts, hint };
  const conf: Conf =
    bestImg >= 0.7 && (margin >= 0.06 || best.num) && best.ns >= 0.6
      ? "high"
      : bestImg >= 0.55 && best.ns >= 0.6
        ? "medium"
        : "low";
  return { conf, alts, hint };
}
