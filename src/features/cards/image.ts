import { tcgImage } from "~/lib/images";
import { pidOf } from "./pricing";
import type { Card } from "./types";

/** The card's own photo if it has one, else TCGplayer's picture of the product. */
export function cardImageSrc(c: Pick<Card, "img" | "tcg" | "listing">): string | null {
  if (c.img && /^https?:/.test(c.img)) return c.img;
  const pid = pidOf(c);
  return pid ? tcgImage(pid) : null;
}
