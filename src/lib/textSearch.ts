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
      // A short letter prefix is allowed before a padded number, as in promos like SV049 or TG05,
      // but not "25th" or the "2" in a set code like "pt2".
      const n = escape(w.replace(/^0+(?=\d)/, ""));
      const re = new RegExp(`(^|[^a-z0-9])(?:[a-z]{1,4}(?=\\d{2}))?0*${n}($|[^a-z0-9])`);
      return (t: string) => re.test(t);
    }
    return (t: string) => t.includes(w);
  });
  return (text) => tests.every((test) => test(text));
}
