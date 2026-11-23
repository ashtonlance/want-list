/**
 * TCGplayer and TCGdex spell some names differently ("Illustration Rare" and "Illustration rare",
 * "Miki Tanaka" and "MikiTanaka"). Left alone, each spelling is its own filter choice that finds only
 * part of the cards, so names are compared and merged with case, spaces and punctuation set aside.
 */

/**
 * A name with case, spaces and punctuation taken out, so spellings of the same name match. A name made
 * only of symbols keeps them, so "★" and "◆" stay apart and neither matches an empty name.
 */
export const nameKey = (s: string): string => {
  const lower = s.trim().toLowerCase();
  return lower.replace(/[^\p{L}\p{N}]+/gu, "") || lower;
};

/** Whether two names are the same once spelling is set aside. */
export const sameName = (a: string, b: string): boolean => nameKey(a) === nameKey(b);

const minorWords = new Set(["a", "an", "and", "of", "or", "the"]);

/** A rarity in title case: each word but "or", "of" and the like starts with a capital, the rest as written. */
export const tidyRarity = (s: string): string =>
  s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(^|[\s-])(\p{Ll})(\p{L}*)/gu, (_m, sep: string, ch: string, rest: string, at: number) =>
      at > 0 && minorWords.has(ch + rest) ? sep + ch + rest : sep + ch.toUpperCase() + rest,
    );

/** How well a spelling reads: spaced words and a leading capital beat run-together or lower case. */
const readability = (s: string): number => (s.match(/ /g)?.length ?? 0) * 2 + (/^\p{Lu}/u.test(s) ? 1 : 0);

/**
 * Merges names that differ only in spelling, in first-seen order. Each group keeps the spelling with the
 * highest `uses`, then the one that reads best, passed through `tidy`. `index[i]` is where input `i` went.
 */
export function mergeNames(
  names: readonly string[],
  uses: readonly number[] = [],
  tidy: (s: string) => string = (s) => s,
): { names: string[]; index: number[] } {
  const groups = new Map<string, number[]>();
  names.forEach((n, i) => {
    const k = nameKey(n);
    const g = groups.get(k);
    if (g) g.push(i);
    else groups.set(k, [i]);
  });
  const score = (i: number) => [uses[i] ?? 0, readability(names[i] ?? "")] as const;
  const better = (a: number, b: number) => {
    const [ua, ra] = score(a);
    const [ub, rb] = score(b);
    return ua !== ub ? ua > ub : ra > rb;
  };
  const out: string[] = [];
  const index = new Array<number>(names.length).fill(-1);
  for (const members of groups.values()) {
    const best = members.reduce((keep, i) => (better(i, keep) ? i : keep));
    const at = out.push(tidy(names[best] ?? "")) - 1;
    for (const i of members) index[i] = at;
  }
  return { names: out, index };
}
