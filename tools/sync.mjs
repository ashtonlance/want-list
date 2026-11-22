// Daily sync: rebuilds catalog.json (every English and Japanese card with today's
// TCGplayer market price) and prices.json (prices for every card on the list and in
// Explore) from tcgcsv.com, the public daily mirror of TCGplayer's catalog.
// Runs in GitHub Actions (.github/workflows/sync.yml). Node 20+, no dependencies.
// Existing cards keep their names, numbers and set names, so nothing on the list shifts.
import { readFile, writeFile } from "node:fs/promises";

const ROOT = new URL("..", import.meta.url);
const API = "https://tcgcsv.com/tcgplayer";
const CATS = [[3, 0], [85, 1]]; // [TCGplayer category, jp flag]: 3 = Pokémon, 85 = Pokémon Japan
const SUB_ORDER = ["Holofoil", "Normal", "Unlimited Holofoil", "Unlimited"];
const today = new Date().toISOString().slice(0, 10);

const readJson = async f => { try { return JSON.parse(await readFile(new URL(f, ROOT), "utf8")); } catch { return null; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": "want-list-sync (github actions)" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      return Array.isArray(j) ? j : j.results || [];
    } catch (e) { if (i >= tries) throw new Error(url + ": " + e.message); await sleep(800 * i); }
  }
}
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}
const ext = (p, name) => ((p.extendedData || []).find(e => e.name === name) || {}).value || "";
const cleanName = n => n.replace(/ - \d+\/\d+$/, "");
const cleanNum = n => { const a = String(n).split("/")[0].trim(); return a.replace(/^0+(?=\d)/, ""); };
const cleanSet = n => n.replace(/^(?:[A-Z][A-Za-z]{0,4}\d{0,3}[a-z]?)\s*(?::|-)\s+/, "");
const round2 = x => Math.round(x * 100) / 100;
function marketOf(subs) {
  if (!subs) return 0;
  const k = SUB_ORDER.find(s => subs[s] && subs[s][0] != null) || Object.keys(subs).find(s => subs[s][0] != null);
  return k ? round2(subs[k][0]) : 0;
}

const oldCat = await readJson("catalog.json");
const oldPrices = await readJson("prices.json");
if (!oldCat) throw new Error("catalog.json missing");
const oldGroups = oldCat.groups || {};
const oldByPid = new Map(oldCat.cards.map(r => [r[0], r]));
const oldSetOfGroup = new Map(); // groupId -> old set index
oldCat.sets.forEach((s, i) => { if (s[3]) oldSetOfGroup.set(s[3], i); });
const oldRowsOfSet = new Map();
for (const r of oldCat.cards) { if (!oldRowsOfSet.has(r[2])) oldRowsOfSet.set(r[2], []); oldRowsOfSet.get(r[2]).push(r); }

// 1. Every set (TCGplayer "group") in both categories.
const groups = [];
for (const [cat, jp] of CATS) for (const g of await get(`${API}/${cat}/groups`)) groups.push({ ...g, cat, jp });
console.log("groups:", groups.length);

// 2. Prices for every group (they change daily); products only where the group changed.
const priceOf = new Map(); // pid -> {SubTypeName: [market, low]}
const productsOf = new Map(); // groupId -> products[]
const failed = new Set();
await pool(groups, 8, async g => {
  try {
    for (const p of await get(`${API}/${g.cat}/${g.groupId}/prices`)) {
      const e = priceOf.get(p.productId) || {};
      e[p.subTypeName || "Normal"] = [p.marketPrice ?? p.midPrice ?? null, p.lowPrice ?? null];
      priceOf.set(p.productId, e);
    }
    const changed = !oldSetOfGroup.has(g.groupId) || oldGroups[g.groupId] !== g.modifiedOn;
    if (changed) productsOf.set(g.groupId, await get(`${API}/${g.cat}/${g.groupId}/products`));
  } catch (e) { failed.add(g.groupId); console.warn("skip group", g.groupId, g.name, e.message); }
});
console.log("prices for", priceOf.size, "products; product lists fetched:", productsOf.size, "failed:", failed.size);

// 3. Rebuild sets and cards.
const rarities = [...oldCat.rarities];
const rarIdx = r => { let i = rarities.indexOf(r); if (i < 0) { rarities.push(r); i = rarities.length - 1; } return i; };
const entries = [], groupsOut = {};
for (const g of groups) {
  const prods = productsOf.get(g.groupId);
  let oldIdx = oldSetOfGroup.get(g.groupId);
  if (oldIdx == null && prods) { const hit = prods.find(p => oldByPid.has(p.productId)); if (hit) oldIdx = oldByPid.get(hit.productId)[2]; }
  const old = oldIdx != null ? oldCat.sets[oldIdx] : null;
  let rows;
  if (prods) {
    rows = [];
    for (const p of prods) {
      const num = ext(p, "Number");
      if (!num) continue; // sealed product, not a card
      const o = oldByPid.get(p.productId);
      rows.push(o ? [p.productId, o[1], 0, o[3], rarities.indexOf(oldCat.rarities[o[4]]), 0]
                  : [p.productId, cleanName(p.name), 0, cleanNum(num), rarIdx(ext(p, "Rarity") || ""), 0]);
    }
  } else if (oldIdx != null) {
    rows = (oldRowsOfSet.get(oldIdx) || []).map(r => [r[0], r[1], 0, r[3], rarities.indexOf(oldCat.rarities[r[4]]), r[5]]);
  } else continue; // brand-new group whose products failed: try again tomorrow
  if (!rows.length) continue;
  // Undated groups (promos, POP series and the like) come back stamped with the time the
  // feed was generated ("...T20:00:05.88Z"); real release dates are plain midnights.
  const pub = /T00:00:00(?:\.0+)?$/.test(g.publishedOn || "") ? g.publishedOn.slice(0, 10) : "";
  // A set that isn't out yet follows TCGplayer's release date, which can still move.
  const date = pub > today ? pub : old ? old[2] : (pub || today);
  entries.push({ set: [old ? old[0] : cleanSet(g.name), g.jp, date, g.groupId], rows, key: pub });
  // Keep the old modifiedOn for a failed group so its products are fetched again next time.
  groupsOut[g.groupId] = failed.has(g.groupId) ? (oldGroups[g.groupId] || "") : g.modifiedOn;
}
// English first, then Japanese, each newest first by release date (undated sets last, as before).
entries.sort((a, b) => a.set[1] - b.set[1] || b.key.localeCompare(a.key));
for (const jp of [0, 1]) { const e = entries.filter(x => x.set[1] === jp); console.log(jp ? "JP" : "EN", "newest:", e.slice(0, 3).map(x => x.set[0]).join(" | "), "… last:", e.slice(-2).map(x => x.set[0]).join(" | ")); }
const sets = [], cards = [];
for (const { set, rows } of entries) {
  const si = sets.push(set) - 1;
  for (const r of rows) { r[2] = si; const subs = priceOf.get(r[0]); if (subs) r[5] = marketOf(subs); cards.push(r); }
}

// 4. Safety: never replace a good catalog with a much smaller one.
if (cards.length < oldCat.cards.length * 0.95) throw new Error(`only ${cards.length} cards vs ${oldCat.cards.length} before; keeping the old catalog`);
// Sets announced but not out yet, with or without a card list so far: [name, jp, release date].
const upcoming = groups
  .map(g => ({ g, pub: /T00:00:00(?:\.0+)?$/.test(g.publishedOn || "") ? g.publishedOn.slice(0, 10) : "" }))
  .filter(x => x.pub > today)
  .sort((a, b) => a.pub.localeCompare(b.pub) || a.g.jp - b.g.jp)
  .map(({ g, pub }) => [cleanSet(g.name), g.jp, pub]);
console.log("upcoming:", upcoming.map(u => `${u[0]} (${u[1] ? "JP" : "EN"}, ${u[2]})`).join(" | ") || "none");
const newCat = { asOf: today, sets, rarities, cards, groups: groupsOut, upcoming };

// 5. prices.json: every product on the list or in Explore, plus anything it already tracked.
const want = new Set(Object.keys((oldPrices && oldPrices.items) || {}));
try {
  const cfg = await readFile(new URL("config.js", ROOT), "utf8");
  const url = /url:\s*"([^"]+)"/.exec(cfg)[1], key = /anonKey:\s*"([^"]+)"/.exec(cfg)[1];
  for (const t of ["cards", "discover"]) for (let from = 0; ; from += 1000) {
    const r = await fetch(`${url}/rest/v1/${t}?select=data&order=id&offset=${from}&limit=1000`, { headers: { apikey: key, authorization: "Bearer " + key } });
    if (!r.ok) throw new Error(t + " HTTP " + r.status);
    const rows = await r.json();
    for (const { data: d } of rows) {
      const pid = (d.tcg && d.tcg.productId) || (/tcgplayer\.com\/product\/(\d+)/.exec((d.listing && d.listing.url) || "") || [])[1] || d.tcgProduct;
      if (pid) want.add(String(pid));
    }
    if (rows.length < 1000) break;
  }
} catch (e) { console.warn("couldn't read the list, pricing only known products:", e.message); }
const items = {};
for (const pid of want) { const e = priceOf.get(+pid); if (e) items[pid] = e; else if (oldPrices && oldPrices.items[pid]) items[pid] = oldPrices.items[pid]; }
const newPrices = { asOf: today, source: "TCGplayer via tcgcsv.com", items };

await writeFile(new URL("catalog.json", ROOT), JSON.stringify(newCat));
await writeFile(new URL("prices.json", ROOT), JSON.stringify(newPrices));
const added = cards.filter(r => !oldByPid.has(r[0])).length;
console.log(`catalog: ${sets.length} sets, ${cards.length} cards (${added} new). prices: ${Object.keys(items).length} products.`);
