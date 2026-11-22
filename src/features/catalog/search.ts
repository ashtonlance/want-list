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
  const toks = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
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
