// prices-history.json: each tracked card's TCGplayer market price per day, for the last KEEP_DAYS days.
// Shape: { asOf, days: ["YYYY-MM-DD", …oldest first], items: { productId: { subType: [cents|null, …] } } },
// every series as long as `days`. Prices are whole cents to keep the file small. Used by sync.mjs (one new
// day each run) and history-backfill.mjs (older days from tcgcsv's archives).

export const KEEP_DAYS = 90;

/** A day's market prices as cents: pid -> { subType: cents }. `subs` is { subType: [market, low] }. */
export function centsOf(subs) {
  const out = {};
  for (const [sub, pair] of Object.entries(subs || {})) {
    const m = Array.isArray(pair) ? pair[0] : null;
    if (typeof m === "number" && Number.isFinite(m) && m > 0) out[sub] = Math.round(m * 100);
  }
  return Object.keys(out).length ? out : null;
}

/** The file as day -> Map(pid -> { subType: cents }). A missing or malformed file is an empty history. */
export function readHistory(json) {
  const byDay = new Map();
  if (!json || !Array.isArray(json.days) || !json.items || typeof json.items !== "object") return byDay;
  json.days.forEach((day, i) => {
    const row = new Map();
    for (const [pid, subs] of Object.entries(json.items)) {
      const e = {};
      for (const [sub, series] of Object.entries(subs || {})) {
        const v = Array.isArray(series) ? series[i] : null;
        if (typeof v === "number") e[sub] = v;
      }
      if (Object.keys(e).length) row.set(pid, e);
    }
    byDay.set(day, row);
  });
  return byDay;
}

/**
 * Adds one day's prices (pid -> { subType: cents }). Products the day already had and `row` lacks keep
 * what they had, so a second run on the same day with a failed group doesn't erase the first run's prices.
 */
export function setDay(byDay, day, row) {
  const had = byDay.get(day);
  if (!had) {
    byDay.set(day, row);
    return;
  }
  for (const [pid, subs] of row) had.set(pid, subs);
}

/** Back to the file, keeping the last KEEP_DAYS days up to `asOf` and only the products in `pids`. */
export function writeHistory(byDay, pids, asOf) {
  const first = addDays(asOf, -(KEEP_DAYS - 1));
  const days = [...byDay.keys()].filter((d) => d >= first && d <= asOf).sort();
  const items = {};
  for (const pid of pids) {
    const subs = new Set();
    for (const d of days) for (const s of Object.keys(byDay.get(d).get(pid) || {})) subs.add(s);
    for (const sub of subs) {
      const series = days.map((d) => byDay.get(d).get(pid)?.[sub] ?? null);
      if (series.some((v) => v != null)) (items[pid] ??= {})[sub] = series;
    }
  }
  return { asOf, days, items };
}

export function addDays(day, n) {
  const t = new Date(day + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
