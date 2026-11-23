import { isGot, priceOf } from "~/features/cards/pricing";
import type { Card } from "~/features/cards/types";
import { formatMoney } from "~/lib/format";
import type { LightboxItem } from "~/ui/Lightbox";

/** The full-screen photo of a card on the list, captioned with its set, number and price, tagged when got. */
export function lightboxItem(c: Card, src: string): LightboxItem {
  const price = priceOf(c);
  return {
    id: c.id,
    src,
    name: c.name + (c.variant ? ` · ${c.variant}` : ""),
    caption: [
      c.lang === "JP" ? "Japanese" : "",
      c.set,
      c.number ? `#${c.number}` : "",
      // A got card's shopping price says nothing about it; its tag says it's got.
      !isGot(c) && price != null ? formatMoney(price) : "",
    ]
      .filter(Boolean)
      .join(" · "),
    mark: isGot(c) ? "Got it" : undefined,
  };
}
