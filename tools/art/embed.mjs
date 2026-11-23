// Art fingerprints: a small picture embedding of every card worth suggesting, so For You picks can
// favour cards that look like the ones in a collection. Runs in GitHub Actions (.github/workflows/art.yml).
//
// Each card's TCGplayer picture goes through CLIP's image encoder (ViT-B/32, 512 numbers), is reduced
// with PCA to a few dozen numbers, scaled to unit length and rounded to int8. The result, art.bin,
// is what the app downloads. The PCA axes are fitted once and kept in pca.bin, so every later day only
// embeds the cards that are new and appends them; art.bin itself is the cache.
//
// The first run (no pca.bin yet) embeds everything it can within the time budget and fits the axes on
// that; a run that hits the budget saves what it has, and the next run carries on.
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } from "@huggingface/transformers";
import { readListPids } from "../lib/listPids.mjs";
import { decodeArt, decodePca, encodeArt, encodePca, fitPca, project } from "./pca.mjs";

const ROOT = new URL("../../", import.meta.url);
const ART = new URL("art.bin", ROOT);
const PCA = new URL("tools/art/pca.bin", ROOT);
const MODEL = "Xenova/clip-vit-base-patch32";
const WIDTH = 512;
const DIMS = Number(process.env.ART_DIMS || 48);
const BUDGET_MS = Number(process.env.ART_BUDGET_MINUTES || 70) * 60_000;
const LIMIT = Number(process.env.ART_LIMIT || Infinity);
const BATCH = 32;
const MIN_FIT = 2000;
/** Commons, uncommons and code cards are almost never suggested, so they aren't embedded unless listed. */
const SKIP_RARITY = /^(common|uncommon|code card)$/i;

if (process.env.HF_CACHE_DIR) env.cacheDir = process.env.HF_CACHE_DIR;
const started = Date.now();
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchImage(pid, tries = 3) {
  const url = `https://tcgplayer-cdn.tcgplayer.com/product/${pid}_200w.jpg`;
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url);
      if (r.status === 404 || r.status === 403) return null; // no picture for this product
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await RawImage.fromBlob(await r.blob());
    } catch (e) {
      if (i >= tries) { console.warn("skip picture", pid, e.message); return null; }
      await sleep(500 * i);
    }
  }
}

/** Fraction of each query's 10 nearest cards (full 512 numbers) that the reduced int8 version also finds. */
function recallAt10(raw, n, pcaMax, dims, queries) {
  const top10 = scores => [...scores.keys()].sort((a, b) => scores[b] - scores[a]).slice(1, 11);
  const trunc = { ...pcaMax, dims, axes: pcaMax.axes.subarray(0, dims * WIDTH) };
  const q8 = Array.from({ length: n }, (_, i) => project(trunc, raw.subarray(i * WIDTH, (i + 1) * WIDTH)));
  let hit = 0;
  for (const qi of queries) {
    const full = new Float32Array(n), small = new Float32Array(n);
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let a = 0; a < WIDTH; a++) s += raw[qi * WIDTH + a] * raw[j * WIDTH + a];
      full[j] = s;
      let t = 0;
      for (let a = 0; a < dims; a++) t += q8[qi][a] * q8[j][a];
      small[j] = t;
    }
    const want = new Set(top10(full));
    hit += top10(small).filter(j => want.has(j)).length;
  }
  return hit / (queries.length * 10);
}

// 1. Which cards should have a fingerprint.
const cat = JSON.parse(await readFile(new URL("catalog.json", ROOT), "utf8"));
let listed = new Set();
try { listed = await readListPids(ROOT); } catch (e) { console.warn("couldn't read the list:", e.message); }
const inCatalog = new Set(cat.cards.map(r => r[0]));
const eligible = cat.cards.filter(r => {
  const priced = r[5] > 0 && r[5] < 99999;
  return listed.has(String(r[0])) || (priced && !SKIP_RARITY.test(cat.rarities[r[4]] || ""));
});

// 2. What we already have. A missing or mismatched pca.bin means starting over.
let pca = existsSync(PCA) ? decodePca(await readFile(PCA)) : null;
let have = new Map();
if (pca && existsSync(ART)) {
  const art = decodeArt(await readFile(ART));
  if (art.dims === pca.dims) have = art.vectors;
  else pca = null;
}
if (pca && pca.dims !== DIMS) { console.log(`ART_DIMS changed (${pca.dims} -> ${DIMS}); rebuilding`); pca = null; have = new Map(); }
for (const pid of have.keys()) if (!inCatalog.has(pid)) have.delete(pid);

// Listed cards first, then the priciest, so a partial first run covers the likeliest picks.
const todo = eligible
  .filter(r => !have.has(r[0]))
  .sort((a, b) => Number(listed.has(String(b[0]))) - Number(listed.has(String(a[0]))) || b[5] - a[5])
  .slice(0, LIMIT)
  .map(r => r[0]);
console.log(`eligible ${eligible.length}, have ${have.size}, to embed ${todo.length}${pca ? "" : " (fitting new axes)"}`);

// 3. Embed.
const raw = new Float32Array(todo.length * WIDTH);
const done = [];
if (todo.length) {
  const processor = await AutoProcessor.from_pretrained(MODEL);
  const model = await CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype: "fp32" });
  console.log("model ready in", Math.round((Date.now() - started) / 1000), "s");
  let next = fetchBatch(0);
  for (let at = 0; at < todo.length; at += BATCH) {
    if (Date.now() - started > BUDGET_MS) { console.log("time budget reached; the next run carries on"); break; }
    const batch = await next;
    next = at + BATCH < todo.length ? fetchBatch(at + BATCH) : null; // download the next batch while this one runs
    const ok = batch.filter(b => b.img);
    if (!ok.length) continue;
    const inputs = await processor(ok.map(b => b.img));
    const { image_embeds } = await model(inputs);
    const data = image_embeds.data;
    ok.forEach((b, i) => {
      const v = data.subarray(i * WIDTH, (i + 1) * WIDTH);
      let norm = 0;
      for (let a = 0; a < WIDTH; a++) norm += v[a] * v[a];
      norm = Math.sqrt(norm) || 1;
      const row = done.length;
      for (let a = 0; a < WIDTH; a++) raw[row * WIDTH + a] = v[a] / norm;
      done.push(b.pid);
    });
    if ((at / BATCH) % 50 === 0) {
      const s = (Date.now() - started) / 1000;
      console.log(`${done.length}/${todo.length} embedded, ${Math.round(s)} s`);
    }
  }
  if (next) await next;
}
async function fetchBatch(at) {
  const pids = todo.slice(at, at + BATCH);
  return Promise.all(pids.map(async pid => ({ pid, img: await fetchImage(pid) })));
}
console.log(`embedded ${done.length} of ${todo.length} in ${Math.round((Date.now() - started) / 1000)} s`);

// 4. Fit the axes on the first run, and report how much the smaller vectors keep.
if (!pca) {
  if (done.length < MIN_FIT) throw new Error(`only ${done.length} pictures embedded; need ${MIN_FIT} to fit the axes`);
  const maxDims = Math.max(DIMS, 64);
  const fitted = fitPca(raw, done.length, WIDTH, maxDims);
  const queries = Array.from({ length: Math.min(200, done.length) }, (_, i) => Math.floor((i * done.length) / 200));
  for (const d of [24, 32, 48, 64]) console.log(`dims ${d}: nearest-10 recall ${(recallAt10(raw, done.length, fitted, d, queries) * 100).toFixed(1)}%`);
  pca = { ...fitted, dims: DIMS, axes: fitted.axes.slice(0, DIMS * WIDTH) };
  await writeFile(PCA, encodePca(pca));
}

// 5. Write art.bin.
for (let i = 0; i < done.length; i++) have.set(done[i], project(pca, raw.subarray(i * WIDTH, (i + 1) * WIDTH)));
const out = encodeArt(pca.dims, have);
await writeFile(ART, out);
console.log(`art.bin: ${have.size} cards x ${pca.dims} dims = ${(out.length / 1024).toFixed(0)} KB`);
