import { isGot } from "~/features/cards/pricing";
import type { Card } from "~/features/cards/types";
import { formatMoney } from "~/lib/format";
import type { LightboxItem } from "~/ui/Lightbox";

/** How a catalog card stands with the list, worded as its sheet words it: "Got it" or "On your list". */
export const listMark = (have: Card | null): string | undefined =>
  have ? (isGot(have) ? "Got it" : "On your list") : undefined;

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
    caption: [c.set, c.number ? `#${c.number}` : "", c.market != null ? formatMoney(c.market) : ""]
      .filter(Boolean)
      .join(" · "),
  };
}

/**
 * The photo of a catalog card in a swipeable grid: marked when it's on the list already, otherwise
 * with a Want it button when `want` is given (signed in as an editor).
 */
export function catalogLightbox(
  c: { id: string; name: string; set: string; number: string; market: number | null },
  src: string,
  have: Card | null,
  want: (() => Promise<boolean>) | null,
): LightboxItem {
  const item = exploreLightbox(c, src, listMark(have));
  if (have || !want) return item;
  return { ...item, action: { key: c.id, label: "Want it", doneLabel: "On your list", run: want } };
}

/** "Want Pikachu, add to Kanto" and "Want it (adds to Kanto)", for a quick add button. */
export const quickWantLabels = (name: string, coll: string) => ({
  label: `Want ${name}${coll ? `, add to ${coll}` : ""}`,
  title: `Want it${coll ? ` (adds to ${coll})` : ""}`,
});
