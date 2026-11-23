/**
 * Search as people type it: every word must match, in any order. Words are matched anywhere in the
 * text ("chu" finds Pikachu); numbers must match a whole number, so "gengar 16" finds #16 or #016
 * but not #116 or "16th", and "49" finds the promo SV049. A leading # and a printed total ("16/99") are ignored.
 */

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The words of a query, lowercased, with "#16" and "16/99" both read as 16. */
export function queryWords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^#/, ""))
    .map((w) => (/^\d+\/\d+$/.test(w) ? (w.split("/")[0] ?? w) : w))
    .filter(Boolean);
}

/** A test for lowercased text that's true when every word of the query is in it. Null for an empty query. */
export function textMatcher(query: string): ((text: string) => boolean) | null {
  const words = queryWords(query);
  if (!words.length) return null;
  const tests = words.map((w) => {
    if (/^\d+$/.test(w)) {
      // A card number: a promo prefix (SV9, TG05, RC5, H05) or one letter after it (4a), but not
      // "25th", and other digits may not touch it (16 isn't 116). A prefixed number right before ":"
      // or "+" is a set code like "Pt2:" or "SM2+", not a card number.
      const n = escape(w.replace(/^0+(?=\d)/, ""));
      const re = new RegExp(`(^|[^a-z0-9])(?:(?:[a-z]{2,4}|[hs])0*${n}(?![:+])|0*${n}[a-z]?)($|[^a-z0-9])`);
      return (t: string) => re.test(t);
    }
    return (t: string) => t.includes(w);
  });
  return (text) => tests.every((test) => test(text));
}
