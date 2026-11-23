/**
 * Search as people type it: every word must match, in any order. Words are matched anywhere in the
 * text ("chu" finds Pikachu). A number matches the card's own number, marked with `numberTag`,
 * allowing promo letters and leading zeros ("49" finds SV049, "16" finds 016 but not 116). Elsewhere
 * in the text it only matches a number standing on its own: "151" finds Scarlet & Violet 151, but
 * "25" isn't "25th" and "2" isn't the "Pt2:" of a set code. A leading # and a printed total ("16/99")
 * are ignored.
 */

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Marks the card's own number in searchable text: a private-use character nobody types. */
const TAG = String.fromCharCode(0xe000);

/**
 * The card's own number for searchable text, so number searches can find it: "SWSH-050" and
 * "#16/99" become the tagged "swsh050" and "16".
 */
export function numberTag(number: string): string {
  const n = (number.trim().toLowerCase().split("/")[0] ?? "").replace(/[^a-z0-9]/g, "");
  return n ? TAG + n : "";
}

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
      const n = escape(w.replace(/^0+(?=\d)/, ""));
      const own = new RegExp(`${TAG}[a-z]{0,4}0*${n}[a-z]?(?=$|\\s)`);
      const loose = new RegExp(`(^|[\\s(])0*${n}(?=$|[\\s),.;!?/])`);
      return (t: string) => own.test(t) || loose.test(t);
    }
    return (t: string) => t.includes(w);
  });
  return (text) => tests.every((test) => test(text));
}
