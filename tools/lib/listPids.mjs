// TCGplayer product ids of every card on the list and every saved pick, read with the public
// anon key from config.js (the same read-only access the site has). Used by the daily jobs.
import { readFile } from "node:fs/promises";

const PAGE = 1000;

/** The product id a list card or pick points at, as a string, or null. */
function pidOf(d) {
  const fromUrl = /tcgplayer\.com\/product\/(\d+)/.exec(d.listing?.url || "")?.[1];
  const pid = d.tcg?.productId || fromUrl || d.tcgProduct;
  return pid ? String(pid) : null;
}

export async function readListPids(root) {
  const cfg = await readFile(new URL("config.js", root), "utf8");
  const url = /url:\s*"([^"]+)"/.exec(cfg)?.[1];
  const key = /anonKey:\s*"([^"]+)"/.exec(cfg)?.[1];
  if (!url || !key) throw new Error("config.js needs a Supabase url and anonKey");
  const out = new Set();
  for (const table of ["cards", "discover"]) {
    for (let from = 0; ; from += PAGE) {
      const r = await fetch(`${url}/rest/v1/${table}?select=data&order=id&offset=${from}&limit=${PAGE}`, {
        headers: { apikey: key, authorization: "Bearer " + key },
      });
      if (!r.ok) throw new Error(`${table}: HTTP ${r.status}`);
      const rows = await r.json();
      for (const { data } of rows) {
        const pid = data && pidOf(data);
        if (pid) out.add(pid);
      }
      if (rows.length < PAGE) break;
    }
  }
  return out;
}
