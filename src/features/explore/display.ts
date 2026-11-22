import { formatMoney } from "~/lib/format";
import type { LightboxItem } from "~/ui/Lightbox";

/** The full-screen photo of a card that isn't on the list yet, captioned like a card on the list. */
export function exploreLightbox(
  c: { name: string; set: string; number: string; market: number | null },
  src: string,
): LightboxItem {
  return {
    src,
    name: c.name,
    caption: [c.set, c.number ? `#${c.number}` : "", c.market != null ? formatMoney(c.market) : ""]
      .filter(Boolean)
      .join(" · "),
  };
}

/** "Want Pikachu, add to Kanto" and "Want it (adds to Kanto)", for a quick add button. */
export const quickWantLabels = (name: string, coll: string) => ({
  label: `Want ${name}${coll ? `, add to ${coll}` : ""}`,
  title: `Want it${coll ? ` (adds to ${coll})` : ""}`,
});
