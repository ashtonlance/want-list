/* Binder page scanning: straighten a photo of a page, split it into pockets, read each card's
   name and number in the browser (Tesseract.js), and match them to the card catalog.
   Nothing here saves anything. The app shows every match for review first. */
(() => {
  const TESS = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  const CW = 600, CH = 838; // one straightened pocket, card shaped (63 x 88)

  /* ---------- loading ---------- */
  let workerP = null;
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("load " + src)); document.head.append(s); });
  }
  function getWorker(onStatus) {
    if (!workerP) workerP = (async () => {
      if (!window.Tesseract) await loadScript(TESS);
      const w = await Tesseract.createWorker("eng", 1, { logger: m => onStatus && onStatus(m) });
      await w.setParameters({ tessedit_pageseg_mode: "11", preserve_interword_spaces: "1" });
      return w;
    })().catch(e => { workerP = null; throw e; });
    return workerP;
  }

  /* ---------- image helpers ---------- */
  function fileToImage(file) {
    return new Promise((res, rej) => { const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => res(img); img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("image")); }; img.src = url; });
  }
  /* Draw the photo at a working size (long side up to max px). Browsers apply the photo's EXIF rotation when drawing. */
  function toCanvas(img, max = 3200) {
    const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height, k = Math.min(1, max / Math.max(w0, h0));
    const c = document.createElement("canvas"); c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); return c;
  }
  /* Homography that maps the unit square (0,0)(1,0)(1,1)(0,1) onto a quad. */
  function squareToQuad(q) {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    let g = 0, h = 0;
    if (sx || sy) { const den = dx1 * dy2 - dx2 * dy1; g = (sx * dy2 - dx2 * sy) / den; h = (dx1 * sy - sx * dy1) / den; }
    return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h];
  }
  /* Straighten the page inside `corners` (TL, TR, BR, BL in source pixels) into a cols x rows grid of pockets. */
  function rectify(src, corners, cols, rows) {
    const W = cols * CW, H = rows * CH, sw = src.width, sh = src.height;
    const sd = src.getContext("2d").getImageData(0, 0, sw, sh).data;
    const out = document.createElement("canvas"); out.width = W; out.height = H;
    const octx = out.getContext("2d"), od = octx.createImageData(W, H), o = od.data;
    const [a, b, c, d, e, f, g, h] = squareToQuad(corners);
    for (let y = 0; y < H; y++) { const v = (y + 0.5) / H;
      for (let x = 0; x < W; x++) { const u = (x + 0.5) / W, den = g * u + h * v + 1;
        let X = (a * u + b * v + c) / den, Y = (d * u + e * v + f) / den;
        if (X < 0) X = 0; else if (X > sw - 1.001) X = sw - 1.001; if (Y < 0) Y = 0; else if (Y > sh - 1.001) Y = sh - 1.001;
        const xi = X | 0, yi = Y | 0, fx = X - xi, fy = Y - yi, i00 = (yi * sw + xi) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4, k = (y * W + x) * 4;
        for (let ch = 0; ch < 3; ch++) { const t = sd[i00 + ch] + (sd[i10 + ch] - sd[i00 + ch]) * fx, bt = sd[i01 + ch] + (sd[i11 + ch] - sd[i01 + ch]) * fx; o[k + ch] = t + (bt - t) * fy; }
        o[k + 3] = 255; } }
    octx.putImageData(od, 0, 0);
    const cells = [];
    for (let r = 0; r < rows; r++) for (let cI = 0; cI < cols; cI++) {
      const cv = document.createElement("canvas"); cv.width = CW; cv.height = CH;
      cv.getContext("2d").drawImage(out, cI * CW, r * CH, CW, CH, 0, 0, CW, CH); cells.push(cv); }
    return cells;
  }
  /* A strip of a pocket, grey, contrast stretched and enlarged for OCR. */
  function strip(cell, y0, y1, x0 = 0, x1 = 1, scale = 2.2) {
    const sx = Math.round(x0 * cell.width), sy = Math.round(y0 * cell.height), w = Math.round((x1 - x0) * cell.width), h = Math.round((y1 - y0) * cell.height);
    const c = document.createElement("canvas"); c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    const ctx = c.getContext("2d"); ctx.imageSmoothingQuality = "high"; ctx.drawImage(cell, sx, sy, w, h, 0, 0, c.width, c.height);
    const id = ctx.getImageData(0, 0, c.width, c.height), p = id.data, hist = new Uint32Array(256), n = p.length / 4;
    for (let i = 0; i < p.length; i += 4) { const g = (p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114) | 0; p[i] = g; hist[g]++; }
    let lo = 0, hi = 255, acc = 0; while (lo < 255 && (acc += hist[lo]) < n * 0.02) lo++; acc = 0; while (hi > 0 && (acc += hist[hi]) < n * 0.02) hi--;
    const k = hi > lo ? 255 / (hi - lo) : 1;
    for (let i = 0; i < p.length; i += 4) { const g = Math.max(0, Math.min(255, (p[i] - lo) * k)); p[i] = p[i + 1] = p[i + 2] = g; }
    ctx.putImageData(id, 0, 0); return c;
  }
  /* Spread of brightness in the middle of a pocket. An empty sleeve over a plain backing reads very flat. */
  function flatness(cell) {
    const c = document.createElement("canvas"); c.width = 60; c.height = 84; const ctx = c.getContext("2d");
    ctx.drawImage(cell, cell.width * 0.15, cell.height * 0.15, cell.width * 0.7, cell.height * 0.7, 0, 0, 60, 84);
    const p = ctx.getImageData(0, 0, 60, 84).data; let s = 0, s2 = 0, n = 0;
    for (let i = 0; i < p.length; i += 4) { const g = p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114; s += g; s2 += g * g; n++; }
    return Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2));
  }
  const wordsOf = data => { const out = [];
    for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) for (const w of l.words || []) out.push({ t: w.text, c: w.confidence, h: w.bbox.y1 - w.bbox.y0 });
    return out; };

  /* ---------- reading one pocket ---------- */
  async function readCell(cell, onStatus) {
    const w = await getWorker(onStatus);
    const flat = flatness(cell);
    const top = wordsOf((await w.recognize(strip(cell, 0.015, 0.135), {}, { blocks: true, text: true })).data);
    const bot = wordsOf((await w.recognize(strip(cell, 0.86, 0.995), {}, { blocks: true, text: true })).data);
    return { top, bot, flat };
  }

  /* ---------- matching ---------- */
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’'`.]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const squash = s => norm(s).replace(/ /g, "");
  const normNo = s => { const m = String(s || "").toUpperCase().replace(/\s+/g, "").match(/^([A-Z]*)0*(\d+)([A-Z]*)$/); return m ? m[1] + m[2] + m[3] : String(s || "").toUpperCase().replace(/\s+/g, ""); };

  /* Smallest edit distance between p and any stretch of t. */
  function subDist(p, t) {
    const m = p.length; if (!m) return 0; let prev = new Array(m + 1), cur = new Array(m + 1);
    for (let i = 0; i <= m; i++) prev[i] = i; let best = m;
    for (let j = 1; j <= t.length; j++) { cur[0] = 0; const tc = t.charCodeAt(j - 1);
      for (let i = 1; i <= m; i++) { const cost = p.charCodeAt(i - 1) === tc ? 0 : 1; cur[i] = Math.min(prev[i] + 1, cur[i - 1] + 1, prev[i - 1] + cost); }
      if (cur[m] < best) best = cur[m]; [prev, cur] = [cur, prev]; }
    return best;
  }
  const nameSim = (name, text) => { if (!name || !text) return 0; const d = subDist(name, text); if (name.length <= 4 && d) return 0; return 1 - d / name.length; };

  /* catalog: { sets:[[name, jp, date]], rarities:[], cards:[[pid, name, setIdx, number, rarityIdx, market]] }
     mine: the list's cards, each { id, name, set, number, pid } */
  function buildIndex(catalog, mine) {
    const byNo = new Map(), byName = new Map(), myKeys = new Map(), myPids = new Map();
    for (const c of mine || []) { if (c.pid) myPids.set(+c.pid, c.id); myKeys.set(squash(c.name) + "#" + normNo(c.number), c.id); }
    catalog.cards.forEach((r, i) => { const st = catalog.sets[r[2]];
      const e = { i, pid: r[0], name: r[1], sq: squash(r[1]), set: st[0], jp: !!st[1], date: st[2] || "", no: String(r[3]), nno: normNo(r[3]), rarity: catalog.rarities[r[4]] || "", market: r[5] || null };
      e.mine = myPids.get(e.pid) || myKeys.get(e.sq + "#" + e.nno) || null;
      if (!byNo.has(e.nno)) byNo.set(e.nno, []); byNo.get(e.nno).push(e);
      if (!byName.has(e.sq)) byName.set(e.sq, []); byName.get(e.sq).push(e); });
    return { byNo, byName, names: [...byName.keys()].filter(n => n.length >= 3) };
  }

  const STOP = /^(basic|stage|stage1|stage2|hp|evolves|evolve|from|put|this|card|on|the|of|trainer|item|supporter|stadium|tool|energy|pokemon|tera|lv|level|restored|break|ace|spec|vunion|illus|illustrator)$/;
  const fixDigits = s => s.replace(/[Oo]/g, "0").replace(/[Il|!]/g, "1").replace(/[Ss]/g, "5").replace(/B/g, "8").replace(/Z/g, "2");
  /* Card numbers printed like 094/086, 17/64, TG06/TG30, SWSH123, SV052. */
  function numbersIn(words) {
    const raw = words.map(w => w.t).join(" "), out = [];
    const add = n => { const k = normNo(n); if (k && !out.includes(k)) out.push(k); };
    for (const m of raw.matchAll(/([A-Za-z]{0,4})\s?([0-9OolIS|!]{1,3})\s*[\/⁄]\s*([A-Za-z]{0,4})?\s?[0-9OolIS|!]{1,3}/g)) {
      const d = fixDigits(m[2]); if (/^\d+$/.test(d)) add((/^(TG|GG|RC|SV|SWSH|SM|XY|BW|H)$/i.test(m[1]) ? m[1].toUpperCase() : "") + d); }
    for (const m of raw.matchAll(/\b(TG|GG|RC|SWSH|SVP|SV|SM|XY|BW)\s?(\d{1,3})\b/gi)) add(m[1].toUpperCase() + m[2]);
    return out;
  }
  function textsOf(words) {
    const clean = words.filter(w => /[a-z]/i.test(w.t)).map(w => ({ ...w, n: norm(w.t) })).filter(w => w.n && !STOP.test(w.n.replace(/ /g, "")));
    const maxH = Math.max(0, ...clean.map(w => w.h));
    const big = clean.filter(w => w.h >= maxH * 0.6 && w.c > 25);
    return { big: big.map(w => w.n).join(" ").replace(/ /g, ""), all: clean.map(w => w.n).join(" ").replace(/ /g, ""), bigWords: big.map(w => w.n).join(" ") };
  }
  const rank = (a, b) => (b.score - a.score) || (!!b.e.mine - !!a.e.mine) || (a.e.jp - b.e.jp) || (b.e.date || "").localeCompare(a.e.date || "");

  /* Best catalog matches for one read pocket. conf: high | medium | low | empty | none */
  function match(idx, read) {
    const t = textsOf(read.top), nums = numbersIn(read.bot).concat(numbersIn(read.top).filter(n => /[A-Z]/.test(n)));
    const hint = (t.bigWords || "").trim();
    const textChars = (t.all.length + read.bot.map(w => w.t).join("").replace(/\W/g, "").length);
    if (read.flat < 14 && textChars < 4) return { conf: "empty", alts: [], hint: "" };
    const scored = new Map();
    const consider = (e, s) => { const cur = scored.get(e.i); if (!cur || cur.score < s) scored.set(e.i, { e, score: s }); };
    const sim = e => Math.max(nameSim(e.sq, t.big), nameSim(e.sq, t.all) - 0.08) + (e.mine ? 0.06 : 0);
    for (const n of nums) for (const e of idx.byNo.get(n) || []) { const s = sim(e); if (s >= 0.45) consider(e, s + 0.5); }
    if (t.all.length >= 3) {
      let bestName = null, bestS = 0; const cands = [];
      for (const n of idx.names) { const s = Math.max(nameSim(n, t.big), nameSim(n, t.all) - 0.08); if (s >= 0.6) cands.push([n, s + n.length / 400]); if (s > bestS || (s === bestS && n.length > (bestName || "").length)) { bestS = s; bestName = n; } }
      cands.sort((a, b) => b[1] - a[1]);
      for (const [n, s] of cands.slice(0, 4)) for (const e of idx.byName.get(n)) consider(e, s + (e.mine ? 0.06 : 0) + (nums.includes(e.nno) ? 0.5 : 0));
    }
    const list = [...scored.values()].sort(rank);
    if (!list.length) return { conf: "none", alts: [], hint, nums };
    const top = list[0], numHit = nums.includes(top.e.nno);
    const conf = numHit && top.score >= 1.3 ? "high" : (numHit && top.score >= 1.05) || (!nums.length && top.score >= 0.92 && top.e.mine) ? "medium" : "low";
    const alts = []; const seen = new Set();
    for (const x of list) { const k = x.e.pid; if (seen.has(k)) continue; seen.add(k); alts.push(x.e); if (alts.length >= 6) break; }
    return { conf, alts, hint, nums };
  }

  window.WLScan = { getWorker, fileToImage, toCanvas, rectify, readCell, buildIndex, match, norm, normNo, CW, CH };
})();
