// Illustrators for catalog cards, from TCGdex (api.tcgdex.net), which lists each card's artist and,
// for most cards, the TCGplayer product it is sold as. TCGplayer's own feed has no artist.
//
// Incremental: `done` remembers each TCGdex set already read (with its card count), so a normal day
// only reads new or grown sets. The first run reads at most `budget` cards and finishes on later days.
const API = "https://api.tcgdex.net/v2";
const LANGS = ["en", "ja"];
const CONCURRENCY = 24;

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJson(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": "want-list-sync (github actions)" } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) {
      if (i >= tries) throw new Error(url + ": " + e.message);
      await sleep(600 * i);
    }
  }
}
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}

/** "001" and "1" are the same number; "TG06" stays as is. */
export const normNumber = n => String(n).split("/")[0].trim().replace(/^0+(?=\d)/, "").toLowerCase();

/** Every TCGplayer product id a TCGdex card names, across its variants and its price block. */
function productIds(card) {
  const out = new Set();
  for (const v of card.variants_detailed || []) {
    const id = v?.thirdParty?.tcgplayer;
    if (Number.isInteger(id)) out.add(id);
  }
  for (const p of Object.values(card.pricing?.tcgplayer || {})) {
    if (p && Number.isInteger(p.productId)) out.add(p.productId);
  }
  return out;
}

/**
 * Reads the sets that are new or changed since `done` and matches their artists to catalog cards.
 * A card is matched by the product id TCGdex gives; a card without one is matched by number within
 * the catalog set its siblings point to. Returns pid -> artist for the cards read, and the new `done`.
 *
 * @param {{ cards: number[][], done: Record<string, number>, budget: number }} input
 *   cards: catalog rows [pid, name, setIndex, number, ...]
 */
export async function fetchArtists({ cards, done, budget }) {
  const rowOfPid = new Map(cards.map(r => [r[0], r]));
  const pidsOfSetNumber = new Map(); // `${setIndex}|${number}` -> pids
  for (const r of cards) {
    const k = `${r[2]}|${normNumber(r[3])}`;
    const list = pidsOfSetNumber.get(k);
    if (list) list.push(r[0]);
    else pidsOfSetNumber.set(k, [r[0]]);
  }

  const todo = [];
  for (const lang of LANGS) {
    // TCG Pocket (the phone game) has no printed cards, so its sets are skipped.
    const pocket = new Set(((await getJson(`${API}/${lang}/series/tcgp`))?.sets || []).map(s => s.id));
    for (const s of (await getJson(`${API}/${lang}/sets`)) || []) {
      const key = `${lang}/${s.id}`;
      const total = s.cardCount?.total || 0;
      if (!pocket.has(s.id) && total > 0 && done[key] !== total) todo.push({ lang, id: s.id, key, total });
    }
  }
  console.log("artists: sets to read:", todo.length);

  const artistOf = new Map();
  const nextDone = { ...done };
  let read = 0, direct = 0, byNumber = 0;
  for (const set of todo) {
    if (read >= budget) break;
    const detail = await getJson(`${API}/${set.lang}/sets/${encodeURIComponent(set.id)}`);
    const ids = (detail?.cards || []).map(c => c.id);
    read += ids.length;
    const got = [];
    let failed = false;
    await pool(ids, CONCURRENCY, async id => {
      try {
        const c = await getJson(`${API}/${set.lang}/cards/${encodeURIComponent(id)}`);
        if (c?.illustrator) got.push({ artist: String(c.illustrator).trim(), number: normNumber(c.localId), pids: productIds(c) });
      } catch (e) { failed = true; console.warn("artists: skip card", id, e.message); }
    });

    // Which catalog set this TCGdex set is: the one most of its matched products sit in.
    const votes = new Map();
    for (const g of got) for (const pid of g.pids) {
      const row = rowOfPid.get(pid);
      if (row) votes.set(row[2], (votes.get(row[2]) || 0) + 1);
    }
    const catSet = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    for (const g of got) {
      let hit = false;
      for (const pid of g.pids) if (rowOfPid.has(pid)) { artistOf.set(pid, g.artist); direct++; hit = true; }
      if (hit || catSet == null) continue;
      for (const pid of pidsOfSetNumber.get(`${catSet}|${g.number}`) || []) {
        if (!artistOf.has(pid)) { artistOf.set(pid, g.artist); byNumber++; }
      }
    }
    if (!failed) nextDone[set.key] = set.total;
  }
  console.log(`artists: read ${read} cards; matched ${direct} by product id, ${byNumber} by number`);
  return { artistOf, done: nextDone };
}
