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
    const topC = strip(cell, 0, 0.2, 0, 1, 2.4), botC = strip(cell, 0.8, 1, 0, 1, 3);
    const top = wordsOf((await w.recognize(topC, {}, { blocks: true, text: true })).data);
    const bot = wordsOf((await w.recognize(botC, {}, { blocks: true, text: true })).data);
    return { top, bot, flat, topC, botC };
  }
  /* Another look at the name. "white" keeps only bright, colourless pixels as black ink, which pulls white names
     off busy full-art backgrounds. "invert" swaps light and dark. */
  async function rereadTop(read, cell, mode) {
    const w = await getWorker(), sc = 2.4, sw = cell.width, sh = Math.round(cell.height * 0.2);
    const c = document.createElement("canvas"); c.width = Math.round(sw * sc); c.height = Math.round(sh * sc);
    const ctx = c.getContext("2d"); ctx.imageSmoothingQuality = "high";
    if (mode === "invert") { ctx.filter = "invert(1)"; ctx.drawImage(read.topC, 0, 0, c.width, c.height); }
    else {
      ctx.drawImage(cell, 0, 0, sw, sh, 0, 0, c.width, c.height);
      const id = ctx.getImageData(0, 0, c.width, c.height), p = id.data, hist = new Uint32Array(256), n = p.length / 4;
      for (let i = 0; i < p.length; i += 4) hist[Math.min(p[i], p[i + 1], p[i + 2])]++;
      let hi = 255, acc = 0; while (hi > 0 && (acc += hist[hi]) < n * 0.03) hi--;
      const th = Math.max(150, hi - 45);
      for (let i = 0; i < p.length; i += 4) { const mn = Math.min(p[i], p[i + 1], p[i + 2]), mx = Math.max(p[i], p[i + 1], p[i + 2]);
        const ink = mn >= th && mx - mn < 60; p[i] = p[i + 1] = p[i + 2] = ink ? 0 : 255; }
      ctx.putImageData(id, 0, 0);
    }
    return wordsOf((await w.recognize(c, {}, { blocks: true, text: true })).data);
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
    const big = clean.filter(w => w.h >= maxH * 0.6 && w.c > 10);
    return { big: big.map(w => w.n).join(" ").replace(/ /g, ""), all: clean.map(w => w.n).join(" ").replace(/ /g, ""), bigWords: big.map(w => w.n).join(" ") };
  }
  /* ---------- comparing the pocket with each printing's picture ---------- */
  const PW = 40, PH = 56, thumbs = new Map();
  function pixels(src, sx, sy, sw, sh, w, h) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingQuality = "high"; ctx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h); return ctx.getImageData(0, 0, w, h).data;
  }
  function loadThumb(pid) {
    if (!thumbs.has(pid)) thumbs.set(pid, new Promise(res => { const im = new Image(); im.crossOrigin = "anonymous"; im.decoding = "async";
      const t = setTimeout(() => res(null), 8000); im.onload = () => { clearTimeout(t); res(im); }; im.onerror = () => { clearTimeout(t); res(null); };
      im.src = "https://tcgplayer-cdn.tcgplayer.com/product/" + pid + "_200w.jpg"; }));
    return thumbs.get(pid);
  }
  /* Best normalised correlation of a printing's picture against the pocket, trying a few sizes and offsets
     because the card never sits exactly in the middle of its sleeve. */
  function pocketSig(cell) { return pixels(cell, 0, 0, cell.width, cell.height, PW, PH); }
  function imageScore(sig, im) {
    let best = -1;
    for (const s of [0.86, 0.91, 0.96, 1]) {
      const w = Math.round(PW * s), h = Math.min(PH, Math.round(w * 88 / 63)), cp = pixels(im, 0, 0, im.naturalWidth, im.naturalHeight, w, h);
      const mx = PW - w, my = PH - h;
      for (let oy = Math.max(0, (my >> 1) - 3); oy <= Math.min(my, (my >> 1) + 3); oy++) for (let ox = Math.max(0, (mx >> 1) - 3); ox <= Math.min(mx, (mx >> 1) + 3); ox++) {
        let tot = 0;
        for (let ch = 0; ch < 3; ch++) {
          let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, n = 0;
          for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
            const a = sig[((y + oy) * PW + x + ox) * 4 + ch], b = cp[(y * w + x) * 4 + ch]; sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b; n++; }
          const va = saa - sa * sa / n, vb = sbb - sb * sb / n; tot += va > 0 && vb > 0 ? (sab - sa * sb / n) / Math.sqrt(va * vb) : 0;
        }
        if (tot / 3 > best) best = tot / 3;
      }
    }
    return best;
  }


  /* When no name can be read, compare the pocket's picture with the cards already on the list. */
  const QW = 36, QH = 50;
  function mineSigs(idx) {
    if (!idx._mine) idx._mine = (async () => {
      const seen = new Set(), es = [];
      for (const list of idx.byName.values()) for (const e of list) if (e.mine && !seen.has(e.mine)) { seen.add(e.mine); es.push(e); }
      const ims = await Promise.all(es.map(e => loadThumb(e.pid)));
      return es.map((e, i) => ims[i] && { e, im: ims[i], sig: pixels(ims[i], 0, 0, ims[i].naturalWidth, ims[i].naturalHeight, QW, QH) }).filter(Boolean);
    })();
    return idx._mine;
  }
  function quickScore(sig, q) {
    let best = -1;
    for (let oy = 1; oy <= 5; oy += 2) for (let ox = 0; ox <= 4; ox += 2) {
      let tot = 0;
      for (let ch = 0; ch < 3; ch++) { let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, n = 0;
        for (let y = 2; y < QH - 2; y++) for (let x = 2; x < QW - 2; x++) { const a = sig[((y + oy) * PW + x + ox) * 4 + ch], b = q[(y * QW + x) * 4 + ch]; sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b; n++; }
        const va = saa - sa * sa / n, vb = sbb - sb * sb / n; tot += va > 0 && vb > 0 ? (sab - sa * sb / n) / Math.sqrt(va * vb) : 0; }
      if (tot / 3 > best) best = tot / 3;
    }
    return best;
  }
  async function mineMatch(idx, sig) {
    const all = await mineSigs(idx); if (!all.length) return null;
    const top = all.map(m => ({ m, q: quickScore(sig, m.sig) })).sort((a, b) => b.q - a.q).slice(0, 5);
    for (const t of top) t.img = imageScore(sig, t.m.im);
    top.sort((a, b) => b.img - a.img);
    return { alts: top.map(t => t.m.e), img: top[0].img, margin: top[0].img - (top[1] ? top[1].img : 0) };
  }
  const prior = e => (e.mine ? 0.06 : 0) - (e.jp ? 0.05 : 0);
  function nameCands(idx, t, nums) {
    const out = new Map();
    for (const n of idx.names) { const s = Math.max(nameSim(n, t.big), nameSim(n, t.all) - 0.08); if (s >= 0.55) out.set(n, Math.max(out.get(n) || 0, s)); }
    for (const no of nums) for (const e of idx.byNo.get(no) || []) { const s = Math.max(nameSim(e.sq, t.big), nameSim(e.sq, t.all) - 0.08); if (s >= 0.4) out.set(e.sq, Math.max(out.get(e.sq) || 0, s)); }
    return [...out.entries()].sort((a, b) => (b[1] - a[1]) || (b[0].length - a[0].length));
  }

  /* Read one pocket and rank catalog printings. Returns { conf: high | medium | low | empty | none, alts, hint }.
     Nothing is ever saved from here; the app asks the person to confirm every pocket. */
  async function matchCell(idx, read, cell) {
    let t = textsOf(read.top); const nums = numbersIn(read.bot).concat(numbersIn(read.top).filter(n => /[A-Z]/.test(n)));
    const textChars = t.all.length + read.bot.map(w => w.t).join("").replace(/\W/g, "").length;
    if (read.flat < 14 && textChars < 4) return { conf: "empty", alts: [], hint: "" };
    let names = nameCands(idx, t, nums), hint = (t.bigWords || "").trim();
    const merge = more => { const m = new Map(names); for (const [n, v] of more) m.set(n, Math.max(m.get(n) || 0, v)); names = [...m.entries()].sort((a, b) => (b[1] - a[1]) || (b[0].length - a[0].length)); };
    for (const mode of ["white", "invert"]) {
      if (names.length && names[0][1] >= 0.85) break;
      const t2 = textsOf(await rereadTop(read, cell, mode)), n2 = nameCands(idx, t2, nums);
      if (n2.length && (!names.length || n2[0][1] > names[0][1])) hint = (t2.bigWords || "").trim() || hint;
      merge(n2);
    }
    const fromMine = async () => { const f = await mineMatch(idx, pocketSig(cell));
      return f && f.img >= 0.7 && f.margin >= 0.08 ? { conf: "medium", alts: f.alts, hint, nums, img: f.img, margin: f.margin, via: "list" } : null; };
    if (!names.length) return (await fromMine()) || { conf: "none", alts: [], hint, nums };
    /* Shortlist printings from the likeliest names, then let the pictures decide. */
    const pool = [], seen = new Set();
    for (const [n, s] of names.slice(0, 6)) for (const e of idx.byName.get(n)) if (!seen.has(e.pid)) { seen.add(e.pid); pool.push({ e, ns: s, num: nums.includes(e.nno) }); }
    pool.sort((a, b) => (b.num - a.num) || (b.ns - a.ns) || (!!b.e.mine - !!a.e.mine) || (a.e.jp - b.e.jp) || (b.e.date || "").localeCompare(a.e.date || ""));
    const look = [], perName = new Map();
    for (const x of pool) { const k = perName.get(x.e.sq) || 0; if (x.num || k < (x.ns === names[0][1] ? 40 : 10)) { look.push(x); perName.set(x.e.sq, k + 1); } if (look.length >= 48) break; }
    const sig = pocketSig(cell), ims = await Promise.all(look.map(x => loadThumb(x.e.pid)));
    look.forEach((x, i) => { x.img = ims[i] ? imageScore(sig, ims[i]) : 0; });
    for (const x of pool) x.score = x.ns + (x.num ? 0.4 : 0) + (x.img != null ? 1.4 * x.img : -0.3) + prior(x.e);
    pool.sort((a, b) => b.score - a.score);
    const best = pool[0], second = pool.find(x => x.e.pid !== best.e.pid && x.img != null);
    const margin = second ? (best.img || 0) - (second.img || 0) : 1, alts = pool.slice(0, 8).map(x => x.e);
    if ((best.img || 0) < 0.4 && !best.num) return (await fromMine()) || { conf: "none", alts, hint, nums, img: best.img, margin };
    const conf = best.img >= 0.7 && (margin >= 0.06 || best.num) && best.ns >= 0.6 ? "high"
      : best.img >= 0.55 && best.ns >= 0.6 ? "medium" : "low";
    return { conf, alts, hint, nums, img: best.img, margin };
  }


  /* Guess where the page sits in a photo: everything that differs from the colour around the photo's edge,
     largest connected patch, its four extreme corners. Returns [TL,TR,BR,BL] as 0..1 fractions, or null. */
  function findPage(src) {
    const k = 260 / Math.max(src.width, src.height), w = Math.max(8, Math.round(src.width * k)), h = Math.max(8, Math.round(src.height * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.drawImage(src, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, border = [], bw = Math.max(2, Math.round(Math.min(w, h) * 0.025));
    for (let y = 0; y < h; y++) for (let X = 0; X < w; X++) if (y < bw || y >= h - bw || X < bw || X >= w - bw) border.push((y * w + X) * 4);
    const med = ch => { const v = border.map(i => d[i + ch]).sort((a, b) => a - b); return v[v.length >> 1]; };
    const bg = [med(0), med(1), med(2)], dist = i => Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]);
    const bd = border.map(dist).sort((a, b) => a - b), th = Math.max(38, bd[Math.floor(bd.length * 0.9)] * 1.4);
    const mask = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) mask[i] = dist(i * 4) > th ? 1 : 0;
    const lab = new Int32Array(w * h), stack = []; let best = 0, bestN = 0, cur = 0;
    for (let i = 0; i < w * h; i++) { if (!mask[i] || lab[i]) continue; cur++; let n = 0; stack.push(i); lab[i] = cur;
      while (stack.length) { const j = stack.pop(); n++; const X = j % w, Y = (j / w) | 0;
        for (const q of [X > 0 ? j - 1 : -1, X < w - 1 ? j + 1 : -1, Y > 0 ? j - w : -1, Y < h - 1 ? j + w : -1]) if (q >= 0 && mask[q] && !lab[q]) { lab[q] = cur; stack.push(q); } }
      if (n > bestN) { bestN = n; best = cur; } }
    if (bestN < w * h * 0.2) return null;
    let tl = [0, 0, 1e9], tr = [0, 0, -1e9], br = [0, 0, -1e9], bl = [0, 0, 1e9];
    for (let i = 0; i < w * h; i++) { if (lab[i] !== best) continue; const X = i % w, Y = (i / w) | 0;
      if (X + Y < tl[2]) tl = [X, Y, X + Y]; if (X - Y > tr[2]) tr = [X, Y, X - Y]; if (X + Y > br[2]) br = [X, Y, X + Y]; if (X - Y < bl[2]) bl = [X, Y, X - Y]; }
    const q = [tl, tr, br, bl].map(([X, Y]) => [(X + 0.5) / w, (Y + 0.5) / h]);
    let area = 0; for (let i = 0; i < 4; i++) { const [a, b] = q[i], [e, f] = q[(i + 1) % 4]; area += a * f - e * b; } area = Math.abs(area) / 2;
    if (area < 0.25 || area > 0.96) return null;
    return q;
  }
  window.WLScan = { getWorker, fileToImage, toCanvas, rectify, squareToQuad, findPage, readCell, buildIndex, matchCell, norm, normNo, CW, CH };
})();
