import { isGot } from "~/features/cards/pricing";
import type { Card } from "~/features/cards/types";
import { formatMoney } from "~/lib/format";
import type { LightboxItem } from "~/ui/Lightbox";

/** The tag on a card that's got. */
export const GOT = "Got it";

/** How a catalog card stands with the list, worded as its sheet words it: "Got it" or "On your list". */
export const listMark = (have: Card | null): string | undefined =>
  have ? (isGot(have) ? GOT : "On your list") : undefined;

/**
 * The full-screen photo of a catalog card, captioned like a card on the list, with `mark` saying
 * whether it's already on the list.
 */
export function exploreLightbox(
  c: { name: string; set: string; number: string; market: number | null },
  src: string,
  mark?: string,
): LightboxItem {
  return {
    src,
    mark,
    name: c.name,
    // A card that's got shows no shopping price, as on the list.
    caption: [
      c.set,
      c.number ? `#${c.number}` : "",
      mark !== GOT && c.market != null ? formatMoney(c.market) : "",
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

/**
 * The photo of a catalog card in a grid: tagged with `mark` when it's on the list already, otherwise
 * with a Want it button when `want` is given (signed in as an editor) that adds it to `want.coll`.
 */
export function catalogLightbox(
  c: { id: string; name: string; set: string; number: string; market: number | null },
  src: string,
  mark: string | undefined,
  want: { coll: string; run: () => Promise<boolean> } | null,
): LightboxItem {
  const item = exploreLightbox(c, src, mark);
  if (mark || !want) return item;
  const { title } = quickWantLabels(c.name, want.coll);
  return { ...item, action: { key: c.id, label: title, doneLabel: "On your list", run: want.run } };
}

/** "Want Pikachu, add to Kanto" and "Want it (adds to Kanto)", for a quick add button. */
export const quickWantLabels = (name: string, coll: string) => ({
  label: `Want ${name}${coll ? `, add to ${coll}` : ""}`,
  title: `Want it${coll ? ` (adds to ${coll})` : ""}`,
});
