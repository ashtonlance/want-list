import { cleanCatalogName, setOf, type Catalog, type CatalogCard } from "./catalog";

/** A card as the list knows it: what the price check has to find in TCGplayer's catalog. */
export interface CardIdentity {
  name: string;
  set: string;
  number: string;
  variant: string;
  lang: "EN" | "JP";
}

export type CatalogMatch = { pid: number } | { reason: string };

const fold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const words = (s: string): string[] =>
  fold(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
const hasAll = (big: readonly string[], small: readonly string[]): boolean =>
  small.length > 0 && small.every((w) => big.includes(w));

/** A card number the way the catalog writes it: before any "/", no "#", no leading zeros. */
export const normalNumber = (n: string): string =>
  (n.split("/")[0] ?? "")
    .trim()
    .replace(/^#/, "")
    .replace(/^0+(?=\d)/, "")
    .toLowerCase();

/**
 * Finds a card's TCGplayer product in the daily catalog, by set, number and name. It only answers when
 * exactly one printing fits; otherwise it says why, in words the card sheet can show.
 */
export function matchCatalog(cat: Catalog, card: CardIdentity): CatalogMatch {
  const jp = card.lang === "JP";
  const name = words(card.name);
  if (!name.length) return { reason: "The card has no name to look up." };
  const num = normalNumber(card.number);

  let sets: Set<number> | null = null;
  const setName = card.set.trim();
  if (setName) {
    const want = fold(setName);
    const mine = words(setName);
    const exact: number[] = [];
    const loose: number[] = [];
    cat.sets.forEach((s, i) => {
      if (s.jp !== jp) return;
      if (fold(s.name) === want) exact.push(i);
      else if (hasAll(words(s.name), mine) || hasAll(mine, words(s.name))) loose.push(i);
    });
    if (!exact.length && !loose.length)
      return { reason: `TCGplayer has no ${jp ? "Japanese " : ""}set called "${setName}".` };
    // A near name ("151" for "Scarlet & Violet 151") counts only when it points to one set.
    if (!exact.length && loose.length > 1)
      return { reason: `${loose.length} sets fit "${setName}". Use the set's full name.` };
    sets = new Set(exact.length ? exact : loose);
  }

  const where = setName ? `"${setName}"` : jp ? "Japanese sets" : "English sets";
  const named = cat.cards.filter(
    (c) =>
      (sets ? sets.has(c.set) : setOf(cat, c).jp === jp) && hasAll(words(cleanCatalogName(c.name)), name),
  );
  const hits = num ? named.filter((c) => normalNumber(c.number) === num) : named;
  if (!hits.length)
    return {
      reason:
        num && named.length
          ? `No ${card.name} numbered ${card.number} in ${where}. Check the number.`
          : `No ${card.name} in ${where}. Check the name and set.`,
    };
  const best = narrow(hits, card);
  if (best.length === 1 && best[0]) return { pid: best[0].pid };
  return {
    reason: !setName
      ? `${best.length} printings match. Add the set to find the right one.`
      : !num
        ? `${best.length} printings match. Add the card number to find the right one.`
        : `${best.length} printings of #${card.number} match. Add the variant to find the right one.`,
  };
}

/** Of several printings, the ones that fit best: the same name, the variant named, else the plain one. */
function narrow(hits: CatalogCard[], card: CardIdentity): CatalogCard[] {
  let out = hits;
  const keep = (test: (c: CatalogCard) => boolean) => {
    const kept = out.filter(test);
    if (kept.length) out = kept;
  };
  const variant = words(card.variant);
  if (variant.length) keep((c) => hasAll(words(c.name), variant));
  keep((c) => fold(cleanCatalogName(c.name)) === fold(card.name.trim()));
  keep((c) => !c.name.includes("("));
  return out;
}
