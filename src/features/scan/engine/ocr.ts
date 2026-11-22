/* Reading text off a pocket in the browser with Tesseract.js. The worker, its WebAssembly core and the
   English data load from Tesseract's free public CDNs (jsDelivr and tessdata) on first use. */
import type Tesseract from "tesseract.js";
import { canvas, context, flatness, strip } from "./image";

/** A word Tesseract read: its text, confidence (0 to 100) and height in pixels. */
export interface OcrWord {
  t: string;
  c: number;
  h: number;
}

/** What one pocket's first read found, kept so the name can be reread without starting over. */
export interface CellRead {
  /** Words in the top fifth, where the name is printed. */
  top: OcrWord[];
  /** Words in the bottom fifth, where the number is printed. */
  bot: OcrWord[];
  flat: number;
  topC: HTMLCanvasElement;
  botC: HTMLCanvasElement;
}

let workerP: Promise<Tesseract.Worker> | null = null;

/** The one Tesseract worker, started on first use. A failed start is forgotten so the next try starts again. */
export function getWorker(): Promise<Tesseract.Worker> {
  workerP ??= (async () => {
    const { default: T } = await import("tesseract.js");
    const w = await T.createWorker("eng", T.OEM.LSTM_ONLY);
    // Sparse text: card faces have scattered words, not paragraphs.
    await w.setParameters({ tessedit_pageseg_mode: T.PSM.SPARSE_TEXT, preserve_interword_spaces: "1" });
    return w;
  })().catch((e: unknown) => {
    workerP = null;
    throw e;
  });
  return workerP;
}

function wordsOf(page: Tesseract.Page): OcrWord[] {
  const out: OcrWord[] = [];
  for (const b of page.blocks ?? [])
    for (const p of b.paragraphs)
      for (const l of p.lines)
        for (const w of l.words) out.push({ t: w.text, c: w.confidence, h: w.bbox.y1 - w.bbox.y0 });
  return out;
}

async function recognize(img: HTMLCanvasElement): Promise<OcrWord[]> {
  const w = await getWorker();
  return wordsOf((await w.recognize(img, {}, { blocks: true, text: true })).data);
}

export async function readCell(cell: HTMLCanvasElement): Promise<CellRead> {
  await getWorker();
  const flat = flatness(cell);
  const topC = strip(cell, 0, 0.2, 0, 1, 2.4);
  const botC = strip(cell, 0.8, 1, 0, 1, 3);
  const top = await recognize(topC);
  const bot = await recognize(botC);
  return { top, bot, flat, topC, botC };
}

export type RereadMode = "white" | "invert";

/**
 * Another look at the name. "white" keeps only bright, colourless pixels as black ink, which pulls
 * white names off busy full-art backgrounds. "invert" swaps light and dark.
 */
export async function rereadTop(
  read: CellRead,
  cell: HTMLCanvasElement,
  mode: RereadMode,
): Promise<OcrWord[]> {
  const sc = 2.4;
  const sw = cell.width;
  const sh = Math.round(cell.height * 0.2);
  const c = canvas(Math.round(sw * sc), Math.round(sh * sc));
  const ctx = context(c);
  ctx.imageSmoothingQuality = "high";
  if (mode === "invert") {
    ctx.filter = "invert(1)";
    ctx.drawImage(read.topC, 0, 0, c.width, c.height);
  } else {
    ctx.drawImage(cell, 0, 0, sw, sh, 0, 0, c.width, c.height);
    const id = ctx.getImageData(0, 0, c.width, c.height);
    const p = id.data;
    const hist = new Uint32Array(256);
    const n = p.length / 4;
    const lo = (i: number) => Math.min(p[i] ?? 0, p[i + 1] ?? 0, p[i + 2] ?? 0);
    const hiOf = (i: number) => Math.max(p[i] ?? 0, p[i + 1] ?? 0, p[i + 2] ?? 0);
    for (let i = 0; i < p.length; i += 4) {
      const m = lo(i);
      hist[m] = (hist[m] ?? 0) + 1;
    }
    // The brightest 3% sets "white" for this card, so a dim photo still finds its name.
    let hi = 255;
    let acc = 0;
    while (hi > 0 && (acc += hist[hi] ?? 0) < n * 0.03) hi--;
    const th = Math.max(150, hi - 45);
    for (let i = 0; i < p.length; i += 4) {
      const mn = lo(i);
      const ink = mn >= th && hiOf(i) - mn < 60;
      const v = ink ? 0 : 255;
      p[i] = v;
      p[i + 1] = v;
      p[i + 2] = v;
    }
    ctx.putImageData(id, 0, 0);
  }
  return recognize(c);
}
