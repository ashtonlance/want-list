// Fills in older days of prices-history.json from tcgcsv.com's daily price archives, for the products
// prices.json tracks. Only days missing some tracked products are fetched, and only those products are added
// to them, so a rerun fills in cards added since and leaves the rest alone. Stops after BUDGET_MINUTES with
// what it has (saved as it goes). Run by .github/workflows/history-backfill.yml (by hand); needs 7z on the
// path, as GitHub's Ubuntu runners have. Node 20.12+, no dependencies.
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KEEP_DAYS, addDays, centsOf, readHistory, setDay, writeHistory } from "./lib/history.mjs";

const ROOT = new URL("..", import.meta.url);
const ARCHIVE = "https://tcgcsv.com/archive/tcgplayer";
const readJson = async (f) => { try { return JSON.parse(await readFile(new URL(f, ROOT), "utf8")); } catch { return null; } };

const catalog = await readJson("catalog.json");
const prices = await readJson("prices.json");
if (!catalog || !prices) throw new Error("catalog.json and prices.json are needed");
const asOf = prices.asOf;
const pids = Object.keys(prices.items);

// Which archive folder (category/group) holds each product's prices.
const groupOf = new Map(); // pid -> "category/groupId"
const cardRow = new Map(catalog.cards.map((r) => [String(r[0]), r]));
for (const pid of pids) {
  const r = cardRow.get(pid);
  const set = r && catalog.sets[r[2]];
  if (set && set[3]) groupOf.set(pid, `${set[1] ? 85 : 3}/${set[3]}`);
}
const wanted = new Set(groupOf.values());
console.log(`${pids.length} products in ${wanted.size} groups; ${pids.length - groupOf.size} not in the catalog`);

const history = readHistory(await readJson("prices-history.json"));
const BUDGET_MS = (Number(process.env.BUDGET_MINUTES) || 45) * 60_000;
const started = Date.now();
const save = () => writeFile(new URL("prices-history.json", ROOT), JSON.stringify(writeHistory(history, pids, asOf)));

// Products each day still lacks. A product the archive has no price for stays missing, so it's tried again
// on a rerun; that only costs a download.
const days = [];
for (let i = KEEP_DAYS - 1; i >= 1; i--) {
  const day = addDays(asOf, -i);
  const row = history.get(day);
  const missing = new Set([...groupOf.keys()].filter((pid) => !row?.has(pid)));
  if (missing.size) days.push({ day, missing });
}
console.log(`backfilling ${days.length} days`);

/** Every "<category>/<group>/prices" file under dir, keyed by "category/group". */
async function pricesFiles(dir) {
  const out = new Map();
  for (const e of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!e.isFile() || e.name !== "prices") continue;
    const parts = join(e.parentPath, e.name).split("/");
    out.set(parts.slice(-3, -1).join("/"), join(e.parentPath, e.name));
  }
  return out;
}

let filled = 0;
for (const { day, missing } of days) {
  if (Date.now() - started > BUDGET_MS) { console.warn("out of time; run again to fill in the rest"); break; }
  const groups = new Set([...missing].map((pid) => groupOf.get(pid)));
  const work = await mkdtemp(join(tmpdir(), "prices-"));
  try {
    const r = await fetch(`${ARCHIVE}/prices-${day}.ppmd.7z`, { headers: { "user-agent": "want-list-sync (github actions)" } });
    if (!r.ok) { console.warn(day, "archive: HTTP", r.status); continue; }
    const file = join(work, "a.7z");
    await writeFile(file, Buffer.from(await r.arrayBuffer()));
    const x = spawnSync("7z", ["x", "-y", `-o${join(work, "x")}`, file], { stdio: ["ignore", "ignore", "pipe"] });
    if (x.status !== 0) { console.warn(day, "7z failed:", String(x.stderr).slice(0, 300)); continue; }
    const files = await pricesFiles(join(work, "x"));
    const byPid = new Map(); // pid -> { subType: [market, low] }
    for (const g of groups) {
      const f = files.get(g);
      if (!f) continue;
      let rows;
      try { const j = JSON.parse(await readFile(f, "utf8")); rows = Array.isArray(j) ? j : j.results || []; } catch { continue; }
      for (const p of rows) {
        const pid = String(p.productId);
        if (!missing.has(pid)) continue;
        const e = byPid.get(pid) || {};
        e[p.subTypeName || "Normal"] = [p.marketPrice ?? p.midPrice ?? null, p.lowPrice ?? null];
        byPid.set(pid, e);
      }
    }
    const row = new Map();
    for (const [pid, subs] of byPid) { const c = centsOf(subs); if (c) row.set(pid, c); }
    if (!row.size) { console.warn(day, "no prices found for the tracked products"); continue; }
    setDay(history, day, row);
    filled++;
    console.log(day, row.size, "products added");
    if (filled % 10 === 0) await save();
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

await save();
const out = writeHistory(history, pids, asOf);
console.log(`filled ${filled} days; history now has ${out.days.length} days for ${Object.keys(out.items).length} products`);
