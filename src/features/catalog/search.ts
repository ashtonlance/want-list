import { numberTag, queryWords, textMatcher } from "~/lib/textSearch";
import { setOf, type Catalog, type CatalogCard } from "./catalog";

const hayCache = new WeakMap<Catalog, string[]>();

/** Each card's searchable text, in catalog order. */
export function hayOf(cat: Catalog): string[] {
  let hay = hayCache.get(cat);
  if (!hay) {
    hay = cat.cards.map((c) => {
      const st = setOf(cat, c);
      return `${c.name} ${st.name} ${c.number.split("/")[0] ?? ""} ${numberTag(c.number)} ${st.jp ? "japanese jp" : ""}`.toLowerCase();
    });
    hayCache.set(cat, hay);
  }
  return hay;
}

/** Whether a card's name starts with the query's first word, so "gengar" puts Gengar before Dark Gengar. */
export function nameStartsWith(query: string): (c: CatalogCard) => boolean {
  const first = queryWords(query)[0] ?? "";
  return (c) => c.name.toLowerCase().startsWith(first);
}

/**
 * Every printing whose name, set and number contain all the words typed, in any order.
 * Names that start with the first word come first, then newer sets.
 */
export function searchCatalog(cat: Catalog, query: string, withJapanese: boolean): CatalogCard[] {
  const match = textMatcher(query);
  if (!match) return [];
  const hay = hayOf(cat);
  const out: CatalogCard[] = [];
  cat.cards.forEach((c, i) => {
    if (setOf(cat, c).jp && !withJapanese) return;
    if (match(hay[i] ?? "")) out.push(c);
  });
  const starts = nameStartsWith(query);
  return out.sort(
    (a, b) => Number(starts(b)) - Number(starts(a)) || setOf(cat, b).date.localeCompare(setOf(cat, a).date),
  );
}

/** Asking for Japanese cards by name: "jp" or "japanese" anywhere in the search. */
export const wantsJapanese = (query: string): boolean => /(^|\s)(jp|japanese)(\s|$)/i.test(query);

/**
 * Catch-all groups, deck kits and non-playable printings: TCGplayer files these under sets like "Miscellaneous Cards &
 * Products" or "Prize Pack Series Cards". Judged by the set alone, since real printings in real sets often
 * carry a number or variant in the name ("Audino - 074/086 (Master Ball Pattern)").
 */
const NOISY_SET =
  /miscellaneous|blister|prize pack|jumbo|deck exclusives|league & championship|world championship decks|battle academy|start deck|trainer kit/i;
const isNoisy = (cat: Catalog, c: CatalogCard): boolean => NOISY_SET.test(setOf(cat, c).name);

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
