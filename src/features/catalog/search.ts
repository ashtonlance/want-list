import { setOf, type Catalog, type CatalogCard } from "./catalog";

const hayCache = new WeakMap<Catalog, string[]>();

function hayOf(cat: Catalog): string[] {
  let hay = hayCache.get(cat);
  if (!hay) {
    hay = cat.cards.map((c) => {
      const st = setOf(cat, c);
      return `${c.name} ${st.name} ${c.number} ${st.jp ? "japanese jp" : ""}`.toLowerCase();
    });
    hayCache.set(cat, hay);
  }
  return hay;
}

/**
 * Every printing whose name, set and number contain all the words typed.
 * Names that start with the first word come first, then newer sets.
 */
export function searchCatalog(cat: Catalog, query: string, withJapanese: boolean): CatalogCard[] {
  const toks = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/^#/, ""))
    .filter(Boolean);
  if (!toks.length) return [];
  const hay = hayOf(cat);
  const out: CatalogCard[] = [];
  cat.cards.forEach((c, i) => {
    if (setOf(cat, c).jp && !withJapanese) return;
    const h = hay[i] ?? "";
    if (toks.every((t) => h.includes(t))) out.push(c);
  });
  const first = toks[0] ?? "";
  const starts = (c: CatalogCard) => (c.name.toLowerCase().startsWith(first) ? 1 : 0);
  return out.sort((a, b) => starts(b) - starts(a) || setOf(cat, b).date.localeCompare(setOf(cat, a).date));
}

/** Asking for Japanese cards by name: "jp" or "japanese" anywhere in the search. */
export const wantsJapanese = (query: string): boolean => /(^|\s)(jp|japanese)(\s|$)/i.test(query);

/** Store listings and catch-all groups ("Gengar - 050/088 (Cosmos Holo)", "Miscellaneous Cards"). */
const NOISY_SET = /miscellaneous|blister|prize pack|jumbo|deck exclusives|league & championship/i;
const isNoisy = (cat: Catalog, c: CatalogCard): boolean =>
  /\s-\s|\(/.test(c.name) || NOISY_SET.test(setOf(cat, c).name);

/**
 * The search behind Add: nothing until two letters are typed, English cards unless the search asks
 * for Japanese ones, real set printings before store listings and catch-all groups, and at most
 * `limit` results with the full count beside them.
 */
export function addSearch(
  cat: Catalog,
  query: string,
  limit: number,
): { rows: CatalogCard[]; total: number } {
  if (query.trim().length < 2) return { rows: [], total: 0 };
  const found = searchCatalog(cat, query, wantsJapanese(query));
  const noisy = new Map(found.map((c) => [c.pid, isNoisy(cat, c)]));
  found.sort((a, b) => Number(noisy.get(a.pid)) - Number(noisy.get(b.pid)));
  return { rows: found.slice(0, limit), total: found.length };
}
